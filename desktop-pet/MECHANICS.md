# 创业狗 - 当前机制总览

## 交互

| 操作 | 触发方式 | 效果 |
|------|---------|------|
| 左键点击狗 | hit area 内单击 | 弹出 **MoodSlider**（心情 1-5 档），记录到 DB |
| 右键点击狗 | hit area 内右键 | 弹出 **ContextMenu**（金币数 / 摸摸头 / 在干嘛 / 日记 / 换皮肤 / 修复连接） |
| 拖拽狗 | hit area 内按住移动 > 4px | 移动窗口，Rust 侧自动约束屏幕边界 |
| 悬停狗 | 鼠标进入 hit area 400ms | 显示 **StatusBubble**（hover_text 或状态标签） |
| 点击金币 | 金币区域内单击 | 收集金币 → 触发 LLM 文案 + 计数存入 DB |

**判定区域 (hit area):** 200×160px，居中偏下（覆盖狗身体核心区域，不干扰周围窗口操作）

## 弹窗关闭机制

所有弹窗/气泡均使用**全屏不可见遮罩层**实现点击空白关闭：

| 弹窗 | z-index | 遮罩层 z-index | 关闭方式 |
|------|---------|---------------|---------|
| ContextMenu | 500 | 499 | 点击遮罩 |
| MoodSlider | 300 | 299 | 点击遮罩 |
| AskPanel | 300 | 299 | 点击遮罩 |
| ComfortBubble | 200 | 199 | 点击遮罩 / 自动 12s 消失 |
| DailyReport | 400 | 399 | 点击遮罩 |
| StatusBubble | 100 | — | 鼠标离开 hit area 自动消失 |

> 透明窗口下 `window.addEventListener("pointerdown")` 不可靠，因此统一使用遮罩层模式。

## 右键菜单选项

| 选项 | 行为 |
|------|------|
| 金币数 | 显示当前累计金币数量（仅展示，不可操作） |
| 摸摸头 | 从 `fun-pool.json` 随机取一条无关工作的趣味文案，立即显示气泡（需求B：被抽离） |
| 在干嘛 | 调用 OpenClaw LLM 生成基于真实工作内容的伙伴式反馈，显示气泡（需求A：被看见） |
| 今天的日记 | 打开 **DailyReport** 面板，展示当天叙事 + 心情时间线（滚动条隐藏） |
| 换皮肤 | 10 款像素狗皮肤切换，未解锁灰色显示（5 金币解锁一个，hover 可预览） |
| 修复连接 | 手动触发 cron 健康检查与修复 |

## 金币系统

| 机制 | 说明 |
|------|------|
| 掉落触发 | 每小时 cron 将 `status.json` 中 `coin_ready` 设为 `true` |
| 掉落表现 | 桌面监听到 `coin_ready: true` → 像素金币图片从画面上方弹跳掉落（呼吸动画） |
| 收集 | 用户点击金币 → 缩小消失动画 + LLM 文案气泡 + 金币 +1 存入 `coin_log` |
| 防重复 | 点击瞬间立即写 `coin_ready: false` 到 status.json，防止 file watcher 竞态导致重复弹出 |
| 离线攒币 | 桌面没打开时 `coin_ready: true` 一直留着，下次打开掉 1 枚（不累积多枚） |
| 皮肤解锁 | 每 5 金币可解锁 1 个锁定皮肤。初始解锁：01/04/08/09 |
| 点击区域 | 72×72px，中心对准金币渲染位置 (260, 370)，`onPointerDown stopPropagation` 防拖拽干扰 |

## 飞书狗信

| 机制 | 说明 |
|------|------|
| 预生成 | 每天凌晨 4 点 cron 生成 3 个随机时间写入 `daily-schedule.json` |
| 时间规则 | 分布在 9:00-22:00，相邻间隔 ≥ 2h，避开 12:00-13:00 |
| 触发 | 每 10 分钟 cron 检查时间命中（±5min 容差） |
| 发送 | 调用 LLM 生成狗的话 → 飞书私聊："你的狗刚拜托我告诉你：{内容}" |

## 日终日记

| 机制 | 说明 |
|------|------|
| 触发条件 | 当前时间 > 21:00 + 今日有活跃数据 + 当日未发过日记 |
| 发送 | LLM 生成狗视角的一天回顾 → 飞书私聊："你的狗写了今天的日记：\n{内容}\n今天收集了 X 枚金币" |

## 自动机制

| 机制 | 频率 | 逻辑 |
|------|------|------|
| **AskPanel 主动询问** | 每 2 小时 | 弹窗问"我现在..."，3 个选项（精力充沛/有点累/好困），选择后记入 DB |
| **status.json 监听** | 实时（file watch / 10s 轮询 fallback） | OpenClaw cron 写入的状态数据，更新 work_summary、hover_text、coin_ready 等 |
| **comfort-message.json 监听** | 实时 | OpenClaw cron 写入的安慰消息，显示为气泡 |
| **连接状态刷新** | 每 1 分钟 | 根据 status.json 的 last_update 推算 OpenClaw/飞书连通性 |
| **work_snapshot 存储** | 每次 status.json 更新 | 将工作数据写入本地 SQLite，按 last_update 去重 |
| **金币掉落** | 每小时 cron 后 | 监听 `coin_ready: true` → 触发 Phaser 金币掉落动画 |
| **Cron 健康检测** | 启动时 + 每 15 分钟 | 检查心跳和 status.json 新鲜度 → 过期则自动修复 |

