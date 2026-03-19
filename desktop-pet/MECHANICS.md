# 创业狗 - 当前机制总览

## 交互

| 操作 | 触发方式 | 效果 |
|------|---------|------|
| 左键点击狗 | hit area 内单击 | 弹出 **MoodSlider**（心情 1-5 档），记录到 DB |
| 右键点击狗 | hit area 内右键 | 弹出 **ContextMenu**（摸摸头 / 在干嘛 / 日记 / 换皮肤） |
| 拖拽狗 | hit area 内按住移动 > 4px | 移动窗口，Rust 侧自动约束屏幕边界 |
| 悬停狗 | 鼠标进入 hit area 400ms | 显示 **StatusBubble**（hover_text 或状态标签） |

## 右键菜单选项

| 选项 | 行为 |
|------|------|
| 摸摸头 | 从 `fun-pool.json` 随机取一条无关工作的趣味文案，立即显示气泡（需求B：被抽离） |
| 在干嘛 | 调用 OpenClaw LLM 生成基于真实工作内容的伙伴式反馈，显示气泡（需求A：被看见） |
| 今天的日记 | 打开 **DailyReport** 面板，展示当天叙事 + 心情时间线 |
| 换皮肤 | 10 款像素狗皮肤切换 |

## 自动机制

| 机制 | 频率 | 逻辑 |
|------|------|------|
| **AskPanel 主动询问** | 每 2 小时 | 弹窗问"我现在..."，3 个选项（精力充沛/有点累/好困），选择后记入 DB |
| **status.json 监听** | 实时（file watch / 10s 轮询 fallback） | OpenClaw cron 写入的状态数据，更新 energy、work_summary、hover_text 等 |
| **comfort-message.json 监听** | 实时 | OpenClaw cron 写入的安慰消息，显示为气泡 |
| **连接状态刷新** | 每 1 分钟 | 根据 status.json 的 last_update 推算 OpenClaw/飞书连通性 |
| **work_snapshot 存储** | 每次 status.json 更新 | 将工作数据写入本地 SQLite，按 last_update 去重 |

## 状态决定

- **狗的动画** = 纯粹由用户心情（mood 1-5）决定，无能量上限
  - 5 → running（冲冲冲）
  - 4 → walking（走走走）
  - 3 → a_bit_tired（有点累）
  - 2 → resting（歇会儿）
  - 1 → sleeping（zzZ）
- **energy** 仅用于后台触发安慰消息和 cron 行为，不影响动画

## 日期边界

"今天"从**凌晨 4 点**算起。SQL 用 `date(ts,'-4 hours')` 偏移。

## 数据存储

| 位置 | 内容 |
|------|------|
| `~/.创业狗/status.json` | OpenClaw cron 输出：energy、消息数、工作摘要、hover_text、daily_narrative |
| `~/.创业狗/comfort-message.json` | OpenClaw 生成的安慰消息 |
| `~/.创业狗/fun-pool.json` | cron 预生成的 5 条趣味文案（摸摸头用） |
| `~/.创业狗/user-response.json` | AskPanel 用户选择，供 OpenClaw 读取 |
| `~/.创业狗/activity.jsonl` | Cursor/Claude Code hooks 写入的编码活动日志 |
| SQLite `dog.db` → `mood_log` | 心情记录（来源：user_click / ask_response） |
| SQLite `dog.db` → `work_snapshot` | 定期工作快照（energy、消息数、prompt 数、工作模式） |
| SQLite `dog.db` → `daily_summary` | 每日汇总（暂未使用） |

## 窗口穿透

- 默认：窗口可交互（不穿透）
- 鼠标离开 hit area → Rust `setIgnoresMouseEvents(YES)` 开启穿透
- 穿透模式下：每 80ms Rust 轮询全局光标位置（`NSEvent.mouseLocation`），检测是否回到 hit area
- 检测到回到 hit area → 关闭穿透，恢复交互
- 任何弹窗打开时 → 强制关闭穿透

## 连接指示器

左下角两个小点：
- **OC**（OpenClaw）：绿 = 20min 内有更新 / 黄 = 20min-1h / 红 = 超时或无文件
- **FS**（飞书）：绿 = 有飞书数据 / 红 = 无数据
