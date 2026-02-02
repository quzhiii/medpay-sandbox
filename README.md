# MedPay Sandbox

医保支付方式（DRG/DIP）沙盘推演系统，用于学术研究与教学演示。

## 项目目标（可验收）

让用户在 30 分钟内，通过 3 个情景推演，能说清：
“DRG 与 DIP 的预算—点值/费率—病例结构—特例单议—结余留用—清算”
如何联动影响医院盈亏与行为。

## 项目结构

- `apps/web`：前端（Next.js）
- `services/engine`：后端引擎（FastAPI）
- `data/region_packs`：地区包与证据链数据
- `data/scenarios`：情景包（ScenarioPack）
- `docs`：产品/方法论/证据链/安全文档
- `scripts`：验收与验证脚本

## 更新概览（当前实现）

- DRG/DIP 双引擎结算：支付、利润、点值与差异对照可视化
- 特例单议：额度限制（DRG 5% / DIP 5‰）、uplift/ffspay 策略、管理效应追踪
- 解释器：结构/价格/管理三分解，结算事件自动生成解释卡
- 证据链：/method 页面展示方法论、证据卡可展开/折叠，来源统计与参数列表
- 情景模式：/watch 支持自由模式与情景模式（ScenarioPack 引导）
- 复盘卡：情景完成后生成 Markdown 复盘卡并下载
- 导出：`/scenario/{id}/export` 下载 `scenario.json`、`events.jsonl`、`results.csv`

## 一键运行（Makefile）

需要安装：Python 3.10+、Node.js 18+、GNU Make。

```bash
make install
make dev
```

> `make dev` 会并行启动后端与前端。Windows 如遇 GNU Make 不可用，请使用下方“手动启动”。

## 手动启动

后端：
```bash
cd services/engine
python main.py
```

前端：
```bash
cd apps/web
npm install
npm run dev
```

访问：
```
http://localhost:3000
```

## 导出

导出接口：
```
GET /scenario/{id}/export
```

下载 zip 包含：
- `scenario.json`
- `events.jsonl`
- `results.csv`

## 情景包 API

```bash
GET /scenarios
GET /scenarios/{id}
POST /scenario/{id}/params
```

## 文档

- `docs/PRD.md`
- `docs/METHODOLOGY.md`
- `docs/EVIDENCE_CHAIN.md`
- `docs/REGION_PACKS.md`
- `docs/SECURITY.md`
- `scripts/prof_validation.md`

## 情景包示例

- `data/scenarios/s1_point_value_down.yml`
- `data/scenarios/s2_case_mix_heavy.yml`
- `data/scenarios/s3_special_quota.yml`
