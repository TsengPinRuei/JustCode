# JustCode

JustCode 是一個受 LeetCode 啟發的單機刷題練習工具。它會在你的電腦上執行 React 前端與 Express 後端，把題目以檔案形式存放在 `problems/`，並能用本機或 Docker 執行 Java、Python3 解答。

這個專案適合個人學習與本機練習，不是已經可直接公開上線的多人線上 judge。一般本機使用不需要帳號、資料庫、API key 或雲端服務。

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 主要功能

- 瀏覽本機題目，顯示難度、標籤、已通過或已嘗試狀態。
- 使用 Monaco 編輯器撰寫 Java 或 Python3 解答，並支援重設範本與調整字級。
- 執行可見測資、執行一筆自訂 JSON 輸入，或提交並跑可見加隱藏測資。
- 自動儲存每題進度，包含已選語言、各語言的程式碼、AC 紀錄與解題時間。
- 透過 URL 匯入公開 LeetCode 題目資料，包含題目敘述、範例、限制條件、Java/Python3 範本與範例測資。
- 可從 UI 刪除匯入題目。內建題目會被保護，不能刪除。
- 閱讀 Markdown 題解，支援 GitHub-flavored Markdown、相鄰程式碼區塊分頁與複製按鈕。
- 顯示 AC、WA、CE、RE、TLE 結果、各測資細節、執行時間、編譯錯誤在編輯器中的標記，以及失敗測資的 debug 輸出。
- 查看解題統計，例如目前作答時間、最佳總時間、最近一次提交耗時與 AC 紀錄排名。
- 透過沙盒 runner 執行程式碼，支援每次執行獨立暫存目錄、逾時處理、輸出長度限制與選用 Docker 隔離。
- 可調整題目、編輯器與 console 面板大小。

## 系統需求

- Node.js 18 或更新版本，並包含 npm。
- 如果要用本機沙盒執行 Java，需要 Java Development Kit 11 或更新版本。
- 如果要用本機沙盒執行 Python3，需要 Python 3.9 或更新版本。內建 Python 範本使用 `list[int]` type hint。
- Docker 是選用項目，但執行你不完全信任的程式碼時強烈建議使用。
- `npm install` 與 LeetCode 匯入需要網路連線。
- 支援 macOS、Linux 或 Windows。`install.sh` 與 `uninstall.sh` 只適用於 macOS/Linux；npm 指令可跨平台使用。

檢查環境：

```bash
node --version
npm --version
javac --version
java --version
python3 --version
docker --version
```

## 安裝方式

在 repository 根目錄執行：

```bash
npm install
```

這會透過 npm workspaces 安裝根目錄、前端與後端的相依套件。

macOS/Linux 也可以執行：

```bash
./install.sh
```

這個腳本會檢查 Node.js，接著執行 `npm install`。

## 設定方式

一般本機使用不需要 `.env` 檔。設定會從環境變數讀取。

| 變數 | 預設值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | 後端 API 連接埠。Vite 開發代理預期使用 `3000`，除非你也更新 `frontend/vite.config.ts`。 |
| `JUSTCODE_SANDBOX_MODE` | `auto` | 程式碼執行模式：`auto`、`docker` 或 `local`。 |
| `JUSTCODE_JAVA_SANDBOX_IMAGE` | `eclipse-temurin:17-jdk` | Java 執行用 Docker image。 |
| `JUSTCODE_PYTHON_SANDBOX_IMAGE` | `python:3.11-slim` | Python 執行用 Docker image。 |
| `JUSTCODE_DOCKER_MEMORY` | `256m` | 每次 Docker 執行容器的記憶體限制。 |
| `JUSTCODE_DOCKER_CPUS` | `1` | 每次 Docker 執行容器的 CPU 限制。 |
| `JUSTCODE_DOCKER_PIDS_LIMIT` | `64` | 每次 Docker 執行容器的程序數限制。 |

沙盒模式：

