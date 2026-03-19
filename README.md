# 关爱创业狗 v0.2.0

**一只像素狗，陪你创业。**

基于 [OpenClaw](https://github.com/NoDeskAI/nodeskclaw) + 飞书 + Cursor/Claude Code 数据，驱动一只 macOS 桌面像素宠物狗，用动画和对话反映你的工作状态。

<p align="center">
  <img src="docs/screenshots/comfort-bubble.png" width="320" />
  <img src="docs/screenshots/coin-drop.png" width="320" />
</p>
<p align="center">
  <img src="docs/screenshots/fun-text.png" width="320" />
  <img src="docs/screenshots/sleeping.png" width="320" />
</p>
<p align="center">
  <img src="docs/screenshots/running-brown.png" width="280" />
  <img src="docs/screenshots/running-skin.png" width="280" />
  <img src="docs/screenshots/daily-report.png" width="280" />
</p>

---

## 产品哲学

### 狗是你的投射，不是你的助手

这只狗不是来"关心你"的 —— 它**就是你**。

创业者不缺建议。每个人都知道该喝水、该休息、该运动。他们缺的是三样东西：

- **被看见** — 不是被提醒，是有一个东西在默默反映"你现在的状态是这样的"。不评判，不指导，就是让你看到自己。
- **被允许** — 创业者最大的心理负担是"我不应该累"。如果狗趴下了，用户会说"不是我要休息，是我的狗需要休息"。
- **被陪伴** — 系统推送提醒像老板，狗默默跟你经历一切像朋友。

### 双需求模型：被看见 vs 被抽离

创业者有两种截然不同的心理需求：

| | 需求 A：被看见 | 需求 B：被抽离 |
|---|---|---|
| **心理机制** | "有人知道我在努力" | "让我喘口气" |
| **触发** | 右键 → 在干嘛 / 今天的日记 / cron 自言自语 | 右键 → 摸摸头 |
| **内容** | 基于真实工作数据的伙伴式反馈 | 与工作完全无关的有趣短文本 |

"摸狗头"本身就暗示了一个心理模型：你在跟一只狗玩，不是在听工作周报。真正的狗被摸头会翻肚皮、甩尾巴、叼个什么东西给你看 —— 纯粹的微笑瞬间。

### 文案视角

狗是创业伙伴，不是旁观者、数据播报员或心理咨询师：

- **"我们"** — 共同经历的辛苦（"我们已经调了好久的前端视觉了！"）
- **"你"** — 赞美和鼓励（"你真厉害"）
- **"我们"** — 休息建议（"我们下去遛遛吧！"）

狗没有独立需求。不说"我饿了"。休息提议永远是"我们一起"。

---

## 功能一览

### 桌面交互

| 操作 | 效果 |
|------|------|
| **左键点击** | 心情面板（1-5 档），记录到本地数据库 |
| **右键 → 摸摸头** | 从预生成 fun-pool 随机取一条趣味文案，零延迟（需求 B） |
| **右键 → 在干嘛** | 调用 LLM 生成基于真实工作内容的伙伴式反馈（需求 A） |
| **右键 → 今天的日记** | 当天叙事回顾 + 心情时间线 |
| **右键 → 换皮肤** | 10 款像素狗皮肤，hover 预览锁定皮肤 |
| **右键 → 修复连接** | 手动触发 cron 健康检查与修复 |
| **悬停** | 显示 LLM 预生成的状态描述 + 连接指示灯 |
| **拖拽** | 移动狗的位置（屏幕边界约束） |
| **点击金币** | 收集金币 + LLM 文案气泡 |

### 金币系统

每小时 cron 完成后，桌面上弹跳掉落一枚像素金币。用户在线时点击收集，附带一段结合当前工作的文案。每 5 枚金币解锁 1 个新皮肤。

金币不是 KPI —— 是时间的痕迹。不累积压力，离线时最多存 1 枚。

### 飞书狗信

每天 3 次随机时间（9:00-22:00，避开午休），狗通过飞书私聊给你写信：

> "你的狗刚拜托我告诉你：我们刚才讨论排期讨论了好久，你推进了好多事情！要不要一起出去走走？"

狗有自己的人格，不是 OpenClaw 的传声筒。

### 日终日记

每天 21:00 后自动推送一封狗视角的一天总结到飞书：

> "你的狗写了今天的日记：上午一直在修前端问题，下午跟苏博文聊了很久排期。今天收集了 3 枚金币"

### 自动机制

| 机制 | 频率 | 说明 |
|------|------|------|
| 数据采集 | 每 10 分钟 | 飞书消息计数 + 编码活动统计 + 狗信/日记触发检查 |
| 完整分析 | 每 1 小时 | LLM 情绪分析 + 自言自语 + fun-pool 刷新 + 金币掉落 |
| 主动询问 | 每 2 小时 | 弹窗问心情状态 |
| 健康检测 | 每 15 分钟 | cron 心跳检查，过期自动修复 |

### 狗的动画

完全由用户自报心情决定，无 energy 公式：

| 心情 | 动画 | 标签 |
|------|------|------|
| 5 | 奔跑 | 冲冲冲! |
| 4 | 走路 | 走走走~ |
| 3 | 坐着 | 有点累了... |
| 2 | 趴着 | 歇会儿... |
| 1 | 睡觉 | zzZ... |

工作数据（消息数、prompt 数、连续工作时长）+ 用户心情两个维度作为 LLM 上下文，让文案像了解你工作情况的朋友那样说话。

### 日期边界

"今天"从凌晨 4 点算起，适配创业者作息。

---

## 数据架构

```
~/.创业狗/
├── status.json           # cron 输出（消息数, 工作摘要, hover_text, coin_ready）
├── comfort-message.json  # LLM 生成的安慰/自言自语
├── fun-pool.json         # cron 预生成的 5 条趣味文案
├── daily-schedule.json   # 当日狗信时间表 + 日记推送标记
├── cron-heartbeat.json   # cron 执行心跳（各步骤成功/失败）
├── user-response.json    # 用户交互反馈
├── activity.jsonl        # Cursor/Claude Code hooks 编码活动
├── config.json           # 飞书表 ID 等配置
└── dog.db                # SQLite（心情 + 工作快照 + 金币 + 皮肤解锁）
```

三个数据源：
1. **飞书** — 消息内容、消息量、日程（第一优先级）
2. **Cursor IDE** — prompt 文本、session 时长
3. **Claude Code** — prompt 文本、session 时长

---

## 安装

### 前提

- [OpenClaw](https://github.com/NoDeskAI/nodeskclaw) 已安装并连接飞书
- macOS (Apple Silicon)

### 安装 Skill

```bash
cp -r skill ~/.openclaw/workspace/skills/caring-startup-dog
```

### 初始化

告诉你的 OpenClaw：

> "帮我初始化 caring-startup-dog"

自动完成：创建数据目录 → 安装 Hooks → 创建飞书表 → 配置 Cron → 安装桌面宠物。

### 手动安装桌面宠物

从 [Releases](https://github.com/NoDeskAI/caring-startup-dog/releases) 下载。

---

## 项目结构

```
├── skill/              # OpenClaw Skill
│   ├── SKILL.md        # Skill 定义与操作流程
│   ├── prompts/        # LLM Prompt 模板（情绪分析/安慰/狗信/日记）
│   └── scripts/        # 安装脚本
├── desktop-pet/        # Tauri 桌面宠物源码
│   ├── src/            # React + Phaser 前端
│   ├── src-tauri/      # Rust 后端（穿透、拖拽、光标检测）
│   └── public/sprites/ # 像素狗皮肤 + 金币素材
├── hooks/              # Cursor/Claude Code Hooks
└── docs/               # 产品文档与截图
```

## 技术栈

- **Skill**: OpenClaw + 飞书 API + LLM
- **桌面宠物**: Tauri v2 + React + Phaser 3 (WebGL) + Zustand + SQLite
- **窗口交互**: cocoa/objc（macOS 原生 API） + setPointerCapture 拖拽 + Rust 全局光标轮询
- **像素素材**: [Pixel Dogs by Benvictus](https://bfreddyberg.itch.io/pixel-dogs)
- **像素字体**: Zpix（中文） + Silkscreen（英文）

## 协议

[Apache License 2.0](LICENSE)
