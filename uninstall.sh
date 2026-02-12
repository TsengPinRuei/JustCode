#!/bin/bash

set -e  # Exit on error

echo "=== JustCode 移除指令 ==="
echo ""
echo "警告：此操作將刪除所有 node_modules 和 package-lock.json 文件"
echo "源代碼和配置文件將被保留"
echo ""

# 確認用戶意圖
read -p "確定要繼續嗎？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "開始移除..."

# Check if rimraf is available
if command -v npx &> /dev/null && [ -d "node_modules" ]; then
    echo ""
    echo "使用 npm clean 指令..."
    npm run clean
else
    echo ""
    echo "手動清理依賴..."
    
    # 刪除 root node_modules
    echo ""
    echo "步驟 1: 清理 root 依賴..."
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        echo "已刪除 root node_modules"
    else
        echo "root node_modules 不存在"
    fi

    if [ -f "package-lock.json" ]; then
        rm -f package-lock.json
        echo "已刪除 root package-lock.json"
    else
        echo "root package-lock.json 不存在"
    fi

    # 刪除 backend node_modules
    echo ""
    echo "步驟 2: 清理 backend 依賴..."
    if [ -d "backend/node_modules" ]; then
        rm -rf backend/node_modules
        echo "已刪除 backend node_modules"
    else
        echo "backend node_modules 不存在"
    fi

    if [ -f "backend/package-lock.json" ]; then
        rm -f backend/package-lock.json
        echo "已刪除 backend package-lock.json"
    else
        echo "backend package-lock.json 不存在"
    fi

    # 刪除 frontend node_modules
    echo ""
    echo "步驟 3: 清理 frontend 依賴..."
    if [ -d "frontend/node_modules" ]; then
        rm -rf frontend/node_modules
        echo "已刪除 frontend node_modules"
    else
        echo "frontend node_modules 不存在"
    fi

    if [ -f "frontend/package-lock.json" ]; then
        rm -f frontend/package-lock.json
        echo "已刪除 frontend package-lock.json"
    else
        echo "frontend package-lock.json 不存在"
    fi

    # 清理 build 產物
    echo ""
    echo "步驟 4: 清理 build 產物..."

    if [ -d "backend/dist" ]; then
        rm -rf backend/dist
        echo "已刪除 backend/dist"
    fi

    if [ -d "frontend/dist" ]; then
        rm -rf frontend/dist
        echo "已刪除 frontend/dist"
    fi

    if [ -d "frontend/.vite" ]; then
        rm -rf frontend/.vite
        echo "已刪除 frontend/.vite"
    fi

    # 清理臨時文件
    echo ""
    echo "步驟 5: 清理臨時文件..."

    if [ -d "temp" ]; then
        rm -rf temp
        echo "已刪除 temp 目錄"
    fi

    # 清理 TypeScript build info
    if [ -f "backend/tsconfig.tsbuildinfo" ]; then
        rm -f backend/tsconfig.tsbuildinfo
        echo "已刪除 backend TypeScript build info"
    fi

    if [ -f "frontend/tsconfig.tsbuildinfo" ]; then
        rm -f frontend/tsconfig.tsbuildinfo
        echo "已刪除 frontend TypeScript build info"
    fi
fi

# 清理 macOS 文件
DSSTORE_COUNT=$(find . -name ".DS_Store" 2>/dev/null | wc -l | tr -d ' ')
if [ "$DSSTORE_COUNT" -gt 0 ]; then
    find . -name ".DS_Store" -delete 2>/dev/null
    echo "已刪除 $DSSTORE_COUNT 個 .DS_Store 文件"
fi

echo ""
echo "移除完成！"
echo ""
echo "您的源代碼和配置文件已保留"
echo "如需重新安裝，請執行："
echo "  npm install"
echo ""
echo "=== 跨平台提示 ==="
echo "此腳本適用於 macOS/Linux。"
echo "在 Windows 上，請執行："
echo "  npm run clean"
echo ""
