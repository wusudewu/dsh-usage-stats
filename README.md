# dsh-usage-stats

DeepSeek Harness 用量统计插件 — 带图表的用量统计面板。

## 功能

### 用量标签页
- **滚动 24h 模型 Token 趋势** — 折线图展示各模型过去 24 小时的滑动窗口 Token 消耗，支持 24h / 7d / 14d / 30d 时间范围切换
- **模型用量分布** — 饼图 + 表格展示各模型占比
- **每日 Token 热力历** — GitHub 风格的贡献热力图（按日历日）
- 每会话详细统计
- KPI 指标：累计 Token、峰值单日 Token、最长聊天时长、当前/最长连续天数
- 每 5 分钟自动刷新

### 数据指标
- 总会话数、轮次、步骤数
- LLM 耗时、工具耗时
- 首 Token 时间 (TTFT)、解码速度
- 输入/输出 Token、缓存读写 Token
- 上下文 Token 估算

### 数据保留
- 趋势时间戳仅保留最近 400 天（热力图只渲染 52 周），每模型最多 10000 条，账本不会无限膨胀

## 安装（DeepSeek Harness Desktop）

插件由两部分组成：宿主端 Cordis 插件（`lib/index.js`，提供统计 API）和客户端面板
（`lib/client.js`，挂在“设置 → 插件”页面的用量标签页）。

桌面端从用户目录的 web profile 加载插件清单（`%USERPROFILE%\.dsh\profiles\web`），
**不要**往应用安装目录（`resources\app\node_modules`）里拷贝——那里的 cordis.patch.yml
不会被应用，`dsh.client` 声明也不会被扫描。

```powershell
# 1) 把插件放进 profile 的 node_modules
$profile = Join-Path $env:USERPROFILE '.dsh\profiles\web'
$dest    = Join-Path $profile 'node_modules\dsh-usage-stats'
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
Copy-Item -Recurse .\dsh-usage-stats $dest

# 2) 在 profile 的 cordis.patch.yml 中新增一行（没有则新建该文件）：
#    - id: usage-stats
#      name: dsh-usage-stats

# 3) 重启 DeepSeek Harness Desktop，在“设置 → 插件”里应出现“用量统计”标签页
```

若机器上有 `dsh` CLI，也可走标准安装流程（本地目录可先 `pnpm pack` 打包成 tgz）：

```bash
dsh plugin --profile web add dsh-usage-stats
```

> 注意：插件要求宿主为 0.1.0-rc.8 及以上（见 peerDependencies）；统计 API 直接挂在
> webServer 上、无鉴权，请勿将 `host` 配为 `0.0.0.0` 暴露到不受信任的网络。

## API

- `GET /api/usage-stats` — 全量汇总统计（含 `rollingDailyTrend` 滚动 24h 趋势；自 v0.1.3 起
  `sessions` 为精简行：id/title/createdAt/live/persisted/turns/steps/llmMs/toolMs/totalTokens，
  `summary.maxSessionLlmMs` 为最长会话 LLM 时长）
- `GET /api/usage-stats/session?id=xxx` — 单会话完整统计（stats/tokenUsage/contextBreakdown/modelUsage，含时间戳）

## 开发

```bash
pnpm test   # 运行单元测试（Node 内置 test runner，无需额外依赖）
```

## 许可

MIT