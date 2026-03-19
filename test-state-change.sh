#!/bin/bash
# 模拟 status.json 状态变化，测试桌面宠物动画切换

STATUS_FILE="$HOME/.创业狗/status.json"

states=("running" "walking" "tired" "energetic" "a_bit_tired" "exhausted" "asking")
labels=("状态好在冲" "开始疲劳" "需要休息" "动力满满" "有一点累" "非常疲惫" "等待反馈")

echo "🐶 创业狗状态切换测试"
echo "每 5 秒切换一次状态，观察桌面宠物动画变化"
echo ""

for i in "${!states[@]}"; do
  state="${states[$i]}"
  label="${labels[$i]}"
  echo "切换到: $state ($label)"

  cat > "$STATUS_FILE" << EOF
{
  "user": "张雨萌",
  "last_update": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "dog_state": "$state",
  "emotion_score": 0.0,
  "emotion_label": "neutral",
  "msg_count_1h": 20,
  "prompt_count_1h": 10,
  "active_hours": 2.0,
  "alert_level": "info",
  "work_summary": "正在测试桌面宠物的 $label 状态",
  "stress_signals": [],
  "message": "$label"
}
EOF

  sleep 5
done

echo ""
echo "✅ 测试完成！"
