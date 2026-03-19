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
*/10 * * * *  → 读取 activity.jsonl + 飞书消息计数，更新 energy，写 status.json

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
3. Cron 任务已注册
4. `/Applications/创业狗.app` 存在（如果执行了 Step 6）

全部通过后告诉用户："创业狗初始化完成！你的像素狗已准备就绪。"

## 操作流程 A：Cron 每小时触发

### Step 1: 读取本地编码活动

```bash
# 读取 activity.jsonl 中过去 1h 的条目
ACTIVITY_FILE="$HOME/.创业狗/activity.jsonl"
if [ -f "$ACTIVITY_FILE" ]; then
  # 提取最近 1 小时的记录
  ONE_HOUR_AGO=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ")
  # 用 python 过滤时间范围
  python3 -c "
import json, sys
from datetime import datetime, timedelta, timezone

cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
records = []
with open('$ACTIVITY_FILE', 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            ts = datetime.fromisoformat(rec['ts'].replace('Z', '+00:00'))
            if ts >= cutoff:
                records.append(rec)
        except:
            continue

print(json.dumps(records, ensure_ascii=False, indent=2))
"
fi
```

### Step 2: 读取飞书消息

使用飞书消息搜索 API（`user_access_token`）拉取过去 1h 的消息：

- 使用 `/feishu search_messages` 接口
- 时间范围：过去 1 小时
- 包含用户发送和接收的所有消息
- 提取：消息文本、发送者、时间戳、所在群聊

### Step 3: 三源时间线合并

将飞书消息时间戳 + Cursor/CC session 时间 → 合并为统一活跃时间线：

```python
# 伪代码：合并活跃区间
intervals = []

# 飞书消息：每条消息视为 1 分钟活跃
for msg in feishu_messages:
    intervals.append((msg.timestamp, msg.timestamp + 60s))

# Cursor/CC sessions：完整区间
for rec in activity_records:
    if rec.event == "session_start":
        # 找到对应的 session_end
        intervals.append((rec.ts, session_end.ts))
    elif rec.event == "prompt":
        # 单个 prompt 视为 2 分钟活跃
        intervals.append((rec.ts, rec.ts + 120s))

# 合并重叠区间
merged = merge_overlapping(intervals)

# 计算连续工作时长（最大连续段，允许 30min gap）
active_hours = calculate_continuous_hours(merged, gap_threshold=30*60)
```

### Step 4: 计算能量值

根据多维信号计算用户的能量值（0-100），能量越低代表疲劳度越高：

```python
# 疲劳积分公式
fatigue_score = min(100,
    continuous_work_hours * 12      # 每连续工作 1h 消耗 12 点
    + (msg_count_1h / 10)           # 消息密度贡献
    + (prompt_count_1h / 5)         # 编码密度贡献
    + late_night_penalty            # 22:00-08:00 之间工作额外 +15
    - rest_recovery                 # 检测到 30min+ 无活动，恢复 20 点
)

energy = max(0, 100 - fatigue_score)
```

**疲劳度是一天内累加的**，不是每小时重置。需要读取上一次 `status.json` 中的 `energy` 值作为基数：

- 如果距离上次更新不超过 2h：在上次 energy 基础上继续消耗
- 如果超过 2h 无记录：视为用户休息了，energy 恢复到 min(上次energy + 30, 100)
- 每天首次检测（00:00-06:00 无记录）：重置 energy = 100

**能量阈值与桌面宠物行为映射**（桌面宠物端自行 resolve）：

| energy | 最高可用动画 | 含义 |
|--------|------------|------|
| >= 70  | energetic  | 精力充沛 |
| 50-69  | running    | 状态不错 |
| 30-49  | walking    | 开始疲劳 |
| 15-29  | a_bit_tired | 比较累了 |
| < 15   | exhausted  | 非常疲惫 |

### Step 5: LLM 情绪分析

将飞书消息 + Cursor/CC prompts 文本合并，调用 LLM 进行批量分析。

使用 `prompts/emotion-analysis.md` 中的 Prompt 模板。

**注意：** 每次只做 1 次 LLM 调用，控制成本。将所有文本拼成一个 batch 输入。

### Step 6: 写入状态

将分析结果双写到两个位置：

**本地状态文件 `~/.创业狗/status.json`：**

```json
{
  "energy": 65,
  "last_update": "2026-03-17T15:00:00+08:00",
  "emotion_score": -0.2,
  "msg_count_1h": 35,
  "prompt_count_1h": 12,
  "active_hours": 2.5,
  "work_summary": "处理了 2 个 PR review，修复了用户登录超时的 bug，和产品经理讨论了新功能排期",
  "comfort_trigger": false
}
```

**重要：** `energy` 是核心字段，桌面宠物读取此值结合用户自报心情来决定狗的最终动画。不再直接写 `dog_state`——动画由桌面宠物端根据双轴模型自行 resolve。

**飞书多维表格：** 追加一条新记录（可选，每日同步即可）。

### Step 7: 狗的自言自语（无条件）

每小时分析完成后，**无条件**写入 `~/.创业狗/comfort-message.json`，让狗说一句自言自语。这是陪伴感的核心——狗不是只有你累了才出来说话，而是一直在。

