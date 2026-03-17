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

### 用户反馈触发

- 桌面宠物收到用户的状态反馈，写入 `~/.创业狗/user-response.json`
- Skill 检测到该文件后触发安慰话语生成

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
# 每小时整点：执行完整状态检测
0 * * * *  → 执行本 Skill 的"操作流程 A"

# 每 5 分钟：检查用户反馈（轻量）
*/5 * * * *  → 检查 ~/.创业狗/user-response.json 是否有未处理的反馈
              如有，执行本 Skill 的"操作流程 B"
```

**具体方式：** 使用 OpenClaw 提供的 Cron API 或配置文件来注册。如果 OpenClaw 暂不支持细粒度 Cron，则将"每 5 分钟检查反馈"合并到心跳检查中。

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

### Step 7: 触发关爱消息

当满足以下任一条件时，通过飞书私聊发送关爱消息：

- `energy < 30`（能量过低，用户处于疲惫状态）
- `emotion_score < -0.4`（LLM 检测到明显负面情绪）
- `energy` 从上次的 50+ 降到了 30 以下（急剧下降，提前预警）

关爱消息使用 LLM 情绪分析中返回的 `comfort_message` 字段。同时在 `status.json` 中设置 `"comfort_trigger": true`。

**注意：** 不强制用户休息，仅出言安慰。创业者知道自己累，狗狗只是陪伴和提醒。

### Step 8: 清理已处理数据

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

## 操作流程 B：用户反馈触发

当桌面宠物检测到用户选择后，会写入 `~/.创业狗/user-response.json`：

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

输入：用户选择 + work_summary + active_hours + emotion_score

### Step 4: 写入安慰话语

将生成的安慰话语写入 `~/.创业狗/comfort-message.json`：

```json
{
  "timestamp": "2026-03-17T15:30:05+08:00",
  "comfort_text": "你这一小时处理了 3 个 PR 还修了登录 bug，辛苦了！站起来活动一下吧？🐾",
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
# 每小时整点：完整状态检测（拉飞书消息 + LLM 分析 + 计算能量）
0 * * * * openclaw skill run caring-startup-dog --flow=cron

# 每 15 分钟：轻量能量更新（只读 activity.jsonl，快速更新 energy，不调 LLM）
*/15 * * * * openclaw skill run caring-startup-dog --flow=energy-update

# 每 5 分钟：检查用户反馈（只检测文件是否存在）
*/5 * * * * openclaw skill run caring-startup-dog --flow=response-check
```

### 操作流程 C：每 15 分钟轻量能量更新

这是一个极轻量的流程，不调用飞书 API 和 LLM，仅：

1. 读取 `~/.创业狗/activity.jsonl` 最近 15 分钟的条目
2. 读取当前 `~/.创业狗/status.json` 的 `energy` 值
3. 根据编码活动量（prompt 数、session 时长）微调 energy：
   - 每个 prompt 消耗 0.5 点
   - 每个活跃的 15min 区间消耗 3 点
   - 15min 内无任何活动 → energy 恢复 5 点（最高 100）
4. 写回 `status.json`（只更新 `energy` 和 `last_update` 字段）

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