## Cron 可靠性保障

### 两个 cron 任务

| 任务 | 频率 | 超时 | 用途 |
|------|------|------|------|
| 创业狗-数据采集 | 每 10 分钟 | 120s | 读 activity.jsonl + 飞书消息计数，写 status.json |
| 创业狗-完整分析 | 每小时整点 | **600s** | 完整 LLM 分析 + 写 status/comfort/fun-pool/heartbeat |

### 小时 cron 架构（操作流程 A）

小时 cron 分为 4 个独立阶段，每个阶段失败不影响后续：

| 阶段 | 内容 | 失败策略 |
|------|------|---------|
| 阶段一 | 数据采集（activity + 飞书消息） | 飞书失败仅用本地数据 |
| 阶段二 | 单次 LLM 调用（产出 emotion + comfort + fun_pool） | LLM 失败使用降级值 |
| 阶段三 | 集中写入 5 个文件 | 单个文件失败不影响其他 |
| 阶段四 | 写入 `cron-heartbeat.json` | **必须执行**，记录各步骤成功/失败 |

### 心跳文件 `~/.创业狗/cron-heartbeat.json`

```json
{"ts": "...", "flow": "hourly", "llm_ok": true, "funpool_written": true, ...}
```

> 注：历史版本可能用 `timestamp` 而非 `ts`，前端兼容两种字段名。

### 前端检测机制

| 环节 | 机制 |
|------|------|
| 启动检测 | 启动 10 秒后检查 heartbeat 和 status.json 新鲜度 |
| 周期检测 | 每 15 分钟检查一次，heartbeat > 75min 或 status > 25min 视为过期 |
| 自动修复 | 检测到过期 → 直接用 `openclaw cron list --json` 查状态 → `openclaw cron edit --enable` 启用 → `openclaw cron run` 触发执行 |
| 修复确认 | 同时轮询 heartbeat 和 status.json，任一更新即视为修复成功（最长等 ~6 分钟） |
| 手动修复 | 右键菜单 →"修复连接"→ 手动触发修复 |
| 修复反馈 | 修复成功/失败通过气泡通知用户 |

> 修复函数使用直接 `openclaw cron` 命令，不再通过 `openclaw agent` 间接操作。

## 状态决定

- **狗的动画** = 纯粹由用户心情（mood 1-5）决定
  - 5 → running（冲冲冲）
  - 4 → walking（走走走）
  - 3 → a_bit_tired（有点累）
  - 2 → resting（歇会儿）
  - 1 → sleeping（zzZ）
- 无 energy 计算。工作数据（消息数、prompt 数、连续工作时长）仅作为 LLM 生成安慰文案的上下文

## 日期边界

"今天"从**凌晨 4 点**算起。SQL 用 `date(ts,'-4 hours')` 偏移。

## 数据存储

| 位置 | 内容 |
|------|------|
| `~/.创业狗/status.json` | OpenClaw cron 输出：消息数、prompt 数、工作摘要、hover_text、coin_ready |
| `~/.创业狗/weather.json` | cron 每小时从 wttr.in 抓取的天气预报（当前 + 未来 3 条 3h 预报） |
| `~/.创业狗/comfort-message.json` | OpenClaw 生成的安慰消息 |
| `~/.创业狗/fun-pool.json` | cron 预生成的 5 条趣味文案（摸摸头用） |
| `~/.创业狗/daily-schedule.json` | 当日狗信时间表 + 日记推送标记 |
| `~/.创业狗/user-response.json` | AskPanel 用户选择，供 OpenClaw 读取 |
| `~/.创业狗/cron-heartbeat.json` | 每小时 cron 执行完毕后写入的心跳（ts + 各步骤成功/失败） |
| `~/.创业狗/activity.jsonl` | Cursor/Claude Code hooks 写入的编码活动日志 |
| SQLite `dog.db` → `mood_log` | 心情记录（来源：user_click / ask_response） |
| SQLite `dog.db` → `work_snapshot` | 定期工作快照（消息数、prompt 数、工作模式、工作摘要） |
| SQLite `dog.db` → `coin_log` | 金币获取记录（时间戳 + 来源 hourly/bonus） |
| SQLite `dog.db` → `skin_unlock` | 皮肤解锁记录（skin_id + 解锁时间） |
| SQLite `dog.db` → `daily_summary` | 每日汇总（暂未使用） |

## 窗口穿透

- 默认：窗口可交互（不穿透）
- 鼠标离开 hit area → Rust `setIgnoresMouseEvents(YES)` 开启穿透
- 穿透模式下：每 80ms Rust 轮询全局光标位置（`NSEvent.mouseLocation`），检测是否回到 hit area
- 检测到回到 hit area → 关闭穿透，恢复交互
- 任何弹窗打开时 → 强制关闭穿透

## 连接指示器

hover 狗时在左脚旁出现两个竖排小圆点（4px），离开时隐藏：
- **上方点**（OC / OpenClaw）：绿 = 12min 内有 cron 更新 / 黄 = 12-25min / 红 = 超过 25min 或无文件
- **下方点**（FS / 飞书）：绿 = cron 报告 `feishu_ok: true` / 红 = 飞书 API 失败或无数据