| 模式 | 行為 |
| --- | --- |
| `auto` | 只有在必要 Docker image 已在本機且 Docker daemon 可用時使用 Docker，否則退回受限制的本機執行。 |
| `docker` | 必須有 Docker 與設定的 image。不可用時會直接失敗，不會退回本機執行。執行不受信任程式碼時請使用這個模式。 |
| `local` | 使用本機 `javac`、`java`、`python3` 執行，不透過 shell，並使用最小化環境變數。這很方便，但不是完整安全邊界。 |

執行限制目前定義在 `backend/src/constants.ts`：Java 編譯最多 10 秒，每筆測資最多 1 秒，stdout/stderr 合計最多保留 10 MB。這些限制目前沒有對應的環境變數可以調整。

使用 Docker 模式：

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

Windows PowerShell 可這樣設定環境變數：

```powershell
$env:JUSTCODE_SANDBOX_MODE = "docker"
npm run dev
```

## 使用方式

啟動兩個開發伺服器：

```bash
npm run dev
```

這會啟動：

- 後端 API：`http://localhost:3000`
- 前端 App：`http://localhost:5173`

開啟：

```text
http://localhost:5173
```

後端也提供健康檢查：

```text
http://localhost:3000/health
```

### 解題流程

1. 開啟題目列表。
2. 選擇題目。
3. 如果題目同時支援 Java 與 Python3，選擇要使用的語言。
4. 編輯起始程式碼。
5. 如果想還原目前語言的起始範本，按 `Reset`。
6. 按 `Run` 執行可見測資或目前自訂輸入。
7. 按 `Submit` 執行可見與隱藏測資。

只有 `Submit` 可以把題目標成已通過，因為 `Run` 不會執行隱藏測資。每次 AC 提交都會在 `progress.json` 建立一筆解題紀錄；統計面板會用這些紀錄顯示該題的時間與排名。

### 自訂輸入

自訂輸入必須是 JSON object，參數名稱要和題目 metadata 相同。例如：

```json
{
  "nums": [5, 2, 3, 1]
}
```

內建 Add Two Integers 題目範例：

```json
{
  "num1": 12,
  "num2": 5
}
```

自訂輸入沒有預期輸出，所以 JustCode 會回報程式是否成功執行，並顯示回傳值。

### 從 LeetCode 匯入

在題目列表按 `Import from LeetCode`，貼上類似以下 URL：

```text
https://leetcode.com/problems/two-sum/
```

匯入的題目會存到 `problems/<problem-slug>/`。

重要限制：

- 匯入功能依賴 LeetCode 的公開 GraphQL 回應與目前題目 HTML 結構。
- 只會匯入 Java 與 Python3 程式碼片段。
- 只會把公開範例測資匯入為可見測資。
- 無法取得 LeetCode 隱藏 judge 測資。JustCode 會建立空的 `testcases_hidden.json`，方便你之後手動加入隱藏測資。
- 不會從 LeetCode 匯入題解。除非你自行加入 `editorial.md`，否則題目詳細頁會顯示 `Editorial coming soon...`。
- runner 支援常見的 primitive、array 與 list 型別。需要 linked list、tree、graph 等自訂結構的題目可能可以匯入，但在補上 runner 支援前不一定能正確執行。
- 目前 `.gitignore` 會忽略匯入題目，除非你調整 ignore 規則或強制加入檔案。

### 本機題目檔案

每個題目都是 `problems/` 底下的一個資料夾。完整的本機題目可以使用以下結構：

```text
problems/<problem-id>/
├── problem.json
├── template.java
├── template.py
├── testcases_visible.json
├── testcases_hidden.json
├── editorial.md
└── progress.json
```

必要檔案是 `problem.json`、`testcases_visible.json`，以及 `problem.json` 中每個支援語言對應的範本檔。`testcases_hidden.json` 對執行來說是選用檔，但匯入題目時會建立空檔，方便之後加入私有測資。`editorial.md` 是選用檔。`progress.json` 會在使用者編輯或提交程式碼後由 App 自動建立或更新。

`problem.json` 定義標題、難度、標籤、題目敘述、範例、限制條件、支援語言、函式名稱、參數、回傳型別與顯示用函式簽名。`params` 裡的參數名稱必須和測資 `input` object 的 key 一致。

測資檔是 JSON array：

```json
[
  {
    "input": {
      "nums": [5, 2, 3, 1]
    },
    "output": [1, 2, 3, 5]
  }
]
```

