#!/bin/bash
#
# activity-logger.sh — 关爱创业狗 Hooks 核心脚本
#
# 兼容 Cursor Hooks 和 Claude Code Hooks，从 stdin 读取 JSON，
# 提取关键字段后追加写入 ~/.创业狗/activity.jsonl
#
# Cursor 事件: beforeSubmitPrompt, sessionStart, sessionEnd
# Claude Code 事件: UserPromptSubmit, SessionStart, SessionEnd

ACTIVITY_DIR="$HOME/.创业狗"
ACTIVITY_FILE="$ACTIVITY_DIR/activity.jsonl"

mkdir -p "$ACTIVITY_DIR"

INPUT=$(cat)

if [ -z "$INPUT" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

HOOK_EVENT=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# Cursor uses 'hook_event_name', Claude Code uses different field names
# We normalize based on available fields
event = data.get('hook_event_name', '')
if not event:
    # Claude Code doesn't always include hook_event_name in the same way
    # We detect by checking for known fields
    if 'prompt' in data and 'attachments' in data:
        event = 'beforeSubmitPrompt'
    elif 'session_id' in data and 'composer_mode' in data:
        event = 'sessionStart'
    elif 'session_id' in data and 'duration_ms' in data:
        event = 'sessionEnd'
    elif 'tool_name' in data:
        event = 'PostToolUse'
print(event)
" 2>/dev/null)

RECORD=$(echo "$INPUT" | python3 -c "
import sys, json

data = json.load(sys.stdin)
ts = '$TIMESTAMP'
hook_event = '$HOOK_EVENT'

record = {
    'ts': ts,
    'event': hook_event,
}

# Detect source: Cursor has 'cursor_version', Claude Code doesn't
if 'cursor_version' in data:
    record['src'] = 'cursor'
    record['cursor_version'] = data.get('cursor_version', '')
else:
    record['src'] = 'claude-code'

# Extract event-specific fields
if hook_event in ('beforeSubmitPrompt', 'UserPromptSubmit'):
    record['event'] = 'prompt'
    prompt = data.get('prompt', '')
    # Claude Code may nest prompt differently
    if not prompt and 'tool_input' in data:
        prompt = str(data.get('tool_input', ''))
    record['text'] = prompt[:500]  # Truncate to 500 chars for storage
    record['session_id'] = data.get('conversation_id', data.get('session_id', ''))

elif hook_event in ('sessionStart',):
    record['event'] = 'session_start'
    record['session_id'] = data.get('session_id', data.get('conversation_id', ''))
    record['mode'] = data.get('composer_mode', '')

elif hook_event in ('sessionEnd', 'SessionEnd'):
    record['event'] = 'session_end'
    record['session_id'] = data.get('session_id', data.get('conversation_id', ''))
    record['duration_ms'] = data.get('duration_ms', 0)
    record['reason'] = data.get('reason', '')

elif hook_event == 'PostToolUse':
    record['event'] = 'tool_use'
    record['tool_name'] = data.get('tool_name', '')
    record['session_id'] = data.get('conversation_id', '')

else:
    record['event'] = 'unknown'
    record['raw_event'] = hook_event

print(json.dumps(record, ensure_ascii=False))
" 2>/dev/null)

if [ -n "$RECORD" ] && [ "$RECORD" != "null" ]; then
  echo "$RECORD" >> "$ACTIVITY_FILE"
fi

exit 0
