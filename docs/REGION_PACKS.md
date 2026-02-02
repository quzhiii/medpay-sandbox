# Region Packs

地区包用于封装区域政策参数与证据链。

## 必要字段
- 基础参数（base_rate、adjustment_multiplier 等）
- DIP 点值模型（multiplier、external_points_base）
- 特例单议额度与策略（quota_rate_drg / quota_rate_dip / uplift_rate / ffspay_rate）
- param_source_map：参数来源标注
- evidence：证据卡列表

## 规范
- `param_source_map` 必须覆盖关键参数。
- `evidence` 需要覆盖主要支付规则，假设值标注为 `assumption`。
