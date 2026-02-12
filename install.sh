#!/bin/bash

set -e  # Exit on error

echo "=== JustCode 安裝指令 ==="
echo ""

# Check Node.js version
echo "檢查環境..."
if ! command -v node &> /dev/null; then
    echo "未找到 Node.js"
    echo "請先安裝 Node.js 18.x 或更高版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "警告：建議使用 Node.js 18.x 或更高版本（當前：$(node -v)）"
fi

echo "Node.js 版本：$(node -v)"
echo ""

# Install all dependencies using npm workspaces
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
