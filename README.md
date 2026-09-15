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

### 方式一：从 Release 安装（推荐）

到 [Releases 页面](https://github.com/wusudewu/dsh-usage-stats/releases) 下载
`dsh-usage-stats-<版本>.tgz`，然后：

```powershell
dsh plugin add C:\path\to\dsh-usage-stats-0.1.4.tgz
```

`dsh` CLI 是随 Desktop Beta 一起安装的（若 PATH 里没有，可在 Desktop 的
host-commands 目录找到 `dsh.cmd`）。命令会装入**当前激活的 profile**
（`%APPDATA%\DSH Desktop Beta\profile-selection\state.json` 里的 `active`，
Desktop 默认为 `desktop`）。装完**完全重启** Desktop，在“设置 → 插件”里出现“用量统计”标签页即成功。

> 更新到新版本：直接对新版本的 tgz 再执行一次 `dsh plugin add` 即可，**不要**先删旧 tgz——
> profile 的依赖清单以 `file:` 引用该 tgz，删除会让清单悬空、导致下一次安装报错。

### 方式二：源码本地打包

```powershell
cd dsh-usage-stats          # 若目录名带 -main 后缀请按实际名改
npm pack                    # 生成 dsh-usage-stats-<版本>.tgz
dsh plugin add .\dsh-usage-stats-<版本>.tgz
```

### 方式三：手工放入 profile（仅在无 CLI 时）

插件清单从**激活 profile** 目录读取（不是应用安装目录）。往
`%USERPROFILE%\.dsh\profiles\<激活profile>\node_modules\dsh-usage-stats` 拷入，并在该
profile 的 `package.json` 的 `dsh.profile.bundles` 数组里加入 `"dsh-usage-stats"`，再重启。
**不要**往应用安装目录（`resources\app\node_modules`）拷贝——那里的 `cordis.patch.yml` 不会被
应用，`dsh.client` 声明也不会被扫描。

> 注意：插件要求宿主为 0.1.0-rc.8 及以上（见 peerDependencies）；统计 API 直接挂在
> webServer 上、无鉴权，请勿将 `host` 配为 `0.0.0.0` 暴露到不受信任的网络。

## API

- `GET /api/usage-stats` — 全量汇总统计（含 `rollingDailyTrend` 滚动 24h 趋势；自 v0.1.3 起
  `sessions` 为精简行：id/title/createdAt/live/persisted/turns/steps/llmMs/toolMs/totalTokens，
  `summary.maxSessionLlmMs` 为最长会话 LLM 时长）
- `GET /api/usage-stats/session?id=xxx` — 单会话完整统计（stats/tokenUsage/contextBreakdown/modelUsage，含时间戳）

## 开发

```bash
npm test   # 运行单元测试（Node 内置 test runner，无需额外依赖；亦可用 pnpm test）
```

说明：`lib/client.js` 是手工维护的客户端 bundle（既是源也是产物，改动直接编辑它）；
`lib/fold.js` 为纯函数折叠层，`store/backfill` 为增量账本与回填。

## 许可

MIT