# JustCode

[English](README.md) · **繁體中文**

JustCode 讓你在自己的電腦上練習 Java 和 Python。打開瀏覽器就能讀題、寫程式、測試答案，也能回頭查看每次提交時的程式碼與結果。使用時無須註冊帳號，安裝完成後，兩道內建題目都能離線練習。

**練習解題** · [快速開始](#快速開始) · [解出第一題](#解出第一題) · [草稿與練習紀錄](#草稿結果與練習紀錄)

**維護與開發** · [新增題目與測資](#新增題目與測資) · [備份與還原](#備份與還原) · [開發指南](#開發指南) · [疑難排解](#疑難排解)

## 快速開始

先安裝含 npm 的 Node.js。要直接在本機執行解題程式，再依語言選裝 **Python 或 JDK**。編輯器和 SQLite 驅動程式隨專案安裝。使用預設模式時，請執行自己撰寫或信任的程式碼。若 Docker 或對應語言的映像檔未就緒，解題程式會以你的帳號權限存取本機檔案。要固定在容器內執行，請下載語言映像檔並設定 `JUSTCODE_SANDBOX_MODE=docker`。[執行模式](#執行模式)

| 工具 | 版本 | 在終端機確認 |
| --- | --- | --- |
| [Node.js](https://nodejs.org/en/download) | 22 以上 | `node --version` 和 `npm --version` |
| [Python](https://www.python.org/downloads/) | 3.9 以上，供 Python 解題使用 | `python3 --version` · [Windows 設定](#windows-的-python-設定) |
| [Java 開發套件](https://adoptium.net/temurin/releases/) | JDK 11 以上，供 Java 解題使用 | `javac --version` 和 `java --version` |

1. 下載專案。有安裝 Git 的話，執行下列指令。也可以在 GitHub 選 **Code → Download ZIP**，解壓縮後，在含有 `package.json` 的資料夾開啟終端機。

   ```sh
   git clone https://github.com/TsengPinRuei/JustCode.git
   cd JustCode
   ```

2. 在專案資料夾安裝套件。**macOS 或 Linux** 執行 `npm ci`。**Windows PowerShell** 請使用最新修補版的 Node.js 22.x，執行 `npx --yes npm@11.20.0 ci`。
3. 啟動 JustCode。

   ```sh
   npm run dev
   ```

在桌面瀏覽器開啟終端機顯示的 **Local** 網址，預設是 [localhost:5173](http://localhost:5173)。首次啟動會在 **Problems** 看到兩道題目。練習時讓終端機保持執行。結束時，等草稿儲存與提交完成後按 `Ctrl+C`。下次在同一個資料夾執行 `npm run dev` 即可。

## 解出第一題

開啟 **-27. Add Two Integers**。第一組範例給你 `12` 和 `5`，預期答案是 `17`。JustCode 會呼叫 `Solution.sum` 並檢查回傳值。在 **Language** 選 **Python3** 或 **Java**，將編輯器內容換成對應的程式碼。

**Python3**

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        return num1 + num2
```

**Java**

```java
class Solution {
    public int sum(int num1, int num2) {
        return num1 + num2;
    }
}
```

| 操作 | 使用內建測資時會看到什麼 |
| --- | --- |
| 在 **Testcase** 選 **Case 1**，按 **Run**。 | 程式會跑完所有可見範例。**Result** 顯示 **Accepted**，通過 **2 / 2** 筆。 |
| 回到 **Testcase**，選 **Custom Input**，輸入 `{"num1": -3, "num2": 8}` 後按 **Run**。 | **Actual** 顯示 `5`。在自訂輸入模式，**Accepted** 表示程式執行成功，答案由你核對。 |
| 按 **Submit** 提交。 | 系統會用可見和隱藏測資判題。這份解答會顯示 **Accepted**，通過 **52 / 52** 筆，題目會標為已解出。只有 Submit 會建立提交紀錄，答錯的嘗試也會保存。 |
| 點題名旁的 **Submission history**，再點 **View**。 | 可以查看或複製該次提交的程式碼。 |

### 草稿、結果與練習紀錄

- 停止輸入約一秒後，編輯器會**自動儲存**。每道題目的 Java 和 Python 草稿分開保存。**Reset** 會用起始範本覆蓋目前語言的草稿。
- 遇到 **Wrong Answer**，先比對可見測資的預期答案 **Expected** 和實際回傳值 **Actual**。**Console Output** 顯示失敗的可見測資所印出的除錯訊息。隱藏測資會顯示通過筆數與總數，以及第一筆失敗測資的編號、狀態和耗時。
- **Activity** 依瀏覽器時區列出最近 30 天的提交次數、通過次數，以及練過和解出的題數。同一題只計入題數一次。可依題目、語言或日期篩選，再按 **Apply filters**。清空兩個日期後套用，即可查全部期間。
- 題目內的 **Stats** 可查看最快解題時間 **Best Total**。**Latest Submit** 是最近一次通過時的瀏覽器請求耗時，提交明細的 **Server judge** 則是後端判題耗時。

兩道內建題目的 **Editorial** 分頁都有解題思路及 Java、Python 範例。

| 題目 | 難度 | 可見／隱藏測資 | 題解 |
| --- | --- | --- | --- |
| [-27. Add Two Integers](problems/add-two-integers/problem.json) | 簡單 | 2 / 50 | [直接相加與位元運算](problems/add-two-integers/editorial.md) |
| [-09. Sort an Array](problems/sort-array/problem.json) | 中等 | 3 / 69 | [五種排序演算法與取捨](problems/sort-array/editorial.md) |

## 新增題目與測資

### 從 LeetCode 匯入

連上網路，在 **Problems → Import from LeetCode** 貼上公開題目網址，按 **Import**。題目敘述、可用的 Java／Python 範本與公開範例都會存到本機。公開範例會成為可見測資，隱藏測資一開始是空的。

選題時，請挑只需實作一個 `Solution` 方法、回傳值能用 JSON 表示的題目。類別設計題、使用 `TreeNode` 等自訂節點的題目，以及只檢查原地修改結果的題目，需要其他執行器。[可匯入的例題 Binary Search](https://leetcode.com/problems/binary-search/)

### 新增隱藏測資

開啟 **Sort an Array**，在 **Testcase** 點 **Add Hidden Tests**。選 **Append** 會保留原有測資並追加，選 **Replace** 會覆蓋整組隱藏測資。貼上下列 JSON 陣列，按 **Import Hidden Tests**，再按 **Submit** 就會使用更新後的測資。

```json
[
  {"input": {"nums": [3, -1, 3]}, "output": [-1, 3, 3]}
]
```

每筆 `input` 的欄位名稱要和題目參數一致，`output` 是預期回傳值。**Choose File** 可以載入 JSON 檔，**Project Path** 可以填入專案內既有檔案的相對路徑。需要參數或格式範例時，點題名旁的 **Download Description** 即可下載 Markdown 說明。

<details>
<summary>自行編寫一道題目</summary>

1. 將[內建加法題資料夾](problems/add-two-integers/)複製成 `problems/my-addition/`，在 `problem.json` 把 `id` 設為資料夾名稱。名稱最長 200 個字元，第一個字元為小寫英文字母或數字，其後也可用連字號與底線。
2. 編寫題名、敘述與範例。讓 `functionName`、`params`、`returnType` 與畫面顯示的方法簽名及各語言的 `template.java`、`template.py` 一致。
3. 在 `testcases_visible.json` 放入至少一筆輸入與預期答案。畫面上供閱讀的範例來自 `problem.json`。將複製來的 `testcases_hidden.json` 和 `editorial.md` 換成自己的測資與題解，這兩個檔案都可省略。
4. 重新整理 **Problems**，開啟新題目，用 **Run** 和 **Submit** 驗證。如果清單中找不到新題目，可以到後端終端機查看被略過的資料夾。

</details>

## 備份與還原

題庫放在 `problems/`。草稿、解題狀態、提交程式碼與結果存於 `data/justcode.sqlite`。Git 預設忽略個人練習資料和自行新增的題目。

1. 首次成功啟動後，等草稿儲存與提交完成。暫停編輯或匯入題目，在專案根目錄執行 `npm run data:backup`。終端機會顯示 SQLite 快照在 `data/backups/` 裡的位置。備份時後端可繼續執行。
2. **將快照和同一時間的 `problems/` 資料夾一起複製**到備份位置。複製完成後即可繼續編輯題庫。
3. 還原時**先停止後端**，將現有的 `data/` 和 `problems/` 移到別處保存。把備份題庫放回 `problems/`，建立新的 `data/`，將快照複製進去並命名為 `justcode.sqlite`。重新啟動後，開啟一份已儲存的草稿和提交紀錄確認。

在 **Problems** 刪除自行新增的題目，會一併刪除檔案、草稿與提交紀錄。若要保留，請先備份。兩道內建題目有刪除保護。

從舊版升級時，JustCode 會先將舊的 `progress.json` 備份到 `data/backups/legacy-*/` 再匯入。紀錄上的 **Imported** 表示該筆資料來自舊版保存的通過摘要。

## 開發指南

前端使用 React 和 Monaco 編輯器。Vite 將 `/api` 請求轉送到 `127.0.0.1:3000` 的 Express 後端。每個練習資料庫同時只由一個後端使用。收到 Submit 時，後端讀取該題測資，先將程式碼存進 SQLite，再於暫存目錄執行 Java 或 Python，最後將判題結果和解題狀態一起寫入。後端重啟時，上次尚在判題的提交會標為 **Interrupted**。

| 想修改的部分 | 從這裡看 |
| --- | --- |
| 編輯器、草稿或紀錄頁面 | [解題頁](frontend/src/pages/ProblemDetail.tsx) · [草稿儲存](frontend/src/services/progressPersistence.ts) · [練習紀錄](frontend/src/pages/Activity.tsx) |
| 題目匯入與格式驗證 | [LeetCode 匯入器](backend/src/services/leetcodeService.ts) · [題目檔案讀寫](backend/src/services/problemService.ts) · [格式驗證](backend/src/services/problemValidation.ts) |
| 語言執行與判題 | [Java 執行器](backend/src/services/javaExecutor.ts) · [Python 執行器](backend/src/services/pythonExecutor.ts) · [答案比對](backend/src/services/executionUtils.ts) |
| API、練習資料或備份 | [路由](backend/src/routes/problemRoutes.ts) · [練習資料庫](backend/src/services/practiceDatabase.ts) · [資料表與備份](backend/src/services/practiceSchema.ts) |

### 建置與測試

請在專案根目錄執行以下指令。完整測試需要 Java 和 Python。持續整合（CI）在 Linux 上使用 Node.js 22、JDK 17 與 Python 3.11 執行完整測試，另在 Linux、macOS 和 Windows 測試 SQLite 儲存功能。

| 用途 | 指令 |
| --- | --- |
| 型別檢查、回歸測試與建置 | 依序執行 `npm run typecheck`、`npm test`、`npm run build` |
| 瀏覽器測試 | 首次執行 `npx playwright install chromium` 安裝 Chromium，再執行 `npm run test:ui` |
| 單獨啟動前端或後端 | `npm run dev:frontend` 或 `npm run dev:backend` |
| 預覽建置結果 | 建置後，在一個終端機執行 `npm run start:backend`，另一個執行 `npm run preview --workspace=frontend`，開啟 Vite 顯示的網址。 |
| 清理已安裝的套件、建置產物與暫存檔 | `npm run clean` |
| 使用 macOS／Linux 輔助腳本 | [安裝套件](install.sh) · [互動式清理](uninstall.sh) |

送出 pull request 時，請說明改動及已執行的檢查。若要在推送前檢查提交內容是否夾帶本機練習檔案，可在自己的專案副本執行 `git config --local core.hooksPath .githooks` 啟用檢查。[CI 流程](.github/workflows/verify.yml) · [測試目錄](tests/) · [npm 指令](package.json) · [推送前檢查](.githooks/pre-push)

### 執行模式

`JUSTCODE_SANDBOX_MODE` 預設為 `auto`。Docker 服務和對應語言的映像檔就緒時，使用 Docker，其餘情況使用本機執行環境。`local` 模式下，解題程式具有目前作業系統使用者的檔案存取權限。設為 `docker` 可指定每次都使用容器，容器停用網路且根檔案系統唯讀。

啟動 Docker，再下載解題語言對應的映像檔。

```sh
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

macOS／Linux 使用 `JUSTCODE_SANDBOX_MODE=docker npm run dev` 啟動。在 PowerShell 先執行 `$env:JUSTCODE_SANDBOX_MODE = "docker"`，再執行 `npm run dev`。

<details>
<summary>API、判題限制與設定</summary>

- 使用 **HTTP API** 時，可用 `GET /health` 檢查服務，`GET /api/problems` 取得題庫，`POST /api/run` 執行可見測資或自訂輸入，`POST /api/submit` 記錄一次提交。`GET /api/submissions` 查詢提交歷史，`GET /api/stats/daily` 查詢每日統計。[完整路由](backend/src/routes/problemRoutes.ts) · [前端請求範例](frontend/src/services/apiClient.ts)
- 若要支援**提交重試**，每次新提交都給一個新的 UUID 作為 `submissionId`。重試時沿用相同 ID、題目、語言與程式碼，即可取回該筆結果。HTTP 202 表示仍在判題。以相同 ID 提交不同內容會回傳 409。
- **比對答案**時，陣列的元素順序須相同，物件的鍵順序可不同，浮點數須精確相等。API 會保留大整數的精度，處理超出 JavaScript 安全整數範圍的值時，請使用能保留精度的 JSON 解析器。Java 的 `int`、`long` 分別是有號 32、64 位元整數，題目型別 `float` 對應有限的 `double`。[數值規則](backend/src/services/numericContract.ts) · [JSON 處理](backend/src/shared/json.ts)
- Run 和 Submit **共用兩個執行名額**，HTTP 429 表示兩個名額都在使用中。編譯或語法檢查上限為 10 秒，每筆測資上限為 1 秒，整次編譯與測試共用 60 秒。[判題與 Docker 預設值](backend/src/constants.ts)
- 如果用 `PORT` 更改**後端連接埠**，請一併調整 Vite 的 `/api` 代理目標。可透過 `JUSTCODE_JAVA_SANDBOX_IMAGE`、`JUSTCODE_PYTHON_SANDBOX_IMAGE` 指定映像檔。[Vite 代理設定](frontend/vite.config.ts) · [容器設定](backend/src/services/sandboxRunner.ts)

</details>

## 疑難排解

| 遇到的情況 | 處理方式 |
| --- | --- |
| 頁面打得開，卻載不到題目 | 開啟[後端健康檢查](http://127.0.0.1:3000/health)確認是否顯示 `"status":"ok"`。若無回應，查看後端終端機。若回應正常，檢查 Vite 的代理設定。 |
| Java 或 Python 啟動失敗 | 在啟動 JustCode 的終端機執行「快速開始」的版本檢查指令。若使用 Docker，確認 `docker info` 和語言映像檔，再重啟後端。 |
| 出現 **Changes have not been saved** | 保持分頁開啟並複製程式碼，恢復後端連線後按 **Retry save**。 |
| 提交途中斷線 | 先查看 **Submission history**。若畫面出現 **Retry submission**，點選後會沿用原提交 ID 重試。 |

回報解題時遇到的錯誤，請附上題目 ID、使用語言、錯誤訊息，以及一組能重現問題的輸入。[JustCode 問題回報](https://github.com/TsengPinRuei/JustCode/issues)

### Windows 的 Python 設定

JustCode 會直接啟動 `python3.exe`。如果 PowerShell 只找得到 `py` 或 `python`，請安裝 Python 安裝管理員並執行 `pymanager install 3.11`。在「管理應用程式執行別名」啟用 **Python (default)** 的別名，再確認使用者環境變數 `Path` 包含 `%LOCALAPPDATA%\Microsoft\WindowsApps`。[Python 官方 Windows 安裝說明](https://docs.python.org/3/using/windows.html#python-install-manager)

重新開啟 PowerShell，執行以下指令。看到 Python 版本號，就表示 Node.js 能啟動直譯器。

```powershell
node -e "require('node:child_process').execFileSync('python3', ['--version'], { stdio: 'inherit' })"
```

在同一個視窗執行 `npm run dev`，用[第一題的 Python 解答](#解出第一題)按 **Run**，會看到 **2 / 2** 筆通過。

## 授權

Copyright © 2026 Pin Ruei Tseng。原始碼與隨附教材採用 MIT 授權。相依套件與匯入的題目各自適用其授權條款。[MIT 授權全文](LICENSE)
