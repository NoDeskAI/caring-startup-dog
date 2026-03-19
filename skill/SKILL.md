---
name: caring-startup-dog
description: >
  关爱创业狗——每小时自动检测用户的飞书消息、Cursor 和 Claude Code 编码活动，
  分析工作状态和情绪，驱动桌面宠物动画，必要时通过飞书私聊发送关爱消息。
  当用户说"检查状态"、"我的狗怎么样了"、"帮我分析工作状态"时使用。
allowed-tools: Bash, Feishu
---

# 关爱创业狗 Skill

## 什么时候用

### 自动触发（Cron 每小时）

通过 OpenClaw Cron 每小时执行一次完整的状态检测流程。

### 手动触发

- 用户说"检查状态"、"我的狗怎么样了"
- 用户说"帮我分析工作状态"、"看看我的工作压力"

### 用户触发"在干嘛"（需求 A：被看见）

- 桌面宠物直接通过 `openclaw agent --agent main --message "..."` 触发操作流程 B
- Agent 读取 `~/.创业狗/user-response.json` 中的 `llm_context`，生成工作陪伴反馈并写入 `~/.创业狗/comfort-message.json`
- 桌面宠物监听该文件变化后弹出气泡（无需 Cron 中转）

### 用户触发"摸摸头"（需求 B：被抽离）

- 桌面宠物从本地 `~/.创业狗/fun-pool.json` 随机抽取一条有趣短文本，零延迟显示
- 不调用 LLM，不走 Cron，不走操作流程 B
- fun-pool 由每小时 Cron（操作流程 A Step 8）预生成并刷新

## 前置检查

**⚠️ 每次执行前必须检查**

1. 确认飞书已授权（`/feishu auth` 状态正常）
2. 确认 `~/.创业狗/` 目录存在
3. 确认多维表格已创建（表 ID 存储在 `~/.创业狗/config.json` 中）
4. 如果 `config.json` 不存在 → 首次运行，执行初始化流程

### 首次初始化

按以下顺序**全部**执行，任何步骤失败都应向用户报告并停止。

#### Step 1: 创建数据目录

```bash
mkdir -p ~/.创业狗
```

#### Step 2: 安装 Cursor / Claude Code Hooks

运行 Skill 自带的安装脚本，将编码活动自动记录到 `~/.创业狗/activity.jsonl`：

```bash
bash "$(dirname "$0")/../scripts/install-hooks.sh"
```

安装后验证：
- 检查 `~/.cursor/hooks.json` 中包含 `activity-logger.sh`
- 检查 `~/.claude/settings.json` 中包含 `activity-logger.sh`

如果用户未安装 Cursor 或 Claude Code，对应项跳过即可，不影响整体功能。

#### Step 3: 创建飞书多维表格

在用户飞书空间创建多维表格"创业狗状态记录"，包含以下字段：
- `user_id`（文本）、`user_name`（文本）、`timestamp`（日期）
- `status_emoji`（文本）、`dog_state`（文本）
- `msg_count`（数字）、`emotion_score`（数字）、`active_hours`（数字）
- `work_summary`（文本）、`is_public`（复选框，默认 false）
- `detail`（文本）

#### Step 4: 保存配置

将表 ID 和用户信息保存到 `~/.创业狗/config.json`：

```json
{
  "bitable_app_token": "<app_token>",
  "bitable_table_id": "<table_id>",
  "feishu_user_id": "<user_id>",
  "check_interval_hours": 1,
  "ask_interval_hours": 2
}
```

#### Step 5: 配置 Cron 定时任务

通过 OpenClaw 的 Cron 机制注册两个定时任务：

```
# 每 10 分钟：数据采集（操作流程 C）
*/10 * * * *  → 读取 activity.jsonl + 飞书消息计数，写 status.json

# 每小时整点：完整分析（操作流程 A）
0 * * * *     → LLM 情绪分析 + 无条件写 comfort-message.json 让狗说一句自言自语
```

