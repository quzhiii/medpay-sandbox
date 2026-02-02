# PRD

## 目标
- 构建可复现的医保支付沙盘系统，用于 DRG/DIP 双引擎对照与教学演示。
- 支持事件账本、解释器归因、证据链追踪与导出复现。

## 关键功能
- 双引擎计算：DRG 与 DIP 并行结算。
- 事件账本：ARRIVAL/ADMIT/PROCEDURE/DISCHARGE/GROUPING/SETTLE 全链路记录。
- 解释器：结构/价格/管理三分解，归因和为支付变化。
- 证据链：参数来源可追溯（official/local_doc/assumption）。
- 导出：scenario.json、events.jsonl、results.csv。

## 核心用户
- 研究人员：验证支付机制影响与政策假设。
- 教学场景：展示 DRG/DIP 机制差异与“囚徒困境”。
- 政策分析：提供机制验证的最小闭环。

## 非目标
- 不用于真实医保结算。
- 不提供精确的区域级政策复现。
