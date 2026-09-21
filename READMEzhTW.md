# JustCode

[English](README.md) | [繁體中文](READMEzhTW.md)

JustCode 是在自己電腦上執行的刷題練習工具。你可以選擇題目，在瀏覽器撰寫 Java 或 Python3 解答，再用本機測資檢查答案。**測資**就是一組輸入，以及程式應該回傳的正確答案。

React 前端是你操作的網頁；Express 後端負責讀取題目檔案與執行程式。題目和進度都存放在 `problems/`，一般本機使用不需要帳號、資料庫、API key 或雲端服務。

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

第一次使用請先看[快速開始](#快速開始)，再跟著[完成第一道題目](#完成第一道題目)操作。目前介面使用英文，兩份指南都保留實際按鈕名稱，方便對照。

- [主要功能](#主要功能)
- [快速開始](#快速開始)
- [內建題目](#內建題目)
- [練習操作指南](#練習操作指南)
- [匯入題目與隱藏測資](#匯入題目與隱藏測資)
- [本機檔案、備份與自訂題目](#本機檔案備份與自訂題目)
- [設定與執行限制](#設定與執行限制)
- [常用指令與驗證](#常用指令與驗證)
- [預覽建置結果](#預覽建置結果)
- [實作內容與作品集說明](#實作內容與作品集說明)
- [目前限制](#目前限制)
- [專案結構](#專案結構)
- [API 簡介](#api-簡介)
- [疑難排解](#疑難排解)
- [授權資訊](#授權資訊)

## 主要功能

- 瀏覽題目難度、標籤，以及已嘗試／已通過狀態。
- 使用 Monaco 編輯器撰寫 Java 或 Python3，切換語言時保留另一份程式碼，也能還原範本、調整字級。
- 執行可見測資、嘗試自訂 JSON 輸入，或提交並執行可見與隱藏測資。
- 顯示答案通過、答案錯誤、語法／編譯錯誤、執行錯誤、逾時、編輯器錯誤標記，以及可見測資的詳細結果。
- 自動儲存各題程式碼與通過提交的計時紀錄，儲存失敗時提供訊息與重試操作。
- 匯入 LeetCode 公開題目敘述、範例、限制條件、Java／Python3 範本與範例測資。
- 下載 Markdown 題目摘要；從貼上的 JSON、瀏覽器選取的檔案或專案相對路徑匯入隱藏測資。
- 閱讀 Markdown 題解，支援表格、相鄰程式碼區塊的語言分頁與複製按鈕；可調整題目、編輯器及主控台面板大小。
- 在本機統計面板比較自己的通過紀錄；確認後可刪除非內建題目。
- 使用獨立暫存目錄執行程式，限制執行時間與輸出量，並可選用本機執行環境或 Docker 容器。

## 快速開始

### 需要安裝什麼

| 工具 | 何時需要 |
| --- | --- |
| Node.js 與 npm | 必備，用來執行 App。本指南以 Node.js 22 驗證；鎖定的 Vite 相依版本接受 Node.js `18.x`、`20.x` 或 `>=22`，`install.sh` 則只檢查最低為 18。 |
| JDK 11 或更新版本 | 本機執行 Java 時需要。JDK 同時包含 `javac` 編譯器與 `java` 執行環境。 |
| Python 3.9 或更新版本 | 本機執行 Python3 時需要。可執行指令必須叫做 `python3`；排序題範本使用 `list[int]` 型別註記。 |
| Docker | 選用，可取代本機 Java／Python 安裝。使用前請先啟動 Docker，並依[設定章節](#設定與執行限制)下載所需映像檔（image）。 |
| Git | 只有使用 `git clone` 下載專案時需要；也可以下載並解壓縮 repository 的 ZIP。 |

第一次嘗試，安裝 Node.js／npm 加上**一種**本機語言執行環境即可。完整執行器測試則需要 Java 與 Python 兩者。指令以 macOS、Linux、Windows 為使用對象，shell 輔助腳本限 macOS／Linux；本次文件驗證在 macOS 進行，並未逐一實測所有平台。

在 macOS／Linux 開啟終端機，或在 Windows 開啟 PowerShell。先檢查 Node.js，以及你安裝的語言：

```bash
node --version
npm --version
```

使用 Java 時，兩個指令都要能執行：

```bash
javac --version
java --version
```

使用 Python 時：

```bash
python3 --version
```

### 下載、安裝與啟動

如果還沒有專案：

```bash
git clone https://github.com/TsengPinRuei/JustCode.git
cd JustCode
```

如果已經下載，請在**專案根目錄**開啟終端機，也就是同時包含 `package.json`、`frontend/`、`backend/`、`problems/` 的資料夾。除非另有說明，後續指令都在這裡執行。

```bash
npm install
npm run dev
```

`npm install` 會透過 npm workspaces 一次安裝前後端相依套件，通常只在初次安裝或相依套件變更後執行。macOS／Linux 可改用 `./install.sh` 取代 `npm install`；它會檢查 Node.js／npm 並安裝套件，但不會安裝 Java、Python 或 Docker。請使用一般帳號執行，不要加 `sudo`。

保持終端機開啟，接著用瀏覽器開啟 [http://localhost:5173](http://localhost:5173)。API 位於 [http://localhost:3000](http://localhost:3000)；[健康檢查網址](http://localhost:3000/health)應回傳含有 `"status":"ok"` 的 JSON。3000 是後端連接埠，不是 App 頁面。如果 Vite 改用了其他可用連接埠，請開啟終端機印出的網址。

安裝相依套件與 LeetCode 匯入需要網路。安裝後，內建題目與編輯器可以在本機使用；Monaco 及其 worker 已打包在專案中，選用的 Google 字型無法載入時會使用系統字型。

要停止時，先等待進度儲存完成，再於伺服器終端機按 `Ctrl+C`。下次使用只需回到根目錄執行 `npm run dev`。

### 完成第一道題目

1. 在題目列表開啟 **-27. Add Two Integers**。
2. 在編輯器上方選擇 **Java** 或 **Python3**。
3. 將編輯器內容換成下方對應的完整範例。原本的起始範本刻意留空，等待你實作。

Java：

```java
class Solution {
    public int sum(int num1, int num2) {
        return num1 + num2;
    }
}
```

Python3：

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        return num1 + num2
```

4. 在 **Testcase** 選擇 **Case 1**，按 **Run**；應看到 **Accepted**，通過 **2 / 2** 筆可見測資。
5. 按 **Submit**；若使用未修改的內建測資，應看到 **Accepted**，通過 **52 / 52** 筆測資。
6. 展開 **Stats** 查看新的通過紀錄，再透過 **Problems** 回到列表，這題應出現已通過的勾號。

請保留範本的 `Solution` 類別、方法名稱、參數及回傳型別。用 `return` **回傳答案**；`print` 或 `System.out.println` 只算除錯輸出。你不需要自己撰寫 `main` 或讀取標準輸入，JustCode 會產生呼叫解答的程式。

## 內建題目

以下為這個版本隨附的資料；自行修改或匯入測資後，數量會改變。

| 題目 | 難度 | 語言 | 可見／隱藏測資 | 隨附題解 |
| --- | --- | --- | --- | --- |
| [-27. Add Two Integers](problems/add-two-integers/problem.json) | Easy | Java、Python3 | 2 / 50 | [直接相加與位元運算解法](problems/add-two-integers/editorial.md) |
| [-09. Sort an Array](problems/sort-array/problem.json) | Medium | Java、Python3 | 3 / 70 | [快速、合併、堆積、計數及基數排序](problems/sort-array/editorial.md) |

兩題都附有範本與可見／隱藏測資，並受 UI／API 保護，不能刪除。建議先用加法確認安裝，再用排序練習演算法與比較解法。排序題敘述要求自行實作排序；判題程式只檢查輸出與執行限制，不會判斷你是否使用內建排序函式，也不會證明演算法的時間複雜度。

## 練習操作指南

### Run、自訂輸入與 Submit

| 操作 | 會執行什麼 | 成功代表什麼 |
| --- | --- | --- |
| 選取 **Case** 分頁後按 **Run** | 所有可見測資，而非只跑畫面上那一筆 | 回傳值符合這些可見答案，不會把題目標為已通過。 |
| **Testcase → Custom Input → Run** | 你輸入的一筆資料 | 程式成功執行並回傳值。沒有預期答案可供比對，即使摘要顯示 **Accepted** 也一樣。 |
| **Submit** | 所有可見測資，加上目前本機隱藏測資 | 全部通過後標記已解題並新增 AC 紀錄；不使用 Custom Input 文字框。 |

Add Two Integers 的 **Custom Input** 可以填：

```json
{"num1": 12, "num2": 5}
```

Sort an Array 則可以填：

```json
{"nums": [5, 2, 3, 1]}
```

請使用合法 JSON：欄位名稱／字串使用雙引號，不可加註解或在最後多加逗號。只填輸入物件，不要包成 `input`／`output` 格式。欄位名稱必須和題目參數完全一致；第一次開啟 **Custom Input** 會先帶入第一筆可見輸入供你修改。

### 看懂執行結果

| 狀態 | 意思 | 可以檢查什麼 |
| --- | --- | --- |
| **AC — Accepted** | 所有拿來比對的測資通過，或自訂輸入成功執行 | 要留下解題紀錄請用 Submit；匯入題目可能尚無隱藏測資。 |
| **WA — Wrong Answer** | 回傳值和預期答案不同 | 比較 Input、Expected、Actual，檢查邊界情況與陣列順序。 |
| **CE — Compilation Error** | Java 編譯或 Python 語法檢查失敗 | 看錯誤訊息及編輯器標記，檢查縮排、名稱、型別與語法。 |
| **RE — Runtime Error** | 執行出錯，或語言環境／沙盒無法正常啟動 | 看錯誤訊息，檢查例外、支援型別及語言環境安裝。 |
| **TLE — Time Limit Exceeded** | 編譯、單筆測資或整次請求超過時間限制 | 檢查迴圈與演算法成本，並參考下方執行限制。 |

**Result** 會顯示可見測資的值與時間。對隱藏測資，Submit 會顯示總數，以及最多第一筆失敗隱藏測資的編號、狀態、時間；不顯示隱藏輸入、答案、例外訊息或除錯輸出。**Console Output** 只顯示失敗可見測資的除錯輸出，成功執行時不會顯示。

### 編輯器、進度與統計

- 語言選單會分別保留 Java 與 Python3 程式碼。**Reset** 會立刻以範本覆寫並儲存目前語言的程式碼，但保留另一種語言及既有解題紀錄；重設前請先複製想保留的內容。
- **A−／A+** 可將字級調整為 12 至 24。拖曳分隔線可調整題目／編輯器、編輯器／主控台的比例。**Description** 顯示題目，**Editorial** 顯示解說與可複製的程式碼。
- 停止編輯約一秒後會自動儲存。切換語言與新增 AC 紀錄會立即發出儲存請求，切換頁面也會嘗試送出尚未儲存的內容。若出現 **Changes have not been saved**，請保留頁面、先複製程式碼、恢復後端連線，再按 **Retry save**。失敗草稿只暫存在瀏覽器記憶體，不是可長期保存的離線資料。
- 未開始的題目沒有狀態圖示；編輯後為已嘗試（**◐**），Submit 通過後為已解題（**✓**）。後續修改或提交失敗不會清除已解題狀態。
- **Stats → Current** 計算從開啟題目或上次提交通過起的實際經過時間，包含閒置時間。重新整理／重開題目會重新計時；**Best Total** 是已儲存通過紀錄中最短的解題總時間。
- **Latest Submit** 是最近一筆 AC 提交在瀏覽器量到的請求耗時，包含編譯、程序啟動、測試與請求往返。**Latest Rank** 先依這項耗時，再依解題總時間與時間戳記排列本題的本機 AC 紀錄；它不是全球排名或受控的演算法效能測試。
- 紀錄包含時間、語言、時間戳記與通過／總測資數。每種語言只保存最新草稿，不會保存每次提交的完整程式碼歷史。

## 匯入題目與隱藏測資

### 從 LeetCode 匯入

1. 在 **Problems** 按 **Import from LeetCode**。
2. 貼上例如 `https://leetcode.com/problems/two-sum/` 的網址，再按 **Import**。
3. 成功後在列表開啟新題目；檔案會放在 `problems/two-sum/`。

匯入器透過 LeetCode GraphQL 端點取得公開題目資料並解析敘述／範例，儲存 Java／Python3 程式碼片段及公開範例測資。它**不會**取得 LeetCode 私有判題測資或題解，而是建立空的 `testcases_hidden.json`。新增測資前，Submit 通過只代表匯入的範例通過。你可以自行加入 `editorial.md`，否則 Editorial 分頁會顯示 `Editorial coming soon...`。

匯入已存在的 ID 會回傳 HTTP 409，不覆寫範本、進度或隱藏測資。設計類別型題目會被拒絕；需要 `ListNode`、`TreeNode` 等自訂結構的題目可能能匯入，但目前 runner 尚無法使用這些結構。LeetCode 回應格式變動或公開資料不可用，也可能使匯入失敗。

若要移除非內建題目，按列表中的垃圾桶圖示並確認。這會刪除**整個題目資料夾**，連同已儲存的程式碼與紀錄；需要保留時請先備份。

### 新增隱藏測資

1. 開啟題目，按 **Download Description** 下載 `<problem-id>-description.md`。摘要包含題目、範例、限制、函式資訊與隱藏測資 JSON 格式範例，不會自動產生測資。
2. 準備額外測資，並確認預期答案正確。
3. 按 **Add Hidden Tests**，選 **Append** 保留舊測資並追加，或選 **Replace** 覆寫整份隱藏測資。
4. 選 **Paste JSON** 貼上內容，或按 **Choose File** 選取本機 JSON／文字檔；也可選 **Project Path**，輸入專案內路徑，例如 `tmp/generated-hidden-tests.json`。
5. 按 **Import Hidden Tests**，確認顯示的數量，再按 **×** 關閉視窗，使用 **Submit** 執行更新後的測資。

**Sort an Array** 可以使用以下隱藏測資檔：

```json
[
  {"input": {"nums": [3, 1, 2]}, "output": [1, 2, 3]},
  {"input": {"nums": [0, -1, 0]}, "output": [-1, 0, 0]}
]
```

格式必須是**非空陣列**，每項包含 `input` 與 `output`。輸入欄位必須和 `problem.json` 的 `params` 完全一致，值與預期輸出也須符合該題；結構驗證不會證明預期答案正確。Replace 只修改隱藏測資，不會清除既有已解題狀態或紀錄；要確認舊解法能否通過新測資，請重新 Submit。

瀏覽器選取的檔案會包進 JSON 請求，**10 MiB** 上限包含外層格式與跳脫字元。**Project Path** 則讀取專案內最大 **64 MiB** 的既有一般檔案。路徑從專案根目錄開始，不是從「下載」資料夾開始；若使用範例 `tmp/` 路徑，請自行建立資料夾和檔案。絕對路徑、資料夾、不存在的檔案及逃出專案範圍的路徑都會被拒絕。

## 本機檔案、備份與自訂題目

### 每個檔案存什麼

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

| 檔案 | 用途與要求 |
| --- | --- |
| `problem.json` | 必備的題目資料：識別資訊、敘述、範例、限制、語言與函式資訊。`id` 必須等於資料夾名稱。 |
| `template.java`／`template.py` | 對應 `java`／`python3` 的起始程式碼；建議為每種支援語言準備一份。缺少範本時會開啟空白編輯器，範本也不等於完整解答。 |
| `testcases_visible.json` | 必備，非空 JSON 陣列，每項為 `{ "input": {...}, "output": ... }`；Run 與 Submit 都會使用。 |
| `testcases_hidden.json` | 選用，格式同上，可以是 `[]`，只有 Submit 使用。匯入題目時建立空檔。 |
| `editorial.md` | 選用的 Markdown 題解。語言標記不同且相鄰的 fenced code blocks，可顯示為語言分頁。 |
| `progress.json` | App 管理的狀態、各語言程式碼、選用語言、AC `solveRecords` 與 `lastUpdated`。儲存進度時建立／更新，不是範本或測資檔。 |

`problem.json` 的顯示用範例與真正執行的測資是分開的。修改敘述中的範例不會改變判題內容，還要同步修改測資檔。

### 備份、還原或重新開始

1. 等待儲存完成、關閉 App 分頁，再用 `Ctrl+C` 停止伺服器。
2. 使用 Finder／檔案總管，把整個 **`problems/` 資料夾**複製到另一個備份位置。這會保留匯入題目、範本、題解、可見／隱藏測資、程式碼與紀錄。`node_modules/`、`dist/`、`temp/` 不是進度資料。
3. 還原時保持 App 停止，先另外保留需要的新資料，再將要還原的題目資料夾放回 `problems/`，執行 `npm run dev` 重新啟動。
4. 若只想重做一題，先備份，再於 App 停止時刪除**該題的 `progress.json`** 即可。重開後會使用範本，不再有已儲存狀態或紀錄；這和編輯器的 Reset 不同。

`npm run clean` 與 `./uninstall.sh` 會移除相依套件、建置結果和暫存檔，但保留 `problems/` 及 `package-lock.json`，不會清空練習紀錄。

目前 `.gitignore` 忽略額外題目資料夾，但保留兩個內建題目。**內建題目的 `progress.json` 已被 Git 追蹤**，因此練習後可能出現已追蹤檔案變更，下載的版本也可能帶有作者儲存的進度。匯入題目不會自動包含在 Git 備份中；發布專案或建立 commit 前，請查看 `git status`，明確選擇要納入的題目資料與個人程式碼。

### 不透過 LeetCode 建立自己的題目

第一次可以沿用加法題練習：

1. 停止 App，將 `problems/add-two-integers/` 複製為 `problems/my-addition/`。
2. 修改新資料夾的 `problem.json`：`id` 改成 `my-addition`，`title` 改成自己的標題，並移除複製過來的 `progress.json`，讓它從頭開始。
3. 這次先保留 `sum` 函式與原有測資；若修改題意，也要更新敘述與題解。
4. 啟動 App 並重新整理列表，開啟新題目、完成範本，再依序 Run、Submit。

若要設計不同函式，請一起調整以下欄位：

| 題目資料 | 必須對應的內容 |
| --- | --- |
| `id` | 資料夾名稱：1–200 個小寫字母、數字、`_` 或 `-`，第一字元必須是字母或數字。 |
| `difficulty`、`tags`、`description`、`examples`、`constraints` | 難度只能是 `Easy`、`Medium`、`Hard`；標籤／限制用字串陣列，顯示範例的 input／output 用字串。 |
| `supportedLanguages`、`functionSignatures` | 語言為 `java` 及／或 `python3`，每個列出的語言都要有顯示用函式簽名。 |
| `functionName`、`params`、`returnType` | 對應 `Solution` 中真正的方法；參數名稱／順序／型別與回傳值須符合 runner 和測資，新題目請完整填寫。 |

可參考上方連結的內建 `problem.json` 完整範例。測資輸入欄位須和 `params` 完全一致；JSON／Markdown 可以用文字編輯器修改，外部修改後請重新整理瀏覽器。新資料夾和匯入題目套用相同 Git 忽略規則，非內建資料夾也能從 UI 刪除。

## 設定與執行限制

不需要 `.env` 檔，程式也不會自動載入它。請在**啟動後端之前**於終端機設定環境變數，修改後重新啟動。

| 變數 | 預設值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | 後端連接埠；修改時也要更新 `frontend/vite.config.ts` 中 `/api` 的代理目標。 |
| `JUSTCODE_SANDBOX_MODE` | `auto` | 執行模式：`auto`、`docker` 或 `local`。 |
| `JUSTCODE_JAVA_SANDBOX_IMAGE` | `eclipse-temurin:17-jdk` | Java 執行映像檔。 |
| `JUSTCODE_PYTHON_SANDBOX_IMAGE` | `python:3.11-slim` | Python 執行映像檔。 |
| `JUSTCODE_DOCKER_MEMORY` | `256m` | 每個執行容器的記憶體限制。 |
| `JUSTCODE_DOCKER_CPUS` | `1` | 每個執行容器的 CPU 限制。 |
| `JUSTCODE_DOCKER_PIDS_LIMIT` | `64` | 每個執行容器的程序數限制。 |

| 模式 | 行為 |
| --- | --- |
| `auto` | Docker 服務與所需本機映像檔可用時使用 Docker，否則退回本機執行；不會自動下載映像檔。 |
| `docker` | 必須有 Docker 和設定的映像檔；不可用時直接失敗，不會退回本機。執行不完全信任的程式碼時請用此模式。 |
| `local` | 使用本機 `javac`、`java`、`python3`，不透過 shell，並縮減環境變數。這不構成隔離／安全邊界：程式仍有你帳號的檔案存取能力。 |

Docker 模式會停用容器網路，使用唯讀根檔案系統、移除 capabilities 並限制資源；只掛載執行暫存目錄，在編譯需要時才允許該目錄寫入。這些是本機練習工具的執行控制，不代表已達正式線上判題服務的隔離保證。

先啟動 Docker Desktop 或 Docker 服務，再下載要使用的語言映像檔：

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

macOS／Linux 以 Docker 模式啟動：

```bash
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

Windows PowerShell：

```powershell
$env:JUSTCODE_SANDBOX_MODE = "docker"
npm run dev
```

將 `docker` 改成 `local` 或 `auto` 即可切換模式。PowerShell 的設定會留在同一個終端機，直到修改或關閉終端機。Docker 只負責執行解答，啟動 App 本身仍需要 Node.js。

| 限制 | 目前值 |
| --- | --- |
| Java 編譯／Python 語法檢查 | 10 秒 |
| 每筆測資 | 1 秒 |
| 整次 Run／Submit 執行 | 60 秒，包含準備／編譯 |
| 前端等待 Run／Submit | 75 秒 |
| 每個程序 stdout／stderr 合計 | 10 MiB；整次提交保留的除錯輸出也有 10 MiB 上限 |
| 同時 Run／Submit 請求 | 2 筆，額外請求回傳 HTTP 429，不會排隊 |
| JSON 請求內容／本機資料檔 | 10 MiB／64 MiB |

時間／輸出限制位於 [constants.ts](backend/src/constants.ts)，同時執行數位於 [problemRoutes.ts](backend/src/routes/problemRoutes.ts)，請求限制位於 [app.ts](backend/src/app.ts)，檔案限制位於 [storage.ts](backend/src/services/storage.ts)，前端逾時位於 [apiClient.ts](frontend/src/services/apiClient.ts)。這些限制沒有環境變數可覆寫。

## 常用指令與驗證

請在專案根目錄執行。這裡的 **workspace** 指由 npm 一起管理的前端／後端套件。

| 指令 | 用途 |
| --- | --- |
| `npm install` | 安裝 workspace 相依套件。 |
| `npm run dev` | 啟動兩個開發伺服器。 |
| `npm run dev:backend`／`npm run dev:frontend` | 只啟動其中一個開發伺服器。 |
| `npm test` | 執行既有回歸測試；請安裝本機 Java 和 Python，才能涵蓋所有語言案例。 |
| `npm run typecheck` | 檢查前端、後端及 Vite 設定型別，不產生建置檔。 |
| `npm run build` | 將前後端分別建置至 `frontend/dist/`、`backend/dist/`。 |
| `npm run build:frontend`／`npm run build:backend` | 只建置其中一個套件。 |
| `npm run start:backend` | 啟動已建置的後端，請先建置。 |
| `npm run preview --workspace=frontend` | 預覽已建置前端，請先建置並保持後端啟動。 |
| `npm run clean` | 移除相依套件、建置結果與執行暫存檔。 |
| `npm run clean:modules` | 移除 workspace 的 `node_modules/` 資料夾。 |
| `npm run clean:build` | 移除建置結果、Vite 快取與 TypeScript build-info 檔。 |
| `./install.sh`／`./uninstall.sh` | macOS／Linux 安裝與清理腳本；移除時會詢問確認，`--yes` 表示明確略過確認。 |

修改專案後請執行：

```bash
npm test
npm run typecheck
npm run build
```

目前沒有獨立 lint script。測試涵蓋請求驗證／本機存取、儲存與同時寫入、匯入解析、進度儲存順序、結果解析與隱藏資料遮蔽、執行器錯誤／逾時、沙盒程序清理、題解程式及清理腳本；詳見 [tests/](tests/)。

缺少 `javac` 或 `python3` 時，部分執行器測試會**略過**，請檢查 skipped 數量後再判定是否完整驗證。若要固定使用本機執行器，可在 `npm test` 前設定 `JUSTCODE_SANDBOX_MODE=local`。匯入測試使用模擬 LeetCode 回應，Docker 參數／清理測試也模擬程序執行；測試通過不代表已確認即時 LeetCode 連線或真實 Docker 環境可用。

## 預覽建置結果

平常練習以 `npm run dev` 最容易開始。若要在本機使用建置結果，先停止開發伺服器，再執行：

```bash
npm run build
npm run start:backend
```

保留這個終端機，另開**第二個終端機**，同樣進入專案根目錄：

```bash
npm run preview --workspace=frontend
```

開啟 Vite 印出的網址，通常是 [http://localhost:4173](http://localhost:4173)。目前 Vite 設定會讓 preview 使用 `/api` 代理至 `127.0.0.1:3000`，因此後端也必須保持啟動。已建置後端也能在根目錄用 `node backend/dist/server.js` 啟動，題目儲存位置會以模組路徑解析。

Vite preview 用來在本機檢查建置結果。後端不提供前端靜態檔，也沒有同時啟動兩者的正式環境指令。若換成其他靜態伺服器，必須把 `/api` 轉發到後端，並為 `/problems/add-two-integers` 等前端路由提供 `index.html`。只有靜態網站託管無法執行 Java／Python 或儲存檔案。後端綁定 `127.0.0.1` 並拒絕外部 Host／Origin，本專案的使用範圍是本機。

## 目前限制

- 適用於單一本機使用者，沒有登入、雲端同步、共享進度、資料庫或全球排行榜。請使用一個後端，避免多個分頁同時編輯同一題；目前沒有跨分頁或跨程序的衝突解決機制。
- 導覽列的 **Explore** 與 **Discuss** 是停用的占位項目，尚未實作功能。
- 只實作 Java 與 Python3 runner，會呼叫 `Solution` 的方法並判斷回傳值；尚未實作自訂節點結構、設計類別 API 或 `void`／只原地修改資料的判題模式。
- Java 輸入轉換支援特定的基本型別、陣列與 list，Python 接收 JSON 形式的值；不是所有匯入型別名稱都能執行。擴充型別前請參考 [Java 型別對應](backend/src/services/javaExecutor.ts)。
- JSON 比對忽略物件欄位順序，但保留陣列順序與值的型別差異，沒有無序答案、浮點誤差容忍或多種合法答案的特殊判題器。
- 隱藏測資是本機檔案，只是不透過一般前端回應顯示，無法對電腦擁有者保密；不提供 LeetCode 官方隱藏測資或帳號提交同步。
- 資料驗證檢查結構與參數名稱，不會驗證演算法複雜度、每筆輸入的所有題目限制，或人工填寫的預期答案是否正確。
- 本機執行不構成安全沙盒；Docker 模式提供前述執行控制，整體仍是個人練習工具。

## 專案結構

```text
JustCode/
├── backend/
│   ├── src/
│   │   ├── app.ts                # Express 中介層、本機存取、健康檢查
│   │   ├── server.ts             # 僅綁定 loopback 的伺服器入口
│   │   ├── constants.ts          # 執行限制與 Docker 設定
│   │   ├── requestValidation.ts  # 請求與進度驗證
│   │   ├── routes/               # 題目、判題、匯入與進度端點
│   │   ├── services/             # 儲存、匯入、runner、沙盒、JSON 處理
│   │   └── types.ts              # 後端共用資料型別
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── public/                   # 靜態資源
│   ├── src/
│   │   ├── components/           # 編輯器、結果、統計、測資、Markdown、面板
│   │   ├── pages/                # 題目列表與解題工作區
│   │   ├── plugins/              # Markdown 程式碼群組轉換
│   │   ├── services/             # API 客戶端、儲存順序、本機 Monaco 設定
│   │   ├── types/                # 前端資料型別
│   │   ├── App.tsx               # 路由與未儲存變更處理
│   │   ├── main.tsx              # 瀏覽器入口
│   │   └── index.css             # App 樣式
│   ├── index.html
│   ├── vite.config.ts            # 開發／預覽 API 代理
│   └── package.json
├── problems/
│   ├── add-two-integers/
│   └── sort-array/
├── tests/                        # 回歸測試
├── install.sh
├── uninstall.sh
├── .gitignore                    # 包含題目資料忽略規則
├── package.json                  # Workspace 指令
├── package-lock.json             # 已解析的相依套件版本
├── README.md
└── READMEzhTW.md
```

執行後產生的資料夾包含 `node_modules/`、前後端 `dist/`，以及後端工作目錄下的 `temp/` 執行暫存目錄；用 workspace 指令時通常位於 `backend/temp/`。每次執行結束會清理該次暫存工作目錄，這些不是題目儲存位置。

## API 簡介

一般使用只需操作瀏覽器；此表供開發者參考。前端透過 Vite 代理送出相對 `/api` 請求，請求／回應使用 JSON。

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 後端健康檢查。 |
| `GET` | `/api/problems` | 列出有效題目資料。 |
| `GET` | `/api/problems/:id` | 讀取題目、範本、可見測資及選用題解，不含隱藏測資內容。 |
| `POST` | `/api/run` | 執行所有可見測資或一筆自訂輸入。 |
| `POST` | `/api/submit` | 執行可見與隱藏測資並判題。 |
| `POST` | `/api/import-problem` | 匯入公開 LeetCode 題目 URL。 |
| `POST` | `/api/problems/:id/hidden-testcases` | 從 JSON 內容或專案相對路徑追加／取代隱藏測資。 |
| `GET` | `/api/progress` | 讀取各題儲存的進度。 |
| `GET` | `/api/progress/:id` | 讀取單題進度；缺檔或隨附的空白進度占位資料會回傳 `null`。 |
| `PUT` | `/api/progress/:id` | 儲存經驗證的進度，並設定更新時間戳記。 |
| `DELETE` | `/api/problems/:id` | 刪除非內建題目與其資料。 |

直接呼叫 API 時，`/api/submit` 只回傳判題結果；瀏覽器收到 AC 後，才建立紀錄並另外透過進度端點儲存。讀取損毀進度會回報錯誤，不會悄悄改成空白進度。請求格式請參考[後端型別](backend/src/types.ts)及[請求驗證](backend/src/requestValidation.ts)。

## 疑難排解

| 情況 | 處理方式 |
| --- | --- |
| 找不到 `npm` 或 `package.json` | 安裝 Node.js／npm，重新開啟終端機並進入專案根目錄。Windows 請用 npm 指令，不要執行 `.sh` 腳本。 |
| App 無法載入題目 | 查看[後端健康檢查](http://localhost:3000/health)及伺服器終端機。改過 `PORT` 時，更新 `frontend/vite.config.ts` 代理並重啟 Vite；使用 localhost，不要改成區網／公開網址。 |
| 3000 或 5173 連接埠被占用 | 回到先前啟動 JustCode 的終端機按 `Ctrl+C`。Vite 若改用其他前端連接埠，請開啟它印出的網址；停止不認識的程序前，先確認連接埠擁有者。 |
| Java 無法執行 | 確認 `javac --version` 和 `java --version` 都能執行，安裝 JDK 而非只有 JRE；保留 `class Solution` 與預期方法簽名。 |
| Python 無法執行 | 確認 `python3 --version` 可用。Windows 也會呼叫 `python3`，只有 `python` 或 `py` 不夠；也可以使用 Docker 模式。 |
| Docker 執行失敗 | 啟動 Docker，查看 `docker info` 並下載設定的映像檔；`docker` 模式不可用時會失敗，`auto` 則可能退回本機。 |
| Run／Submit 逾時或忙碌 | 檢查無窮迴圈與上方限制。HTTP 429 表示需等既有工作完成再試；Docker／程序啟動也可能增加觀察到的時間。 |
| LeetCode 匯入失敗 | 使用 `https://leetcode.com/problems/<problem-slug>/`，檢查連線與錯誤訊息。重複 ID 不會覆寫；設計類別題或變動後的遠端資料格式可能不支援。 |
| 題目匯入成功卻不能執行 | 檢查題目資料與範本是否使用不支援的結構／回傳型別，或缺少 import；匯入成功不代表 runner 一定相容。 |
| 自訂輸入／隱藏測資被拒絕 | 確認 JSON 格式及參數名稱。隱藏測資匯入需要非空陣列；Project Path 須指向專案內既有一般檔案，也請檢查 10／64 MiB 限制。 |
| 題目沒出現在列表 | 檢查資料夾名稱、相同的 metadata `id`、有效題目資料及非空可見測資；後端會略過無效資料夾並印出警告。 |
| 編輯器空白或範本不能執行 | 範本可能缺檔，或方法內容刻意未完成；可先試第一題範例，自訂題目則補上對應語言範本。 |
| 進度無法載入／儲存 | 先複製編輯器內容、查看錯誤／伺服器紀錄，再用 Retry／Retry save。若 `progress.json` 損毀，先備份再修復，或移除以重新開始；後端刻意不覆寫損毀進度。 |
| Run 可用，Submit 卻無法讀取測資 | 備份並檢查 `testcases_hidden.json`。缺檔代表沒有隱藏測資，但 JSON 損毀會報錯；請修復，或確認後透過 Add Hidden Tests 取代。 |
| AC 時看不到除錯輸出 | 成功執行會刻意隱藏除錯輸出，請查看回傳值；只在失敗的可見測資顯示除錯內容。 |

-----

## 實作內容與作品集說明

| 面向 | 已實作行為 | 對應程式 |
| --- | --- | --- |
| 全端練習介面 | React／TypeScript、Monaco 編輯器、各語言草稿、可調面板、Markdown 題解與統計 | [ProblemDetail](frontend/src/pages/ProblemDetail.tsx)、[元件](frontend/src/components/)、[前端相依套件](frontend/package.json) |
| Java／Python 判題 | 依函式資料產生 runner，編譯／檢查語法、執行測資、比較 JSON 值並回傳診斷 | [執行器工廠](backend/src/services/codeExecutorFactory.ts)、[Java](backend/src/services/javaExecutor.ts)、[Python](backend/src/services/pythonExecutor.ts)、[共用結果邏輯](backend/src/services/executionUtils.ts) |
| 執行控制 | 本機／Docker 切換、執行期限、輸出上限、程序清理及同時請求數限制 | [沙盒 runner](backend/src/services/sandboxRunner.ts)、[路由](backend/src/routes/problemRoutes.ts) |
| 檔案式儲存 | 驗證資料、在單一後端程序內依題目依序寫入，先寫入並同步暫存 JSON，再重新命名替換正式檔案 | [儲存工具](backend/src/services/storage.ts)、[題目服務](backend/src/services/problemService.ts) |
| 題目匯入 | 驗證 URL／題目／測資，轉換 LeetCode 公開資料，完整寫好暫存資料夾後才加入題庫，且不覆寫既有題目 | [匯入器](backend/src/services/leetcodeService.ts)、[驗證](backend/src/services/problemValidation.ts)、[題目服務](backend/src/services/problemService.ts) |
| 進度保存可靠性 | 依題目排列儲存順序、在記憶體保留失敗草稿、提供重試及切頁時送出儲存 | [進度儲存](frontend/src/services/progressPersistence.ts)、[題目工作區](frontend/src/pages/ProblemDetail.tsx) |
| 回歸驗證 | API、資料完整性、同時操作、語言執行、沙盒處理、前端狀態與可執行題解案例 | [測試](tests/)、[指令設定](package.json) |

> 使用 React、TypeScript、Express 與 Monaco 開發本機刷題工具，支援 Java／Python3 執行、LeetCode 公開範例匯入、自訂／隱藏測資及進度自動儲存。實作檔案式資料保存、具選用 Docker 隔離的執行限制，並以回歸測試驗證判題、資料完整性與進度處理。
