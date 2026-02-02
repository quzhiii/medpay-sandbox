# 证据链

## 参数来源类型
- official：国家或省级医保局公开文件
- local_doc：统筹区实施细则或地方文件
- assumption：演示假设（必须标注）

## 证据卡字段
- param_key：参数键名
- source_type：来源类型
- source_title：来源标题
- publish_date：发布日期
- excerpt：关键摘录
- notes：分析备注

## 使用要求
- 所有假设参数需在 evidence 中明确标注 `param_source=assumption`。
- 证据卡需可展开/折叠浏览，便于追溯。