安慰话语使用 LLM 生成，以**伙伴狗视角**表达（同操作流程 B Step 3 的代称规则：我们/你/我，必须提到具体工作内容）。

```json
{
  "timestamp": "2026-03-17T15:00:05+08:00",
  "comfort_text": "走了好久~不快不慢的，挺舒服",
  "choice": "hourly",
  "ttl_seconds": 15
}
```

**额外飞书推送**：仅当 `energy < 30` 或 `emotion_score < -0.4` 时，同时通过飞书私聊发送。

**注意：** 狗不"提醒"用户休息。狗只是表达自己的状态——"好困..."、"腿酸酸的..."——用户自己会做出判断。

### Step 8: 写入 fun-pool（摸头内容池）

LLM 输出的 `fun_pool` 字段是一个 5 条短文本的数组，用于用户"摸摸头"时零延迟显示。写入 `~/.创业狗/fun-pool.json`，**整体替换**（不累积）：

```json
[
  "刚才偷偷咬了一下你的鞋带...被发现了",
  "你知道吗，章鱼有三个心脏",
  "窗外那朵云...好像一只鸡腿",
  "下午的阳光晒到尾巴了，暖暖的",
  "*翻肚皮* 再摸！"
]
```

这些文本**与工作完全无关**——是"需求 B：被抽离"的核心载体。用户摸头 = "我想暂时离开一下"，产品尊重这个信号。每小时刷新一次，是"又工作了一小时"的小奖励。

### Step 9: 清理已处理数据

```bash
# 保留最近 2 小时的数据，清理更早的
python3 -c "
import json
from datetime import datetime, timedelta, timezone

cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
kept = []
with open('$HOME/.创业狗/activity.jsonl', 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            ts = datetime.fromisoformat(rec['ts'].replace('Z', '+00:00'))
            if ts >= cutoff:
                kept.append(line)
        except:
            continue

with open('$HOME/.创业狗/activity.jsonl', 'w') as f:
    f.write('\n'.join(kept) + '\n' if kept else '')
"
```

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
- 不纯数据堆砌（~~"发了35条消息。能量65。"~~）—— 数据可以提，但要搭配温度和成就感
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
- ~~"今天发了87条消息。能量65。连续工作3小时。"~~（只有数据，没有温度）
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

如果用户选了 `a_bit_tired` 或 `exhausted`，同时通过飞书私聊发送安慰话语。

### Step 6: 标记已处理

将 `user-response.json` 中的 `processed` 设为 `true`。

## Cron 配置

```
# 每 10 分钟：数据采集 + 能量更新（读 activity.jsonl + 飞书消息，计算 energy，写 status.json）
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
3. 读取当前 `~/.创业狗/status.json` 的 `energy` 值
4. 根据活动量微调 energy：
   - 每个 prompt 消耗 0.5 点
   - 每个活跃的 10min 区间消耗 2 点
   - 消息密度 > 10 条/10min 额外消耗 3 点
   - 10min 内无任何活动 → energy 恢复 3 点（最高 100）
   - 22:00-08:00 工作额外消耗 +5
5. 写回 `status.json`（更新 `energy`、`msg_count_1h`、`prompt_count_1h`、`active_hours`、`last_update` 字段）

桌面宠物会监听 `status.json` 变化，自动将每个快照写入本地 `work_snapshot` 表，用于日报叙事和 LLM 上下文。

## 双轴模型：能量 + 心情

桌面宠物的最终动画由两个轴共同决定：

- **用户心情**（1-5 滑动条）：用户主观自报，决定狗"想要"的动画
- **能量值**（0-100，Skill 计算）：客观工作疲劳，决定狗"能达到"的最高动画

**最终动画 = min(心情对应动画, 能量允许的最高动画)**

### 心情 → 期望动画映射

| 心情档位 | 期望动画 |
|---------|---------|
| 5 (很好) | energetic |
| 4 (还不错) | running |
| 3 (一般) | walking |
| 2 (不太好) | a_bit_tired |
| 1 (非常差) | exhausted |

### 能量 → 动画上限

| energy 范围 | 最高可用动画 | 活力等级 |
|-----------|------------|---------|
| >= 70     | energetic  | 5       |
| 50-69     | running    | 4       |
| 30-49     | walking    | 3       |
| 15-29     | a_bit_tired | 2      |
| < 15      | exhausted  | 1       |

### 动画编码表

| dog_state   | 含义         | Benvictus 动画   | 活力等级 | 能量阈值 |
|-------------|-------------|------------------|---------|---------|
| `energetic` | 动力满满     | Stand (row 7)    | 5       | >= 70   |
| `running`   | 状态好在冲   | Run (row 3)      | 4       | >= 50   |
| `walking`   | 有点累了     | Walk (row 4)     | 3       | >= 30   |
| `a_bit_tired` | 比较累了   | Sit (row 1)      | 2       | >= 15   |
| `exhausted` | 非常疲惫     | Lie Down (row 2) | 1       | 任何     |
| `tired`     | 该休息了     | Sleep (row 8)    | 1       | 任何     |
| `asking`    | 等待用户反馈 | Idle (row 0)     | 特殊     | 任何     |

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
