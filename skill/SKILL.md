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

### Step 4: 决定狗狗状态

根据连续工作时长映射狗狗基础动画：

- `active_hours < 1` → `running`（状态好，在冲）
- `1 <= active_hours < 3` → `walking`（开始疲劳）
- `active_hours >= 3` → `tired`（需要休息）

### Step 5: LLM 情绪分析

将飞书消息 + Cursor/CC prompts 文本合并，调用 LLM 进行批量分析。

使用 `prompts/emotion-analysis.md` 中的 Prompt 模板。

**注意：** 每次只做 1 次 LLM 调用，控制成本。将所有文本拼成一个 batch 输入。

### Step 6: 写入状态

将分析结果双写到两个位置：

**本地状态文件 `~/.创业狗/status.json`：**

```json
{
  "user": "用户名",
  "last_update": "2026-03-17T15:00:00+08:00",
  "dog_state": "walking",
  "emotion_score": -0.2,
  "emotion_label": "neutral",
  "msg_count_1h": 35,
  "prompt_count_1h": 12,
  "active_hours": 2.5,
  "alert_level": "info",
  "work_summary": "处理了 2 个 PR review，修复了用户登录超时的 bug，和产品经理讨论了新功能排期",
  "stress_signals": [],
  "message": "你正在高效工作中"
}
```

**飞书多维表格：** 追加一条新记录。

### Step 7: 触发关爱消息

当满足以下任一条件时，通过飞书私聊发送关爱消息：

- `active_hours >= 4`（持续工作过久）
- `emotion_score < -0.4`（明显负面情绪）
- `msg_count + prompt_count > 60`（交互量过大）
- `negative_received` 不为空（收到他人负面消息）

关爱消息使用 LLM 情绪分析中返回的 `comfort_message` 字段。

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
# 每小时执行状态检测
0 * * * * openclaw skill run caring-startup-dog --flow=cron

# 每 5 分钟检查用户反馈（轻量级，只检测文件是否存在）
*/5 * * * * openclaw skill run caring-startup-dog --flow=response-check
```

## 状态 → 动画映射

供桌面宠物和 Skill 共用的状态编码：

| dog_state   | 含义         | Benvictus 动画 | 气泡叠加 |
|-------------|-------------|----------------|---------|
| `running`   | 状态好在冲   | Run (row 3)    | 无       |
| `walking`   | 开始疲劳     | Walk (row 4)   | 无       |
| `tired`     | 需要休息     | Sleep (row 8)  | ZZZ     |
| `energetic` | 动力满满     | Stand (row 7)  | heart   |
| `a_bit_tired` | 有一点累   | Sit (row 1)    | 无       |
| `exhausted` | 非常疲惫     | Lie Down (row 2) | ZZZ   |
| `asking`    | 等待用户反馈 | Idle (row 0)   | ?       |

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
