"""
MedPay Sandbox - FastAPI 后端入口
"""

import csv
import io
import json
import logging
import zipfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from core.region_loader import get_loader, reload_packs
from core.scenario_pack_loader import get_scenario_loader, reload_scenario_packs
from core.scenario import get_scenario_manager
from models.schemas import (
    RegionPack,
    RegionPackSummary,
    ValidationError,
    ScenarioPack,
    ScenarioPackSummary,
    StartScenarioRequest,
    StartScenarioResponse,
    StepScenarioResponse,
    ScenarioSummary,
    Event,
    ScenarioParamUpdate,
)

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时加载地区包
    logger.info("正在加载地区包...")
    packs, errors = reload_packs()
    logger.info(f"加载完成: {len(packs)} 个成功, {len(errors)} 个失败")
    for error in errors:
        logger.warning(f"加载失败 - {error.pack_id}: {error.errors}")
    yield
    # 关闭时清理
    logger.info("服务关闭")


app = FastAPI(
    title="MedPay Sandbox Engine",
    description="医保沙盘推演引擎 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，解决本地开发时的 CORS 问题
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 根路径与健康检查 ====================


@app.get("/")
async def root():
    """根路径"""
    return {"name": "MedPay Sandbox Engine", "version": "0.1.0", "status": "running"}


@app.get("/health")
async def health():
    """健康检查"""
    loader = get_loader()
    manager = get_scenario_manager()
    return {
        "status": "healthy",
        "packs_loaded": len(loader.get_all_packs()),
        "active_scenarios": len(manager.scenarios),
    }


# ==================== 地区包 API ====================


@app.get("/regions", response_model=list[RegionPackSummary])
async def list_regions():
    """获取所有地区包列表"""
    loader = get_loader()
    return loader.get_summaries()


@app.get("/regions/errors", response_model=list[ValidationError])
async def list_region_errors():
    """获取地区包加载错误列表"""
    loader = get_loader()
    return loader.get_errors()


@app.get("/regions/{region_id}", response_model=RegionPack)
async def get_region(region_id: str):
    """获取单个地区包详情"""
    loader = get_loader()
    pack = loader.get_pack(region_id)
    if not pack:
        raise HTTPException(
            status_code=404, detail=f"地区包 '{region_id}' 不存在或加载失败"
        )
    return pack


@app.post("/regions/reload")
async def reload_regions():
    """重新加载所有地区包"""
    packs, errors = reload_packs()
    return {
        "message": "重新加载完成",
        "success_count": len(packs),
        "error_count": len(errors),
        "errors": [e.model_dump() for e in errors],
    }


# ==================== Scenario API ====================


@app.get("/scenarios", response_model=list[ScenarioPackSummary])
async def list_scenarios():
    """列出所有情景包"""
    loader = get_scenario_loader()
    return loader.get_summaries()


@app.get("/scenarios/{scenario_id}", response_model=ScenarioPack)
async def get_scenario_pack(scenario_id: str):
    """获取单个情景包详情"""
    loader = get_scenario_loader()
    pack = loader.get_pack(scenario_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"情景包 '{scenario_id}' 不存在")
    return pack


@app.post("/scenarios/reload")
async def reload_scenarios():
    """重新加载情景包"""
    packs, errors = reload_scenario_packs()
    return {
        "message": "重新加载完成",
        "success_count": len(packs),
        "error_count": len(errors),
        "errors": [e.model_dump() for e in errors],
    }


@app.post("/scenario/start", response_model=StartScenarioResponse)
async def start_scenario(request: StartScenarioRequest):
    """启动新场景"""
    manager = get_scenario_manager()

    # 检查地区包是否存在
    loader = get_loader()
    if not loader.get_pack(request.region_id):
        raise HTTPException(
            status_code=400, detail=f"地区包 '{request.region_id}' 不存在"
        )

    try:
        scenario = manager.create(request)
        return StartScenarioResponse(
            scenario_id=scenario.state.scenario_id,
            state=scenario.state,
            message="场景已创建，可以开始推进",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scenario/{scenario_id}/step", response_model=StepScenarioResponse)
async def step_scenario(scenario_id: str):
    """推进场景一个批次"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    if scenario.state.is_finished:
        return StepScenarioResponse(
            scenario_id=scenario_id,
            state=scenario.state,
            new_events=[],
            message="场景已结束",
        )

    new_events = scenario.step()

    return StepScenarioResponse(
        scenario_id=scenario_id,
        state=scenario.state,
        new_events=new_events,
        message=f"已推进到 Day{scenario.state.current_day}-{scenario.state.current_batch}",
    )


@app.post("/scenario/{scenario_id}/params")
async def update_scenario_params(scenario_id: str, request: ScenarioParamUpdate):
    """更新场景参数（引导模式使用）"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    scenario.update_params(request.model_dump())
    return {"message": "参数已更新", "state": scenario.state}


@app.get("/scenario/{scenario_id}/metrics")
async def get_scenario_metrics(scenario_id: str, window: str = "instant"):
    """获取稳定指标集合"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    if window not in {"instant", "last_settle", "day"}:
        raise HTTPException(
            status_code=400, detail="window 参数必须为 instant|last_settle|day"
        )

    metrics, missing_reasons = _compute_metrics(scenario, window)

    return {
        "window": window,
        "metrics": metrics,
        "missing_reasons": missing_reasons,
    }


@app.get("/scenario/{scenario_id}", response_model=ScenarioSummary)
async def get_scenario(scenario_id: str):
    """获取场景摘要"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    return scenario.get_summary()


@app.get("/scenario/{scenario_id}/events", response_model=list[Event])
async def get_scenario_events(scenario_id: str, limit: int = 100, offset: int = 0):
    """获取场景事件列表"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    events = scenario.events[offset : offset + limit]
    return events


@app.get("/scenario/{scenario_id}/export")
async def export_scenario(scenario_id: str):
    """导出场景数据"""
    manager = get_scenario_manager()
    scenario = manager.get(scenario_id)

    if not scenario:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")

    export_data = scenario.export()

    scenario_json = json.dumps(export_data["scenario"], ensure_ascii=False, indent=2)
    events_jsonl = "".join(
        [
            json.dumps(event.model_dump(), ensure_ascii=False) + "\n"
            for event in scenario.events
        ]
    )

    results_csv = _build_results_csv(scenario.events)

    archive_buffer = io.BytesIO()
    with zipfile.ZipFile(archive_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("scenario.json", scenario_json)
        archive.writestr("events.jsonl", events_jsonl)
        archive.writestr("results.csv", results_csv)

    archive_buffer.seek(0)
    filename = f"scenario_{scenario_id}_export.zip"

    return StreamingResponse(
        archive_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _build_results_csv(events: list[Event]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ts",
            "case_id",
            "pay_drg",
            "pay_dip",
            "cost",
            "margin_drg",
            "margin_dip",
            "point_value",
            "quota_used_drg",
            "quota_used_dip",
            "quota_max_drg",
            "quota_max_dip",
            "decomp_drg_structural",
            "decomp_drg_price",
            "decomp_drg_management",
            "decomp_dip_structural",
            "decomp_dip_price",
            "decomp_dip_management",
            "delta_total_pay_drg",
            "delta_total_pay_dip",
        ]
    )

    for event in events:
        if event.type != "SETTLE":
            continue

        explanation = event.explanation
        decomp_drg = explanation.decomp_drg if explanation else None
        decomp_dip = explanation.decomp_dip if explanation else None

        payload = event.payload or {}

        writer.writerow(
            [
                event.ts,
                event.case_id or "",
                event.delta.pay_drg,
                event.delta.pay_dip,
                payload.get("cost", 0),
                event.delta.margin_drg,
                event.delta.margin_dip,
                payload.get("point_value", 0),
                payload.get("quota_used_drg", 0),
                payload.get("quota_used_dip", 0),
                payload.get("quota_max_drg", 0),
                payload.get("quota_max_dip", 0),
                decomp_drg.structural if decomp_drg else 0,
                decomp_drg.price if decomp_drg else 0,
                decomp_drg.management if decomp_drg else 0,
                decomp_dip.structural if decomp_dip else 0,
                decomp_dip.price if decomp_dip else 0,
                decomp_dip.management if decomp_dip else 0,
                explanation.delta_total_pay_drg if explanation else event.delta.pay_drg,
                explanation.delta_total_pay_dip if explanation else event.delta.pay_dip,
            ]
        )

    return output.getvalue()


def _compute_metrics(
    scenario, window: str
) -> tuple[dict[str, float | None], dict[str, str]]:
    metrics: dict[str, float | None] = {}
    null_reasons: dict[str, str] = {}

    state = scenario.state
    events = scenario.events

    def last_settle_event():
        for event in reversed(events):
            if event.type == "SETTLE":
                return event
        return None

    def day_settle_events(day: int):
        return [
            e for e in events if e.type == "SETTLE" and e.ts.startswith(f"Day{day}-")
        ]

    last_settle = last_settle_event()
    day_events = day_settle_events(state.current_day)

    def set_value(key: str, value: float | None, reason: str | None = None):
        metrics[key] = value
        if value is None and reason:
            null_reasons[key] = reason

    def margin_rate(
        margin: float | None, cost: float | None
    ) -> tuple[float | None, str | None]:
        if cost is None:
            return None, "缺少字段 cost"
        if margin is None:
            return None, "缺少字段 margin"
        if cost == 0:
            return None, "成本为 0"
        return margin / cost, None

    def quota_ratio(
        used: float | None,
        max_value: float | None,
        used_reason: str,
        max_reason: str,
    ) -> tuple[float | None, str | None]:
        if max_value is None:
            return None, max_reason
        if used is None:
            return None, used_reason
        if max_value == 0:
            return None, "额度上限为 0"
        return used / max_value, None

    def set_quota_metrics(prefix: str, used: float | None, max_value: float | None):
        used_key = f"{prefix}.quota.used"
        max_key = f"{prefix}.quota.max"
        ratio_key = f"{prefix}.quota.ratio"
        used_reason = f"缺少字段 quota_used_{prefix}"
        max_reason = f"缺少字段 quota_max_{prefix}"

        if used is None:
            set_value(used_key, None, used_reason)
        else:
            set_value(used_key, used)

        if max_value is None:
            set_value(max_key, None, max_reason)
        else:
            set_value(max_key, max_value)

        ratio_value, ratio_reason = quota_ratio(
            used, max_value, used_reason, max_reason
        )
        set_value(ratio_key, ratio_value, ratio_reason)

    if window == "instant":
        drg_pay = state.pay_drg_total
        dip_pay = state.pay_dip_total
        cost = state.total_cost
        drg_margin = state.margin_drg_total
        dip_margin = state.margin_dip_total
        set_value("drg.pay_total", drg_pay)
        set_value("drg.cost_total", cost)
        set_value("drg.margin_total", drg_margin)
        drg_margin_rate, drg_margin_reason = margin_rate(drg_margin, cost)
        set_value("drg.margin_rate", drg_margin_rate, drg_margin_reason)
        set_quota_metrics("drg", state.quota_used_drg, state.quota_max_drg)
        set_value("drg.management_effect", state.management_effect_drg)
        set_value("drg.rejected_special_cases", state.rejected_special_cases)

        set_value("dip.pay_total", dip_pay)
        set_value("dip.cost_total", cost)
        set_value("dip.margin_total", dip_margin)
        dip_margin_rate, dip_margin_reason = margin_rate(dip_margin, cost)
        set_value("dip.margin_rate", dip_margin_rate, dip_margin_reason)
        set_value("dip.point_value", state.current_point_value)
        set_value("dip.external_points", state.external_points)
        set_quota_metrics("dip", state.quota_used_dip, state.quota_max_dip)
        set_value("dip.management_effect", state.management_effect_dip)

    elif window == "last_settle":
        if not last_settle:
            for key in [
                "drg.pay_total",
                "drg.cost_total",
                "drg.margin_total",
                "drg.margin_rate",
                "drg.quota.used",
                "drg.quota.max",
                "drg.quota.ratio",
                "drg.management_effect",
                "drg.rejected_special_cases",
                "dip.pay_total",
                "dip.cost_total",
                "dip.margin_total",
                "dip.margin_rate",
                "dip.point_value",
                "dip.external_points",
                "dip.quota.used",
                "dip.quota.max",
                "dip.quota.ratio",
                "dip.management_effect",
                "explainer.drg.delta_pay",
                "explainer.drg.struct",
                "explainer.drg.price",
                "explainer.drg.management",
                "explainer.drg.price_share",
                "explainer.dip.delta_pay",
                "explainer.dip.struct",
                "explainer.dip.price",
                "explainer.dip.management",
                "explainer.dip.price_share",
            ]:
                set_value(key, None, "无结算事件")
            return metrics, null_reasons

        payload = last_settle.payload or {}
        drg_pay = last_settle.delta.pay_drg
        dip_pay = last_settle.delta.pay_dip
        cost = payload.get("cost", None)
        drg_margin = last_settle.delta.margin_drg
        dip_margin = last_settle.delta.margin_dip
        set_value("drg.pay_total", drg_pay)
        if cost is None:
            set_value("drg.cost_total", None, "缺少字段 cost")
        else:
            set_value("drg.cost_total", cost)
        set_value("drg.margin_total", drg_margin)
        drg_margin_rate, drg_margin_reason = margin_rate(drg_margin, cost)
        set_value("drg.margin_rate", drg_margin_rate, drg_margin_reason)
        set_quota_metrics(
            "drg",
            payload.get("quota_used_drg", None),
            payload.get("quota_max_drg", None),
        )
        set_value("drg.management_effect", state.management_effect_drg)
        set_value("drg.rejected_special_cases", state.rejected_special_cases)

        set_value("dip.pay_total", dip_pay)
        if cost is None:
            set_value("dip.cost_total", None, "缺少字段 cost")
        else:
            set_value("dip.cost_total", cost)
        set_value("dip.margin_total", dip_margin)
        dip_margin_rate, dip_margin_reason = margin_rate(dip_margin, cost)
        set_value("dip.margin_rate", dip_margin_rate, dip_margin_reason)
        point_value = payload.get("point_value", None)
        if point_value is None:
            set_value("dip.point_value", None, "缺少字段 point_value")
        else:
            set_value("dip.point_value", point_value)
        set_value("dip.external_points", state.external_points)
        set_quota_metrics(
            "dip",
            payload.get("quota_used_dip", None),
            payload.get("quota_max_dip", None),
        )
        set_value("dip.management_effect", state.management_effect_dip)

        if last_settle.explanation:
            exp = last_settle.explanation
            set_value("explainer.drg.delta_pay", exp.delta_total_pay_drg)
            set_value("explainer.drg.struct", exp.decomp_drg.structural)
            set_value("explainer.drg.price", exp.decomp_drg.price)
            set_value("explainer.drg.management", exp.decomp_drg.management)
            if exp.delta_total_pay_drg != 0:
                set_value(
                    "explainer.drg.price_share",
                    exp.decomp_drg.price / exp.delta_total_pay_drg,
                )
            else:
                set_value("explainer.drg.price_share", None, "分母为 0")

            set_value("explainer.dip.delta_pay", exp.delta_total_pay_dip)
            set_value("explainer.dip.struct", exp.decomp_dip.structural)
            set_value("explainer.dip.price", exp.decomp_dip.price)
            set_value("explainer.dip.management", exp.decomp_dip.management)
            if exp.delta_total_pay_dip != 0:
                set_value(
                    "explainer.dip.price_share",
                    exp.decomp_dip.price / exp.delta_total_pay_dip,
                )
            else:
                set_value("explainer.dip.price_share", None, "分母为 0")
        else:
            for key in [
                "explainer.drg.delta_pay",
                "explainer.drg.struct",
                "explainer.drg.price",
                "explainer.drg.management",
                "explainer.drg.price_share",
                "explainer.dip.delta_pay",
                "explainer.dip.struct",
                "explainer.dip.price",
                "explainer.dip.management",
                "explainer.dip.price_share",
            ]:
                set_value(key, None, "无解释器数据")

    elif window == "day":
        if not day_events:
            for key in [
                "drg.pay_total",
                "drg.cost_total",
                "drg.margin_total",
                "drg.margin_rate",
                "drg.quota.used",
                "drg.quota.max",
                "drg.quota.ratio",
                "drg.management_effect",
                "drg.rejected_special_cases",
                "dip.pay_total",
                "dip.cost_total",
                "dip.margin_total",
                "dip.margin_rate",
                "dip.point_value",
                "dip.external_points",
                "dip.quota.used",
                "dip.quota.max",
                "dip.quota.ratio",
                "dip.management_effect",
            ]:
                set_value(key, None, "当天无结算事件")
            return metrics, null_reasons

        drg_pay = sum(e.delta.pay_drg for e in day_events)
        dip_pay = sum(e.delta.pay_dip for e in day_events)
        drg_margin = sum(e.delta.margin_drg for e in day_events)
        dip_margin = sum(e.delta.margin_dip for e in day_events)
        day_cost_values: list[float] = []
        missing_cost = False
        for event in day_events:
            value = (event.payload or {}).get("cost", None)
            if value is None:
                missing_cost = True
                break
            day_cost_values.append(value)

        if missing_cost:
            cost = None
        else:
            cost = sum(day_cost_values)
        set_value("drg.pay_total", drg_pay)
        if cost is None:
            set_value("drg.cost_total", None, "缺少字段 cost")
        else:
            set_value("drg.cost_total", cost)
        set_value("drg.margin_total", drg_margin)
        drg_margin_rate, drg_margin_reason = margin_rate(drg_margin, cost)
        set_value("drg.margin_rate", drg_margin_rate, drg_margin_reason)
        set_quota_metrics("drg", state.quota_used_drg, state.quota_max_drg)
        set_value("drg.management_effect", state.management_effect_drg)
        set_value("drg.rejected_special_cases", state.rejected_special_cases)

        set_value("dip.pay_total", dip_pay)
        if cost is None:
            set_value("dip.cost_total", None, "缺少字段 cost")
        else:
            set_value("dip.cost_total", cost)
        set_value("dip.margin_total", dip_margin)
        dip_margin_rate, dip_margin_reason = margin_rate(dip_margin, cost)
        set_value("dip.margin_rate", dip_margin_rate, dip_margin_reason)
        set_value("dip.point_value", state.current_point_value)
        set_value("dip.external_points", state.external_points)
        set_quota_metrics("dip", state.quota_used_dip, state.quota_max_dip)
        set_value("dip.management_effect", state.management_effect_dip)

    else:
        raise ValueError("window 参数必须为 instant|last_settle|day")

    return metrics, null_reasons


@app.delete("/scenario/{scenario_id}")
async def delete_scenario(scenario_id: str):
    """删除场景"""
    manager = get_scenario_manager()

    if manager.delete(scenario_id):
        return {"message": f"场景 '{scenario_id}' 已删除"}
    else:
        raise HTTPException(status_code=404, detail=f"场景 '{scenario_id}' 不存在")


if __name__ == "__main__":
    import uvicorn

    # 移除 reload=True 以确保在 Windows 上的稳定性
    uvicorn.run(app, host="0.0.0.0", port=8000)