`progress.json` 儲存本機使用進度，會由 App 自動寫入。

## 常用指令

除非特別說明，請在 repository 根目錄執行。

| 指令 | 用途 |
| --- | --- |
| `npm install` | 安裝所有 workspace 相依套件。 |
| `npm run dev` | 同時啟動後端與前端開發伺服器。 |
| `npm run dev:backend` | 只啟動後端，使用 `PORT` 或 `3000`。 |
| `npm run dev:frontend` | 只啟動 Vite 前端，使用 `5173`。 |
| `npm run build` | 建置前端與後端。這是目前主要的驗證指令。 |
| `npm run build:frontend` | 只建置前端。 |
| `npm run build:backend` | 只建置後端 TypeScript 輸出。 |
| `npm run start:backend` | 啟動已建置的後端。請先執行 `npm run build:backend`。 |
| `npm run preview --workspace=frontend` | 用 Vite preview 在本機預覽已建置的前端。請先執行 `npm run build:frontend`。 |
| `npm run clean` | 移除相依套件、建置輸出、暫存執行檔與 lock 檔。 |
| `npm run clean:modules` | 只移除 `node_modules` 與 lock 檔。 |
| `npm run clean:build` | 只移除建置輸出與 TypeScript build info。 |
| `./install.sh` | macOS/Linux 安裝輔助腳本。 |
| `./uninstall.sh` | macOS/Linux 清理相依套件與建置輸出的輔助腳本。 |

目前 repository 沒有 `npm test` 或 lint script。請用 `npm run build` 做型別檢查與建置驗證。

請留意 `npm run clean` 與 `npm run clean:modules` 都會移除 `package-lock.json`。之後需要再執行 `npm install` 重新產生。

## 建置與部署注意事項

建置全部：

```bash
npm run build
```

啟動已建置的後端：

```bash
npm run start:backend
```

請使用 workspace script，不要從 repository 根目錄直接執行 `node backend/dist/server.js`。後端預期工作目錄是 `backend/`，這樣才能找到 `../problems`。

目前沒有內建「一個指令同時啟動前後端」的 production server。若要部署，請用靜態檔伺服器或 reverse proxy 提供 `frontend/dist`，並把 `/api` 轉發到後端。開發模式下的 `/api` 代理由 Vite 提供。

可以這樣在本機預覽已建置的前端：

```bash
npm run preview --workspace=frontend
```

## 限制與注意事項

- JustCode 是給單一本機使用者使用的工具，沒有實作登入、帳號、共享進度或資料庫。
- 本機沙盒模式只是相容性 fallback，不是完整安全邊界。執行你不完全信任的程式碼時請使用 Docker 模式。
- Docker 模式會停用執行容器的網路，並套用 CPU、記憶體、程序數、唯讀檔案系統與逾時限制，但這個專案仍應視為本機練習工具，不是 production 等級的 judge。
- 目前只實作 Java 與 Python3 執行。
- 產生的 runner 支援常見 JSON 形狀輸入：數字、字串、布林值、array、巢狀 array，以及受支援的 Java list 型別。`ListNode` 或 `TreeNode` 這類 LeetCode 自訂資料結構尚未實作。
- 輸出比對使用精確 JSON 序列化。若題目有無序答案、浮點誤差容忍或多個合法答案，需要調整測資或 runner 邏輯。
- 進度會以 `progress.json` 儲存在各題資料夾；刪除題目資料夾會一併刪除該題已儲存的程式碼與解題紀錄。

## 專案結構

```text
JustCode/
├── backend/                    # Express + TypeScript API
│   ├── src/
│   │   ├── constants.ts        # 逾時、沙盒環境變數、受保護題目 ID
│   │   ├── routes/             # REST API routes
│   │   ├── services/           # 題目儲存、LeetCode 匯入、程式碼執行
│   │   ├── server.ts           # Express server 入口
│   │   └── types.ts            # 後端 API/資料型別
│   └── package.json
├── frontend/                   # React + TypeScript + Vite app
│   ├── public/                 # 靜態資源
│   ├── src/
│   │   ├── components/         # 編輯器、console、題目敘述、版面元件
│   │   ├── pages/              # 題目列表與題目詳細頁
│   │   ├── plugins/            # Markdown code-group 外掛
│   │   ├── services/           # Axios API client
│   │   ├── types/              # 前端 API/資料型別
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── problems/                   # 檔案式題目資料庫
│   ├── add-two-integers/       # 內建受保護題目
│   └── sort-array/             # 內建受保護題目
├── install.sh                  # macOS/Linux 安裝輔助腳本
├── uninstall.sh                # macOS/Linux 清理輔助腳本
├── package.json                # npm workspace scripts
└── package-lock.json
```

