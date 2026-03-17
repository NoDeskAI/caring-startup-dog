#!/bin/bash
#
# install.sh — 关爱创业狗 Hooks 一键安装器
#
# 自动配置 Cursor 和 Claude Code 的 hooks，使它们将活动数据
# 写入 ~/.创业狗/activity.jsonl

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGGER_SCRIPT="$SCRIPT_DIR/activity-logger.sh"
ACTIVITY_DIR="$HOME/.创业狗"

echo "🐶 关爱创业狗 Hooks 安装器"
echo "=========================="
echo ""

mkdir -p "$ACTIVITY_DIR"

if [ ! -f "$LOGGER_SCRIPT" ]; then
  echo "❌ 找不到 activity-logger.sh，请确保它和 install.sh 在同一目录"
  exit 1
fi

chmod +x "$LOGGER_SCRIPT"

# --- Cursor Hooks ---

CURSOR_HOOKS_FILE="$HOME/.cursor/hooks.json"
CURSOR_DIR="$HOME/.cursor"

install_cursor_hooks() {
  echo "📦 配置 Cursor Hooks..."

  mkdir -p "$CURSOR_DIR"

  if [ -f "$CURSOR_HOOKS_FILE" ]; then
    echo "   发现已有 $CURSOR_HOOKS_FILE，进行合并..."
    python3 -c "
import json, sys

hooks_file = '$CURSOR_HOOKS_FILE'
logger = '$LOGGER_SCRIPT'

try:
    with open(hooks_file, 'r') as f:
        config = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    config = {}

if 'version' not in config:
    config['version'] = 1
if 'hooks' not in config:
    config['hooks'] = {}

our_hook = {'command': logger}

for event in ['beforeSubmitPrompt', 'sessionStart', 'sessionEnd']:
    if event not in config['hooks']:
        config['hooks'][event] = []
    existing_cmds = [h.get('command', '') for h in config['hooks'][event]]
    if logger not in existing_cmds:
        config['hooks'][event].append(our_hook)

with open(hooks_file, 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print('   ✅ Cursor Hooks 已合并写入')
" 2>/dev/null
  else
    python3 -c "
import json
logger = '$LOGGER_SCRIPT'
config = {
    'version': 1,
    'hooks': {
        'beforeSubmitPrompt': [{'command': logger}],
        'sessionStart': [{'command': logger}],
        'sessionEnd': [{'command': logger}]
    }
}
with open('$CURSOR_HOOKS_FILE', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print('   ✅ Cursor Hooks 配置已创建')
" 2>/dev/null
  fi
}

# --- Claude Code Hooks ---

CLAUDE_SETTINGS_FILE="$HOME/.claude/settings.json"
CLAUDE_DIR="$HOME/.claude"

install_claude_hooks() {
  echo "📦 配置 Claude Code Hooks..."

  mkdir -p "$CLAUDE_DIR"

  if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
    echo "   发现已有 $CLAUDE_SETTINGS_FILE，进行合并..."
    python3 -c "
import json

settings_file = '$CLAUDE_SETTINGS_FILE'
logger = '$LOGGER_SCRIPT'

try:
    with open(settings_file, 'r') as f:
        config = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    config = {}

if 'hooks' not in config:
    config['hooks'] = {}

our_hook_def = [{'hooks': [{'type': 'command', 'command': logger}]}]

for event in ['UserPromptSubmit', 'SessionStart', 'SessionEnd']:
    if event not in config['hooks']:
        config['hooks'][event] = our_hook_def
    else:
        existing = config['hooks'][event]
        already_installed = any(
            logger in str(mg)
            for mg in existing
        )
        if not already_installed:
            existing.extend(our_hook_def)

with open(settings_file, 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print('   ✅ Claude Code Hooks 已合并写入')
" 2>/dev/null
  else
    python3 -c "
import json
logger = '$LOGGER_SCRIPT'
hook_def = [{'hooks': [{'type': 'command', 'command': logger}]}]
config = {
    'hooks': {
        'UserPromptSubmit': hook_def,
        'SessionStart': hook_def,
        'SessionEnd': hook_def
    }
}
with open('$CLAUDE_SETTINGS_FILE', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print('   ✅ Claude Code Hooks 配置已创建')
" 2>/dev/null
  fi
}

# --- 执行安装 ---

if command -v cursor &>/dev/null || [ -d "$CURSOR_DIR" ]; then
  install_cursor_hooks
else
  echo "⏭️  未检测到 Cursor，跳过 Cursor Hooks 配置"
fi

if command -v claude &>/dev/null || [ -d "$CLAUDE_DIR" ]; then
  install_claude_hooks
else
  echo "⏭️  未检测到 Claude Code，跳过 Claude Code Hooks 配置"
fi

echo ""
echo "🎉 安装完成！"
echo ""
echo "   活动日志位置: $ACTIVITY_FILE"
echo "   Hook 脚本位置: $LOGGER_SCRIPT"
echo ""
echo "   你可以在 Cursor 或 Claude Code 中发送一条消息来测试。"
echo "   然后运行: cat $ACTIVITY_DIR/activity.jsonl"
echo "   应该能看到刚才的活动记录。"
