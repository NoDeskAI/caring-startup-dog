#!/bin/bash
#
# install-desktop-pet.sh — 关爱创业狗桌面宠物自动安装脚本
#
# 从 GitHub Releases 下载最新的桌面宠物 .app 并安装到 /Applications

set -e

REPO="NoDeskAI/caring-startup-dog"
APP_NAME="创业狗.app"
INSTALL_DIR="/Applications"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "🐶 关爱创业狗 - 桌面宠物安装器"
echo "================================"
echo ""

ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
  echo "⚠️  当前仅支持 Apple Silicon (arm64)，你的架构是 $ARCH"
  echo "   如需 Intel 版本，请从源码自行编译：https://github.com/$REPO"
  exit 1
fi

echo "📡 正在获取最新版本信息..."

if command -v gh &>/dev/null; then
  DOWNLOAD_URL=$(gh api "repos/$REPO/releases/latest" --jq '.assets[] | select(.name | contains("aarch64") and endswith(".zip")) | .browser_download_url' 2>/dev/null)
  VERSION=$(gh api "repos/$REPO/releases/latest" --jq '.tag_name' 2>/dev/null)
else
  API_RESPONSE=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest")
  DOWNLOAD_URL=$(echo "$API_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    if 'aarch64' in asset['name'] and asset['name'].endswith('.zip'):
        print(asset['browser_download_url'])
        break
" 2>/dev/null)
  VERSION=$(echo "$API_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('tag_name', 'unknown'))
" 2>/dev/null)
fi

if [ -z "$DOWNLOAD_URL" ]; then
  echo "❌ 无法找到适用于 Apple Silicon 的下载链接"
  echo "   请手动下载：https://github.com/$REPO/releases"
  exit 1
fi

echo "   版本: $VERSION"
echo "   下载地址: $DOWNLOAD_URL"
echo ""

ZIP_FILE="$TMP_DIR/desktop-pet.zip"
echo "⬇️  正在下载..."
curl -L --progress-bar -o "$ZIP_FILE" "$DOWNLOAD_URL"

echo "📦 正在解压..."
unzip -q "$ZIP_FILE" -d "$TMP_DIR"

if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
  echo "🔄 检测到旧版本，正在替换..."
  rm -rf "$INSTALL_DIR/$APP_NAME"
fi

echo "📂 正在安装到 $INSTALL_DIR..."
mv "$TMP_DIR/$APP_NAME" "$INSTALL_DIR/"

xattr -cr "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true

echo ""
echo "🎉 安装完成！"
echo "   应用位置: $INSTALL_DIR/$APP_NAME"
echo ""
echo "🚀 正在启动创业狗..."
open "$INSTALL_DIR/$APP_NAME"
echo "   你的像素狗已经在桌面右下角啦！"
