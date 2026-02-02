# 教授验收脚本（10 分钟）

## 目标
在 10 分钟内验证系统可信性与可复现能力。

## 步骤

1) 打开首页
- 访问 `http://localhost:3000`
- 确认页面可加载

2) 进入 `/watch` 跑 7 天
- 点击“启动场景”
- 点击“自动”运行至 Day 7 结束
- 观察 DRG/DIP 支付、利润、点值、特例单议额度等看板变化

3) 切换策略观察解释卡
- 重置场景
- 切换“特例策略”为 `按项目付费`
- 再次运行并观察“解释卡”三分解变化

4) 进入 `/method` 查看证据链
- 确认证据卡片可展开/折叠
- 查看参数来源统计与列表

5) 导出并复现
- 点击导出接口：`GET /scenario/{id}/export`
- 解压 zip，确认包含 `scenario.json` / `events.jsonl` / `results.csv`
- 检查 `results.csv` 列包含：pay_drg、pay_dip、cost、margin、point_value、quota_used、decomp_* 

## 通过标准
- 页面可访问、指标可变化
- 解释卡出现且三分解相加≈支付变化
- 证据链可追溯
- 导出文件齐全