**用户反馈（摸头）** 不需要 Cron——桌面宠物直接通过 `openclaw agent` 调用操作流程 B。

#### Step 6: 安装桌面宠物（推荐）

运行 Skill 自带的桌面宠物安装脚本：

```bash
bash "$(dirname "$0")/../scripts/install-desktop-pet.sh"
```

此脚本会自动从 GitHub Releases (https://github.com/NoDeskAI/caring-startup-dog/releases) 下载最新的 macOS 桌面宠物应用并安装到 `/Applications`。

**要求：** macOS + Apple Silicon (M1/M2/M3/M4)。如果用户环境不满足，跳过此步骤并告知用户。

#### Step 7: 验证

初始化完成后，依次验证：
1. `~/.创业狗/config.json` 存在且字段完整
2. `~/.cursor/hooks.json` 或 `~/.claude/settings.json` 至少有一个包含 `activity-logger.sh`
3. Cron 任务已注册（通过 `openclaw cron list` 确认两条任务都存在）
4. `/Applications/创业狗.app` 存在（如果执行了 Step 6）

全部通过后告诉用户："创业狗初始化完成！你的像素狗已准备就绪。"

### Cron 注册验证与自动修复

桌面宠物每次启动时会自动执行以下检查：

1. **status.json 新鲜度检查**：`last_update` 距今是否 < 15 分钟
2. **Cron 任务注册检查**：通过 `openclaw cron list` 确认 `data-collect`（*/10）和 `cron`（0 *）两条任务存在
3. 如果任一检查失败 → 自动调用 OpenClaw 重新注册 Cron 并执行一次 data-collect
4. 修复结果写入 `~/.创业狗/cron-verified.json`：

```json
{
  "verified": true,
  "timestamp": "2026-03-17T15:00:00+08:00",
  "tasks": ["data-collect", "cron"]
}
```

**用户手动修复**：右键菜单 →"修复连接"可随时手动触发此检查流程。

**自动修复仍失败时**：桌面宠物通过气泡告知用户"OpenClaw 可能没有启动"，引导用户检查 OpenClaw 进程。

## 操作流程 A：Cron 每小时触发

> **执行原则：** 本流程分为 3 个阶段，每个阶段都是独立的。即使某个阶段失败，也要继续执行后续阶段，最后写入心跳文件记录完成情况。

### 阶段一：数据采集（不调 LLM）

1. 读取 `~/.创业狗/activity.jsonl` 中过去 1 小时的编码活动
2. 使用飞书消息搜索 API 拉取过去 1h 的消息（文本 + 发送者 + 时间戳 + 群聊）
3. 合并时间线，计算 `active_hours`（连续工作时长，允许 30min gap）
4. 计算 `msg_count_1h`、`prompt_count_1h`

如果飞书 API 失败，仅使用本地 activity 数据继续，不要中断。

### 阶段二：LLM 分析（单次调用）

使用 `prompts/emotion-analysis.md` 模板，**一次 LLM 调用**产出所有字段：

```json
{
  "emotion_score": 0.0,
  "emotion_label": "neutral",
  "stress_signals": [],
  "work_summary": "...",
  "hover_text": "...",
  "daily_narrative": "...",
  "comfort_message": "...",
  "fun_pool": ["...", "...", "...", "...", "..."]
}
```

**如果 LLM 调用失败**，使用降级值继续：
```json
{
  "emotion_score": 0,
  "emotion_label": "neutral",
  "work_summary": null,
  "hover_text": "走走走~",
  "daily_narrative": null,
  "comfort_message": "走了一会儿~",
  "fun_pool": ["嘿嘿嘿嘿嘿", "刚才偷偷打了个哈欠", "地上有个影子...是我的尾巴", "你知道吗，蜗牛有四个鼻子", "*翻肚皮*"]
}
```

### 阶段三：文件写入（全部完成后集中写入）

LLM 输出拿到后（或使用降级值后），**依次写入以下文件**。每个文件写入失败不影响后续文件。

**3a. 写入 `~/.创业狗/status.json`**（合并到现有内容）：

```json
{
  "last_update": "<当前 ISO 时间>",
  "emotion_score": <来自 LLM>,
  "msg_count_1h": <来自阶段一>,
  "prompt_count_1h": <来自阶段一>,
  "active_hours": <来自阶段一>,
  "work_summary": <来自 LLM>,
  "hover_text": <来自 LLM>,
  "daily_narrative": <来自 LLM>,
  "feishu_ok": <飞书 API 是否成功>,
  "coin_ready": true
}
```

**3b. 写入 `~/.创业狗/comfort-message.json`**（无条件写入，让狗每小时说一句话）：

```json
{
  "timestamp": "<当前 ISO 时间>",
  "comfort_text": <来自 LLM comfort_message>,
  "choice": "hourly",
  "ttl_seconds": 15
}
```

如果 `emotion_score < -0.4`，同时通过飞书私聊发送 `comfort_message`。

**3c. 写入 `~/.创业狗/fun-pool.json`**（整体替换）：

```json
<来自 LLM fun_pool，恰好 5 条字符串>
```

**3d. 凌晨 4 点时额外写入 `~/.创业狗/daily-schedule.json`**：

仅当当前小时 == 4 时执行。生成 3 个随机狗信触发时间：
- 分布在 9:00-22:00，相邻间隔 ≥ 2h，避开 12:00-13:00

```json
{
  "date": "<今日日期>",
  "dog_mail_times": ["10:23", "14:47", "19:05"],
  "dog_mail_sent": [false, false, false],
  "diary_sent": false
}
```

**3e. 清理 `~/.创业狗/activity.jsonl`**（保留最近 2 小时的条目）。

### 阶段四：写入心跳（最后一步，必须执行）

**无论前面哪些步骤成功或失败**，最后都要写入 `~/.创业狗/cron-heartbeat.json`：

```json
{
  "ts": "<当前 ISO 时间>",
  "flow": "hourly",
  "status_written": true,
  "comfort_written": true,
  "funpool_written": true,
  "coin_ready_set": true,
  "llm_ok": true
}
```

其中每个 `*_written` / `*_ok` 字段反映该步骤是否实际成功。桌面宠物监听此文件来验证 cron 运行状态。

## 操作流程 B：用户"在干嘛"触发（需求 A：被看见）

> 用户在右键菜单中点击"在干嘛"时触发。这是"需求 A：被看见"——用户主动想回顾工作、想被陪伴。
> 注意："摸摸头"不走操作流程 B，它从本地 `fun-pool.json` 随机抽取短文本（需求 B：被抽离），零延迟，不调 LLM。

当桌面宠物检测到用户选择"在干嘛"后，会写入 `~/.创业狗/user-response.json`：

```json
{
  "timestamp": "2026-03-17T15:30:00+08:00",
  "choice": "a_bit_tired",
  "processed": false
}
```

### Step 1: 检测并读取用户反馈

```bash
RESPONSE_FILE="$HOME/.创业狗/user-response.json"
if [ -f "$RESPONSE_FILE" ]; then
  python3 -c "
import json
with open('$RESPONSE_FILE', 'r') as f:
    data = json.load(f)
if not data.get('processed', True):
    print(json.dumps(data, ensure_ascii=False))
"
fi
```

### Step 2: 读取最近的工作摘要

从 `~/.创业狗/status.json` 读取 `work_summary` 和 `active_hours` 字段。

### Step 3: LLM 生成安慰话语

使用 `prompts/comfort-response.md` 中的 Prompt 模板。

输入（优先使用 `llm_context`，如不存在则降级到旧字段）：
- `llm_context.work_mode`：当前工作模式（deep_coding / msg_overload / multitasking / steady / winding_down / resting）
- `llm_context.continuous_work_minutes`：连续工作分钟数
- `llm_context.recent_mood`：最近一次心情自报（score + label + minutes_ago）
- `llm_context.today_trend`：今日趋势（心情方向 + 总活跃时长 + 心情记录数）
- `llm_context.time_of_day`：时间段

**LLM 输出视角（核心原则）：狗是用户的创业伙伴**

狗不是旁观者，不是数据播报员，也不是心理咨询师。狗是陪着用户一起创业的伙伴，了解用户正在做什么，能给出有真实感染力的正能量动向汇报。

**代称规则（最重要）：**
| 代称 | 用在 | 效果 |
|------|------|------|
| **我们** | 共同经历的辛苦过程 | "我们已经调了好久的前端视觉了" — 用户感到不是一个人在扛 |
| **你** | 赞美、成就、鼓励 | "你真厉害" — 直接的认可和肯定 |
| **我们** | 休息/放松的提议 | "我们下去遛遛吧！" — 把休息变成一起做的事 |

注意：狗没有独立需求。不说"我饿了"、"我困了"、"带我去遛遛"。休息提议永远是"我们一起"。

**必须**提到 work_summary 中的具体工作内容，不要空泛。**飞书事务是第一优先级**（项目讨论、客户对接、团队协作），编码内容是第二优先级。

**绝对禁止：**
- 不纯数据堆砌（~~"发了35条消息。连续工作3小时。"~~）—— 数据可以提，但要搭配温度和成就感
- 不 PUA / 不唱衰（~~"你发了好多消息，注意休息"~~）
- 不说教 / 不强制休息（~~"注意身体"~~、~~"记得喝水"~~、~~"该休息了"~~）
- 不空泛（~~"加油"~~、~~"辛苦了"~~）
- 不用 emoji

**正确示例：**
- "我们已经调了好久的前端视觉了！！...你真厉害，我们下去遛遛吧！"
- "排期终于讨论完了！PR也review了两个，你今天推进了好多事情。我们要不要找别人玩会儿？"
- "登录超时那个bug我们一起抓了好久！你找到原因了吗？感觉快搞定了！"
- "我们写了好多代码...你今晚一直在拼呢。我们今晚拼够了，一起收工吧？"

**错误示例（绝对不能出现）：**
- ~~"你已经连续工作了3小时，休息一下吧"~~（说教）
- ~~"你很努力了，注意身体"~~（空泛 + 说教）
- ~~"盯了好久屏幕...眼睛酸酸的"~~（没有提到具体工作内容）
- ~~"今天发了87条消息。连续工作3小时。prompt写了20个。"~~（只有数据，没有温度）
- ~~"你发了好多消息，注意休息"~~（用数据 PUA）
- ~~"我饿了，带我去吃东西吧"~~（狗没有独立需求）

### Step 4: 写入安慰话语

将生成的安慰话语写入 `~/.创业狗/comfort-message.json`：

```json
{
  "timestamp": "2026-03-17T15:30:05+08:00",
  "comfort_text": "跑了好久...腿有点酸了，能不能坐下来歇一会儿？",
  "choice": "a_bit_tired",
  "ttl_seconds": 15
}
```

桌面宠物监听此文件，显示气泡 `ttl_seconds` 秒后自动消失。

### Step 5: 飞书私聊推送

如果 `recent_mood.score < -0.3`，同时通过飞书私聊发送安慰话语。

### Step 6: 标记已处理

将 `user-response.json` 中的 `processed` 设为 `true`。

## Cron 配置

```
# 每 10 分钟：数据采集（读 activity.jsonl + 飞书消息计数，写 status.json）
*/10 * * * * openclaw skill run caring-startup-dog --flow=data-collect

# 每小时整点：完整分析 + LLM 自言自语 + fun-pool 刷新
# （无条件写 comfort-message.json + fun-pool.json，让狗每小时说一句话 + 准备 5 条摸头内容）
0 * * * * openclaw skill run caring-startup-dog --flow=cron
```

**交互触发说明：**
- **"在干嘛"**（需求 A）不经过 Cron——桌面宠物直接通过 `openclaw agent` 触发操作流程 B，写入 `comfort-message.json` 后由 watcher 检测并弹出气泡。
- **"摸摸头"**（需求 B）不调 LLM——桌面宠物从本地 `fun-pool.json` 随机抽取一条，零延迟弹出气泡。

### 操作流程 C：每 10 分钟数据采集

轻量流程，不调用 LLM，但采集飞书消息和编码活动：

1. 读取 `~/.创业狗/activity.jsonl` 最近 10 分钟的条目
2. 使用飞书 API 拉取最近 10 分钟的新消息数量（仅计数，不做内容分析）
3. 写回 `status.json`，包含以下字段：
   - `msg_count_1h`、`prompt_count_1h`、`active_hours`、`last_update`
   - `feishu_ok`（布尔值）：飞书 API 调用成功写 `true`，授权失败或请求报错写 `false`。桌面宠物据此显示飞书连接状态指示灯

桌面宠物会监听 `status.json` 变化，自动将每个快照写入本地 `work_snapshot` 表，用于日报叙事和 LLM 上下文。

4. **飞书狗信检查**：读取 `~/.创业狗/daily-schedule.json`，检查当前时间是否命中某个 `dog_mail_times` 且对应 `dog_mail_sent` 为 `false`（容差 ±5 分钟）。命中则：
   - 调用 LLM 生成狗的话（使用 `prompts/dog-mail.md` 模板，基于当前工作数据）
   - 通过飞书私聊发送，格式："你的狗刚拜托我告诉你：{狗的话}"
   - 将对应 `dog_mail_sent` 项设为 `true`

5. **日终日记推送**：如果当前时间 > 21:00 且 `daily-schedule.json` 中 `diary_sent` 为 `false` 且今日有活跃数据（`active_hours > 0`），则：
   - 调用 LLM 生成狗视角的一天回顾（使用 `prompts/daily-diary.md` 模板）
   - 通过飞书私聊发送，格式："你的狗写了今天的日记：\n\n{日记内容}\n\n今天收集了 X 枚金币"
   - 将 `diary_sent` 设为 `true`

## LLM 生成的两个维度

LLM 生成安慰文案时，综合两个维度来决定语气和内容：

1. **用户自报心情**（1-5 滑动条）：用户当下的主观感受，决定语气的轻重
2. **客观工作数据**（飞书消息 + 编码活动 + 连续工作时长）：用户这段时间具体在做什么，决定内容的实质

这不是一个计算公式——不需要输出数值、分数或等级。这两个维度是给 LLM 的上下文，让它像一个了解你工作情况的朋友那样说话。

### 狗的动画

动画完全由用户自报心情决定，与工作数据无关：

| 心情 | dog_state | Benvictus 动画 |
|------|-----------|---------------|
| 5 | `running` | Run (row 3) |
| 4 | `walking` | Walk (row 4) |
| 3 | `a_bit_tired` | Sit (row 1) |
| 2 | `exhausted` | Lie Down (row 2) |
| 1 | `tired` | Sleep (row 8) |
| 特殊 | `asking` | Idle (row 0) |

## 错误处理

| 错误 | 处理 |
|------|------|
| 飞书未授权 | 提示用户执行 `/feishu auth` |
| `activity.jsonl` 不存在 | 正常情况（未安装 Hooks），仅使用飞书数据 |
| LLM 调用失败 | 跳过情绪分析，使用纯数值指标（消息量+时长）判断状态 |
| 多维表格写入失败 | 重试 1 次，仍失败则仅更新本地 status.json |
| `user-response.json` 格式错误 | 删除文件并忽略 |

## 隐私说明

- 所有消息内容仅用于实时分析，不持久化保存原文
- 多维表格只记录统计数据和摘要，不包含任何消息原文
- `activity.jsonl` 中的 prompt 文本截断到 500 字符，每 2 小时清理
- 关爱消息仅通过私聊发送，不在任何群聊中出现
