# 关爱创业狗 🐶

**自动检测工作状态，像素狗陪你创业。**

基于 OpenClaw 的 Skill，结合飞书消息分析、Cursor/Claude Code 活动采集和 LLM 情绪分析，实时监测创业者的工作健康状况。配套 macOS 桌面像素宠物狗，用动画反映你的状态。

## 功能

- **自动状态检测**：每小时分析飞书消息 + 编码活动，判断工作强度和情绪
- **桌面宠物**：像素风小狗实时反映你的工作状态（跑步→走路→睡觉）
- **主动关怀**：定期询问"你的狗累了吗？"，根据回答生成个性化安慰
- **飞书通知**：工作过久、情绪波动时通过飞书私聊推送关爱消息
- **状态记录**：数据写入飞书多维表格，可追溯和分享

## 安装

### 前提条件

- [OpenClaw](https://github.com/NoDeskAI/nodeskclaw) 已安装并连接飞书
- macOS (Apple Silicon)

### 安装 Skill

将 `skill/` 目录拷贝到你的 OpenClaw 技能库：

```bash
cp -r skill ~/.openclaw/workspace/skills/caring-startup-dog
```

或者通过 CloudHub 搜索"创业狗"一键安装。

### 初始化

告诉你的 OpenClaw：

> "帮我初始化 caring-startup-dog"

它会自动完成：
1. 创建数据目录
2. 安装 Cursor/Claude Code Hooks
3. 创建飞书多维表格
4. 配置定时任务
5. 下载并安装桌面宠物

### 手动安装桌面宠物

如果需要单独安装桌面宠物，从 [Releases](https://github.com/NoDeskAI/caring-startup-dog/releases) 下载最新版本。

## 项目结构

```
├── skill/              # OpenClaw Skill（核心）
│   ├── SKILL.md        # Skill 定义
│   ├── prompts/        # LLM Prompt 模板
│   └── scripts/        # 安装脚本
├── desktop-pet/        # Tauri 桌面宠物源码
├── hooks/              # Cursor/Claude Code Hooks 源码
└── docs/               # 产品文档
```

## 技术栈

- **Skill**: OpenClaw + 飞书 API + LLM
- **桌面宠物**: Tauri v2 + React + Phaser 3
- **像素素材**: [Pixel Dogs by Benvictus](https://bfreddyberg.itch.io/pixel-dogs)

## 协议

MIT
