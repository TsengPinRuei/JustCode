#!/usr/bin/env bash

# Stop on cleanup errors so the script does not report a complete uninstall.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ASSUME_YES=0

die() {
    echo "錯誤：$*" >&2
    exit 1
}

usage() {
    echo "用法：./uninstall.sh [--yes]"
    echo ""
    echo "移除 JustCode 安裝產物與建置/暫存檔，保留原始碼、設定檔與 package-lock.json。"
    echo ""
    echo "選項："
    echo "  -y, --yes   略過互動確認，適合 CI 或非互動環境"
    echo "  -h, --help  顯示說明"
}

while (($#)); do
    case "$1" in
        -y|--yes)
            ASSUME_YES=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "未知參數：$1"
            ;;
    esac
    shift
done

cd "$SCRIPT_DIR" || die "無法切換到專案目錄：$SCRIPT_DIR"

if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    die "請從 JustCode 專案內的 uninstall.sh 執行，或確認專案檔案完整。"
fi

# Reject symlinked workspaces before cleanup so nested paths cannot delete files outside the project.
if [ -L "$SCRIPT_DIR/frontend" ] || [ -L "$SCRIPT_DIR/backend" ]; then
    die "frontend/backend 不可為符號連結；請先確認實際清理範圍。"
fi

safe_remove() {
    local rel_path="$1"
    local target="$SCRIPT_DIR/$rel_path"

    case "$rel_path" in
        ""|"."|".."|/*|../*|*/../*)
            die "拒絕移除不安全路徑：$rel_path"
            ;;
    esac

    if [ "$target" = "$SCRIPT_DIR" ] || [ "$target" = "$SCRIPT_DIR/" ]; then
        die "拒絕移除專案根目錄。"
    fi

    # Remove a symlink itself, even when its target is missing; never recurse into its target.
    if [ -e "$target" ] || [ -L "$target" ]; then
        if [ -d "$target" ] && [ ! -L "$target" ]; then
            rm -rf -- "$target"
        else
            rm -f -- "$target"
        fi
        echo "已刪除 $rel_path"
    else
        echo "$rel_path 不存在，略過"
    fi
}

echo "=== JustCode 移除指令 ==="
echo ""
echo "警告：此操作將刪除 node_modules、build 產物與暫存檔"
echo "原始碼、配置文件與 package-lock.json 將被保留"
echo "專案目錄：$SCRIPT_DIR"
echo ""

# Require interactive confirmation unless --yes was explicitly supplied.
if (( ASSUME_YES == 0 )); then
    if [ ! -t 0 ]; then
        die "非互動式環境請加上 --yes 明確確認，例如：./uninstall.sh --yes"
    fi

    CONFIRM=""
    if ! read -r -p "確定要繼續嗎？(y/N): " CONFIRM; then
        die "無法讀取確認輸入。"
    fi

    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
fi

echo ""
echo "開始移除..."

echo ""
echo "步驟 1: 清理依賴..."
safe_remove "node_modules"
safe_remove "backend/node_modules"
safe_remove "frontend/node_modules"

echo ""
echo "步驟 2: 清理 build 產物..."
safe_remove "backend/dist"
safe_remove "frontend/dist"
safe_remove "frontend/.vite"
safe_remove "backend/tsconfig.tsbuildinfo"
safe_remove "frontend/tsconfig.tsbuildinfo"
safe_remove "frontend/tsconfig.node.tsbuildinfo"

echo ""
echo "步驟 3: 清理暫存檔..."
safe_remove "temp"
safe_remove "backend/temp"

DSSTORE_COUNT=0
# Remove Finder metadata while leaving Git's internal files untouched.
while IFS= read -r -d '' dsstore_path; do
    rm -f -- "$dsstore_path"
    DSSTORE_COUNT=$((DSSTORE_COUNT + 1))
done < <(find "$SCRIPT_DIR" -path "$SCRIPT_DIR/.git" -prune -o -type f -name ".DS_Store" -print0)

if (( DSSTORE_COUNT > 0 )); then
    echo "已刪除 $DSSTORE_COUNT 個 .DS_Store 文件"
fi

echo ""
echo "移除完成！"
echo ""
echo "您的原始碼、配置文件與 package-lock.json 已保留"
echo "如需重新安裝，請執行："
echo "  ./install.sh"
echo ""
echo "=== 跨平台提示 ==="
echo "此腳本適用於 macOS/Linux。"
echo "在 Windows 上，請使用檔案總管或 PowerShell 移除上述產物，並保留 package-lock.json。"
echo ""
