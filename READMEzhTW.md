# JustCode

單機版 LeetCode 刷題平台，支援離線 Java 程式碼執行。

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 功能特色

- **多語言支援**：支援 Java 和 Python3，具備自動語言切換
- **風格介面**：熟悉且直觀的深色主題介面
- **離線程式碼執行**：在本機執行與提交程式碼，無需外部依賴
- **錯誤高亮顯示**：即時編譯錯誤高亮，在程式碼編輯器中顯示紅色波浪底線
- **完整題目流程**：題目瀏覽、程式碼編輯、執行及提交
- **Monaco 編輯器**：順暢的程式碼編輯體驗，支援語法高亮和錯誤標記
- **完整測試系統**：可見測試資料供練習，隱藏測試資料供驗證
- **即時回饋**：立即顯示 AC／WA／CE／RE／TLE 狀態指標
- **動態調整版面**：動態調整分割面板，自訂最佳空間
- **題解支援**：完整的題目解析，包含逐步範例和學習路徑指引

## 系統需求

- **Node.js**：18.x 或更高版本
- **JDK**：Java Development Kit 11 或更高版本（用於 Java 程式碼執行）
- **Python**：Python 3.x（用於 Python 程式碼執行）
- **作業系統**：macOS、Linux 或 Windows

### 驗證環境：

```bash
# 檢查 Node.js 版本
node --version  # 需要 >= 18.0.0

# 檢查 Java 版本
java --version  # 需要 >= 11
javac --version # 需要 >= 11

# 檢查 Python 版本
python3 --version  # 需要 >= 3.x
```

## 安裝與執行

1. **進入專案目錄：**
   ```bash
   cd JustCode
   ```

2. **安裝依賴套件（跨平台）：**
   ```bash
   npm install
   ```

   這會使用 npm workspaces 為前端及後端安裝所有相依套件。

3. **啟動開發伺服器：**
   ```bash
   npm run dev
   ```

   這會同時啟動：
   - **後端**（Express API）：`http://localhost:3000`
   - **前端**（React + Vite）：`http://localhost:5173`

4. **開啟瀏覽器：**
   前往 `http://localhost:5173`

## 清理與移除

### 重設以重新安裝

如果您想**保留專案**但重新安裝依賴（例如：修復問題）：

```bash
npm run clean          # 移除 node_modules、建置產物和 lock 檔案
npm install            # 重新安裝所有依賴
```

其他清理指令：
- `npm run clean:modules` - 只移除 node_modules 和 lock 檔案
- `npm run clean:build` - 只移除建置產物（dist、.vite 等）

> **注意**：這些指令會保留您的原始碼、題目檔案和設定檔。

### 完全刪除

如果您想從電腦中**完全刪除** JustCode：

```bash
# macOS/Linux
cd ..
rm -rf JustCode

# Windows（PowerShell）
cd ..
Remove-Item -Recurse -Force JustCode
```

## 專案結構

```
JustCode/
├── frontend/                       # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/             # Navbar、Editor、Console 等元件
│   │   ├── pages/                  # ProblemList、ProblemDetail 頁面
│   │   ├── services/               # API 客戶端
│   │   ├── types/                  # TypeScript 介面定義
│   │   └── App.tsx
│   └── package.json
├── backend/                        # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/                 # API 端點
│   │   ├── services/               # Java 執行器、題目服務
│   │   ├── templates/              # Runner.java 範本
│   │   └── server.ts
│   └── package.json
├── problems/                       # 題目資料（JSON + Markdown）
│   └── sort-array/
│       ├── problem.json
│       ├── template.java           # Java 範本
│       ├── template.py             # Python 範本
│       ├── editorial.md            # 題目解析
│       ├── testcases_visible.json
│       └── testcases_hidden.json
├── install.sh                      # 安裝指令
├── uninstall.sh                    # 清理指令
└── package.json                    # 根目錄 workspace 設定
```

## 使用指南

### 執行程式碼

1. 點擊「Run」使用範例測試案例測試您的程式碼
2. 切換到「Custom Input」並提供您自己的 JSON 格式測試資料
3. 點擊「Submit」執行所有測試資料

### 理解執行結果

- **AC (Accepted)**：通過所有測試資料
- **WA (Wrong Answer)**：至少一個測試資料失敗
- **CE (Compile Error)**：程式碼編譯失敗
- **RE (Runtime Error)**：程式碼拋出例外
- **TLE (Time Limit Exceeded)**：程式碼執行超過時間限制

## 常見問題

### "javac: command not found"

**問題**：JDK 未安裝或不在 PATH 中。

**解決方法**：
1. 從 [Oracle](https://www.oracle.com/java/technologies/downloads/) 或 [OpenJDK](https://openjdk.org/) 下載並安裝 JDK
2. 將 Java 加入您的 PATH：
   ```bash
   # macOS/Linux - 加入到 ~/.zshrc 或 ~/.bashrc
   export JAVA_HOME=/path/to/jdk
   export PATH=$JAVA_HOME/bin:$PATH
   
   # Windows - 在系統內容中設定環境變數
   ```
3. 驗證：`javac --version`

### 連接埠已被使用

**問題**：連接埠 3000 或 5173 已被佔用。

**解決方法**：
```bash
# macOS/Linux - 尋找並終止程序
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Windows（PowerShell）
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force

# 或是變更連接埠：
# - backend/src/server.ts（PORT=3000）
# - frontend/vite.config.ts（port: 5173）
```

### 找不到模組錯誤

**問題**：依賴套件未安裝。

**解決方法**：
```bash
# 跨平台清除重新安裝
npm run clean:modules
npm install
```

## 安全注意事項

本專案設計用於個人學習及本機使用，**請勿**在以下情況使用：
- 多使用者環境
- 生產系統
- 處理不受信任的程式碼

## 未來規劃

- [ ] 新增更多題目（陣列、樹、圖、動態規劃）
- [x] 支援 Python3
- [x] 解題教學
- [x] 程式碼錯誤高亮顯示
- [ ] 支援 C++
- [ ] 使用者帳號及提交記錄
- [ ] 依難度篩選
- [ ] 程式碼執行統計及排行榜

## 參與貢獻

這是一個個人學習專案，但歡迎提供建議及改進：
1. Fork 此專案
2. 建立您的功能分支
3. 提交 Pull Request

## 授權條款

MIT License - 歡迎將此專案用於學習目的。

## 致謝

- 靈感來自 [LeetCode](https://leetcode.com)
- 使用 [Monaco Editor](https://microsoft.github.io/monaco-editor/) 建構
- 採用 [React](https://react.dev/)、[Express](https://expressjs.com/) 和 [TypeScript](https://www.typescriptlang.org/) 技術