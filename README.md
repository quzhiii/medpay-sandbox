# MedPay Sandbox

Version: 1.0

医保支付方式（DRG/DIP）沙盘推演系统，用于学术研究与教学演示。
A DRG/DIP payment simulation sandbox for research and teaching.

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

## 主要亮点 / Highlights

- DRG/DIP 双引擎对照：支付、利润、点值同屏对比，定位差异来源。
- 特例单议额度约束：DRG 5% / DIP 5‰ 额度与 uplift/ffspay 策略联动。
- 解释器三分解：结构/价格/管理效应自动生成解释卡。
- 情景引导与自由演练：/watch 同时支持 Guided Mode 与自由模式。
- 复盘卡一键导出：生成 Markdown 复盘卡并下载。
- 数据导出闭环：`/scenario/{id}/export` 提供 `scenario.json`、`events.jsonl`、`results.csv`。

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

## License

MIT
