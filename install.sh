#!/usr/bin/env bash

set -euo pipefail  # 任一安裝步驟失敗就停止，避免留下半套依賴狀態。

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

die() {
    echo "錯誤：$*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

cd "$SCRIPT_DIR" || die "無法切換到專案目錄：$SCRIPT_DIR"

if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    die "請從 JustCode 專案內的 install.sh 執行，或確認專案檔案完整。"
fi

echo "=== JustCode 安裝指令 ==="
echo ""

# JustCode 依賴 Node.js 18+ 提供的新版 workspace/package 行為。
echo "檢查環境..."
if (( EUID == 0 )); then
    die "請不要以 root/sudo 執行；npm install 可能產生 root 擁有的 node_modules。請改用一般使用者執行。"
fi

if ! command_exists node; then
    die "未找到 Node.js。請先安裝 Node.js 18.x 或更高版本。"
fi

if ! command_exists npm; then
    die "未找到 npm。請確認 Node.js 安裝包含 npm，或修正 PATH 後再執行。"
fi

NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if ! [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]]; then
    die "無法解析 Node.js 版本：$NODE_VERSION"
fi

if (( NODE_MAJOR < 18 )); then
    die "JustCode 需要 Node.js 18.x 或更高版本（當前：$NODE_VERSION）。"
fi

echo "專案目錄：$SCRIPT_DIR"
echo "Node.js 版本：$NODE_VERSION"
echo "npm 版本：$NPM_VERSION"
echo ""

# 根目錄 npm install 會依 package.json workspaces 一次安裝 frontend/backend 依賴。
echo "安裝依賴套件（這可能需要幾分鐘）..."
if npm install; then
    echo "所有依賴安裝成功"
else
    echo "依賴安裝失敗"
    echo ""
    echo "疑難排解："
    echo "  1. 檢查網路連線"
    echo "  2. 嘗試清除 npm cache: npm cache clean --force"
    echo "  3. 若有權限問題: sudo chown -R \$(whoami) \$HOME/.npm"
    exit 1
fi

echo ""
echo "安裝完成！"
echo ""
echo "現在可以執行："
echo "  npm run dev"
echo ""
echo "然後在瀏覽器中打開："
echo "  http://localhost:5173"
echo ""
echo "=== 跨平台提示 ==="
echo "此腳本適用於 macOS/Linux。"
echo "在 Windows 上，請直接執行："
echo "  npm install"
echo ""