## API 簡介

前端呼叫相對路徑 `/api`。開發模式下，Vite 會把這些請求代理到 `3000` port 的後端。

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 後端健康檢查。 |
| `GET` | `/api/problems` | 取得題目 metadata 列表。 |
| `GET` | `/api/problems/:id` | 讀取單一題目，但不回傳隱藏測資內容。 |
| `POST` | `/api/run` | 執行可見測資或一筆自訂輸入。 |
| `POST` | `/api/submit` | 提交並執行可見與隱藏測資。 |
| `POST` | `/api/import-problem` | 匯入公開 LeetCode 題目 URL。 |
| `GET` | `/api/progress` | 讀取所有進度檔。 |
| `GET` | `/api/progress/:id` | 讀取單一題目的進度。 |
| `PUT` | `/api/progress/:id` | 儲存單一題目的進度。 |
| `DELETE` | `/api/problems/:id` | 刪除非受保護題目。 |

## 疑難排解

### 前端連不到後端

確認後端有啟動：

```text
http://localhost:3000/health
```

如果你改了 `PORT`，也要更新 `frontend/vite.config.ts` 裡的 Vite proxy target，否則開發模式的前端仍會把 `/api` 請求送到 `3000`。

### 3000 或 5173 連接埠已被使用

停止既有程序後再執行 `npm run dev`。

macOS/Linux：

```bash
lsof -ti:3000 | xargs kill
lsof -ti:5173 | xargs kill
```

Windows PowerShell：

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process
```

### `javac: command not found` 或 Java 編譯一直失敗

請安裝 JDK，不只是 JRE，並確認：

```bash
javac --version
java --version
```

也可以改用 Docker 模式，先拉 Java image：

```bash
docker pull eclipse-temurin:17-jdk
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

### `python3: command not found`

請安裝 Python 3.9 或更新版本，並確認：

```bash
python3 --version
```

也可以改用 Docker 模式，先拉 Python image：

```bash
docker pull python:3.11-slim
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

### Docker 模式失敗

確認 Docker Desktop 或 Docker daemon 已啟動，並拉取 App 使用的 images：

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

`JUSTCODE_SANDBOX_MODE=docker` 在 Docker 或 image 不可用時會直接失敗。`auto` 則會在 Docker 尚未準備好時退回本機執行。

### Run 或 Submit 逾時

每筆測資在後端最多執行 1 秒，前端 API client 最多等待 30 秒回應。如果解法邏輯正確但太慢，請優化解法，或在本機練習時縮小測資。這些逾時值目前是程式碼常數，不是環境變數。

### LeetCode 匯入失敗

確認 URL 符合以下格式：

```text
https://leetcode.com/problems/<problem-slug>/
```

匯入器依賴網路連線、LeetCode 公開 GraphQL 回應與目前題目 HTML 格式。如果 LeetCode 改變回應結構，可能需要修改 `backend/src/services/leetcodeService.ts`。

如果匯入成功但執行該題失敗，請檢查 `problem.json` 的 `params` 或 `returnType` 是否屬於 runner 尚未支援的型別。目前 runner 尚未實作 linked list 或 tree 這類 LeetCode 自訂結構。

### 自訂輸入被拒絕

自訂輸入必須是合法 JSON，且參數名稱要和題目相同。可以先用第一筆可見測資當範本。

### 題目沒有出現在列表

後端會跳過無效題目資料夾。請確認資料夾中有合法的 `problem.json` 與 `testcases_visible.json`。

也請透過 workspace 指令啟動後端，讓它能找到題目資料：

```bash
npm run dev:backend
```
