**JustCode 程式碼註解完整審查 — 2026-09-21**

**修正完成 — 2026-09-22**

已完成本報告全部 359 筆建議，涵蓋 44 個檔案：後端 144 筆、前端 TypeScript／TSX／設定 97 筆、CSS／Shell／測試 49 筆、題解程式區塊 69 筆。已翻譯與重排註解、刪除冗餘內容、修正過時描述，並補上必要的限制、競態與演算法背景。沒有未完成項目。

驗證結果：

- `npm run typecheck`：通過。
- `npm test`：58 個測試全部通過，0 失敗、0 略過；包含生成 Java／Python 執行流程、10 份完整排序題解、進度儲存與匯入／檔案處理。
- `npm run build`：前後端皆成功。Vite 有部分 chunk 超過 500 kB 的大小提示，建置 exit code 為 0。
- `bash -n install.sh uninstall.sh`、`git diff --check`：通過。
- 53 個 source files、3 份 TypeScript 設定、2 份題解的最終掃描：未發現中文註解、行尾註解或不必要的區塊註解；保留必要的 CSS、JSX、shebang 及編譯器指令語法。
- TypeScript AST／前端去註解輸出、JSONC 設定值，以及 CSS、Shell、題解的非註解內容比對皆相同；生成 Java 原始碼只調整註解及相鄰空白。44 個報告指定檔案均有修改，沒有額外的程式檔案變更。

套用時依實作微調五處建議，使文字更精確：deadline 後只回傳已執行的可見測資；兩種耗時分別貼近各自欄位並使用 problem load；草稿與佇列各自說明 identity 清理條件；.app 的 viewport 說明包含導覽列；Python mask 說明改為迴圈在負數輸入下能終止。median-of-three 範例已明確說明目前僅計算 middle index，尚缺三值比較步驟。

下方保留 2026-09-21 的原始審查紀錄。表格中的問題描述與行號是修正前的紀錄，供追溯使用，不表示目前仍有相同問題，也不是修正後的行號。

---

已完成整個工作區的 project-owned source review，共 53 個 source files、8,406 行；另檢查 3 份 TypeScript 設定、2 份內建題解的所有 Java／Python 程式區塊，以及專案說明文件中的程式範例。發現 44 個檔案需要改善，以下提供完整的 359 筆位置與修正建議。這是註解審查項目數，不代表 359 個功能錯誤。本次僅新增報告，未套用任何 source 修改。

| 已完整檢查的範圍 | Source files | 類型與內容 |
| --- | ---: | --- |
| backend/src | 16 | TypeScript；API、驗證、檔案儲存、匯入、Java／Python 執行流程，以及來源內維護的 runner 模板 |
| frontend/src | 21 | TypeScript、TSX、CSS、型別宣告；頁面、元件、儲存狀態、Markdown renderer、Monaco 設定 |
| frontend 入口與建置設定 | 2 | HTML、TypeScript |
| tests | 8 | TypeScript 測試與測試用程式片段 |
| 根目錄腳本 | 2 | Shell 安裝與移除流程 |
| problems 下的解題模板 | 4 | Java、Python |

排除第三方依賴、node_modules、編譯後的 dist、Git 內部資料、快取，以及被忽略的簡報產物目錄。題目 JSON、測資與初始進度為資料，已確認不包含待審查的 source comments。中文 README／題解正文屬文件內容，未要求翻譯；其中維護的程式區塊已納入。未發現工作區內額外的 repository instruction files；遵循本次提供的 AGENTS.md。

主要問題包括非英文註解、行尾註解、不必要的區塊註解、註解與所述程式距離過遠、重述程式而無額外價值，以及已與目前流程不符的說明。欠缺背景的重點集中在儲存競態、hidden testcase 揭露規則、執行 deadline、Docker 探測快取、生成程式碼的限制與排序演算法的不變條件。

優先更正上傳限制的單位與範圍、Run／Submit 載入方法、耗時排名的量測定義、executor 語言驗證責任，以及 median-of-three 範例尚未完成的選值步驟。其他項目多為翻譯、移位、精簡，或補上必要的維護背景。

以下只列出有實際問題的檔案。行號均指審查當下的原始檔；多行或多個位置共用一個建議時，代表可合併處理。英文建議均應放在所解釋程式的正上方；原為行尾者移至上一行。TypeScript／Java／JSONC 使用 //，Python／Shell 使用 #。CSS 沒有 //，應使用每行獨立封閉的 /* ... */；JSX 子節點中的 {/* ... */}、shebang 與 TypeScript 三斜線編譯器指令保留合法語法，不將它們誤列為格式問題。刪除建議只針對註解，保留程式碼。

**[backend/src/app.ts](/Users/tsengpinruei/JustCode/backend/src/app.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L11](/Users/tsengpinruei/JustCode/backend/src/app.ts:11) | 非英文註解。 | `// This unauthenticated API executes code and writes local files.`<br>`// Check both Host and Origin to reject external sites and DNS rebinding.` |

**[backend/src/constants.ts](/Users/tsengpinruei/JustCode/backend/src/constants.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–2](/Users/tsengpinruei/JustCode/backend/src/constants.ts:1) | 檔案標題為中文，與共用 constants 的結構重複；刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L4–5](/Users/tsengpinruei/JustCode/backend/src/constants.ts:4) | 非英文註解。 | `// The runners print this marker on its own line before the JSON result.`<br>`// Output before the final marker is treated as debug text.` |
| [L8](/Users/tsengpinruei/JustCode/backend/src/constants.ts:8) | 非英文註解。 | `// Limit each testcase and compilation step so runaway code cannot run indefinitely.` |
| [L9–10](/Users/tsengpinruei/JustCode/backend/src/constants.ts:9) | 中文行尾註解只把毫秒常數換算為秒；名稱與數值已足夠，刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L11](/Users/tsengpinruei/JustCode/backend/src/constants.ts:11) | 把整次 submission 描述為有嚴格完整上限，忽略 Docker 探測、檔案 I/O 和清理耗時；應寫清楚 deadline 的適用範圍。 | `// Share this deadline across compilation and testcase execution.`<br>`// Setup, Docker checks, and cleanup may add time outside process timeouts.` |
| [L14–15](/Users/tsengpinruei/JustCode/backend/src/constants.ts:14) | shares this budget 容易誤解為 process output 與整次 debug 共用同一累計值；實際是兩個獨立計數器。第 15 行另有中文行尾註解。 | `// Cap combined stdout and stderr bytes for each process.`<br>`// Apply the same byte cap separately to retained debug text for the submission.` |
| [L17–20](/Users/tsengpinruei/JustCode/backend/src/constants.ts:17) | 非英文註解。 | `// auto: use Docker when the daemon and image are available; otherwise run locally.`<br>`// docker: report Docker failures without falling back to local execution.`<br>`// local: run without a shell and with a restricted environment, but no filesystem isolation.` |
| [L28](/Users/tsengpinruei/JustCode/backend/src/constants.ts:28) | 中文；現有註解只提 UI，但 API 也執行同一規則。 | `// Protect the bundled problems from deletion through the API and UI.` |

**[backend/src/routes/problemRoutes.ts](/Users/tsengpinruei/JustCode/backend/src/routes/problemRoutes.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L37](/Users/tsengpinruei/JustCode/backend/src/routes/problemRoutes.ts:37) | 非英文註解。 | `// Reject excess executions instead of queueing them, limiting process and memory use.` |
| [L50](/Users/tsengpinruei/JustCode/backend/src/routes/problemRoutes.ts:50) | 非英文註解。 | `// A disconnected client may leave its execution running.`<br>`// Release capacity only when the handler finishes.` |
| [L101](/Users/tsengpinruei/JustCode/backend/src/routes/problemRoutes.ts:101) | 非英文註解。 | `// Custom input has no expected answer. Convert comparison failures to success,`<br>`// but preserve compilation, runtime, timeout, and infrastructure failures.` |

**[backend/src/server.ts](/Users/tsengpinruei/JustCode/backend/src/server.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L8](/Users/tsengpinruei/JustCode/backend/src/server.ts:8) | 非英文註解。 | `// Bind to loopback because this local judge has no authentication.` |

**[backend/src/services/codeExecutorFactory.ts](/Users/tsengpinruei/JustCode/backend/src/services/codeExecutorFactory.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/backend/src/services/codeExecutorFactory.ts:1) | 中文區塊標題重述 factory 名稱，且放在 imports 上方；由下面具體契約註解取代。 | 刪除這些註解，保留程式碼。 |
| [L10](/Users/tsengpinruei/JustCode/backend/src/services/codeExecutorFactory.ts:10) | 中文區塊註解只說共用介面，卻未交代兩個影響隱藏資料揭露的參數契約。 改成 //，放在 executeCode 宣告（第 12 行）正上方。 | `// Testcases must list visible cases first; visibleTestcaseCount marks the boundary.`<br>`// Set showHiddenInputs to false for Submit to suppress hidden case details.` |
| [L21](/Users/tsengpinruei/JustCode/backend/src/services/codeExecutorFactory.ts:21) | 此 factory 只依 language 參數選擇；不讀取 ProblemMetadata.supportedLanguages。原註解容易使呼叫端省略驗證。 使用不必要的區塊註解。 | `// Reuse the executor for the requested language.`<br>`// Routes must check that the problem supports that language before calling this factory.` |

**[backend/src/services/executionUtils.ts](/Users/tsengpinruei/JustCode/backend/src/services/executionUtils.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L94](/Users/tsengpinruei/JustCode/backend/src/services/executionUtils.ts:94) | 缺少 visibleTestcaseCount 與 testcases 排列順序的必要契約。 加在 hiddenStart 宣告正上方。 | 補充：<br>`// Visible testcases must precede hidden testcases; this count marks their boundary.` |
| [L125–128](/Users/tsengpinruei/JustCode/backend/src/services/executionUtils.ts:125) | 缺少「失敗後仍繼續計數，直到整體 deadline；hidden 只回傳第一筆失敗」的結果摘要規則。 加在第 125 行前。 | 補充：<br>`// Keep counting passes after failures until the submission deadline.`<br>`// Return all visible results, but only the first hidden failure.` |
| [L140](/Users/tsengpinruei/JustCode/backend/src/services/executionUtils.ts:140) | 缺少整體 TLE 優先於先前 WA/RE，以及取第一筆失敗的狀態選擇規則。 加在 if (deadlineExceeded) 正上方。 | 補充：<br>`// The submission deadline takes precedence over earlier testcase failures.`<br>`// Otherwise, report the first failing testcase in execution order.` |

**[backend/src/services/javaExecutor.ts](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–5](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:1) | 中文區塊標題；「隔離」宜明確指 temporary directory，避免誤認 local 模式有安全隔離。 移至 JavaExecutor 宣告（第 49 行）上方，改用 //。 | `// Compile the solution with a generated runner in a separate temporary directory.`<br>`// The runner converts supported metadata types to and from JSON.` |
| [L15](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:15) | 非英文註解。 | `// Map metadata type labels to the Java types supported by the generated runner.` |
| [L52](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:52) | 中文區塊註解只重述 compile；應描述 CE、RE、TLE 的分流。 | `// Distinguish compiler diagnostics from startup failures and compilation timeouts.` |
| [L54](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:54) | 非英文註解。 | `// javac writes class files beside the sources, so compilation needs a writable workspace.` |
| [L90](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:90) | 中文區塊註解重述 parseJavaCompilationErrors；保留下一段實際診斷格式即可。 | 刪除這些註解，保留程式碼。 |
| [L93](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:93) | 非英文註解。 | `// Match javac diagnostics such as "Solution.java:3: error: cannot find symbol".` |
| [L102](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:102) | 中文行尾註解只重述 path.basename 的結果；不提供額外背景，刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L104](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:104) | 中文行尾；原文把欄位缺失歸因於 javac，實際此 parser 從未解析 caret 欄位。 | `// Use column 1 because this parser does not extract javac caret positions.` |
| [L149](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:149) | 非英文註解。 | `// Reject types without a matching runner conversion instead of guessing a Java type.` |
| [L157](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:157) | 非英文註解。 | `// Read each named JSON value and convert it to the declared Java parameter type.` |
| [L205](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:205) | 非英文註解。 使用不必要的區塊註解。 | `// Generate a runner from structured metadata rather than parsing the displayed signature.` |
| [L207](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:207) | 原註解泛稱舊版內建題目皆可執行；備援實際僅為 sortArray，不能涵蓋 sum 等題目。 | `// Missing metadata falls back to sortArray(int[] nums), for legacy sorting problems.`<br>`// These defaults cannot infer another problem's method signature.` |
| [L215](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:215) | 缺少 arg0/arg1 與 JSON key 分離的理由；這是生成程式碼的重要限制。 加在 parseLines 宣告上方。 | 補充：<br>`// Use numbered local names so metadata names cannot collide with runner variables.` |
| [L241](/Users/tsengpinruei/JustCode/backend/src/services/javaExecutor.ts:241) | 生成模板內仍有中文裝飾式註解；模板字串是專案維護的來源，仍屬檢查範圍。 移到第 243 行 toIntArray 正上方，移除中間空白。 | `// Convert parsed JSON lists to the Java array and list types accepted by Solution.` |

**[backend/src/services/javaJsonSupport.ts](/Users/tsengpinruei/JustCode/backend/src/services/javaJsonSupport.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3](/Users/tsengpinruei/JustCode/backend/src/services/javaJsonSupport.ts:3) | 嵌入另一種語言的字串缺少 String.raw 的必要用途，容易因移除 raw 而破壞轉義。 接在既有第 1–2 行英文說明後。 | 補充：<br>`// String.raw preserves Java escape sequences when this fragment is inserted into Runner.java.` |
| [L73–76](/Users/tsengpinruei/JustCode/backend/src/services/javaJsonSupport.ts:73) | Long／Double 分支涉及整數精度；沒有說明為何分開解析。 加在第 73 行 if 前，使用生成 Java 程式的 // 註解。 | 補充：<br>`// Keep integral values as Long so they are not rounded through Double before conversion.` |

**[backend/src/services/pythonExecutor.ts](/Users/tsengpinruei/JustCode/backend/src/services/pythonExecutor.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L76](/Users/tsengpinruei/JustCode/backend/src/services/pythonExecutor.ts:76) | 原註解解釋名稱碰撞，但沒有解釋兩層 JSON.stringify 與 json.loads 的對應關係。 | `// Encode the name list as JSON, then encode that JSON as a Python string literal.`<br>`// json.loads restores the names without inserting them as runner variable names.` |

**[backend/src/services/problemValidation.ts](/Users/tsengpinruei/JustCode/backend/src/services/problemValidation.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L12](/Users/tsengpinruei/JustCode/backend/src/services/problemValidation.ts:12) | 缺少 identifier allowlist 與生成原始碼的安全關聯。 加在 isIdentifier 宣告上方。 | 補充：<br>`// Function names are inserted into generated source, so accept identifier-shaped names only.` |
| [L40](/Users/tsengpinruei/JustCode/backend/src/services/problemValidation.ts:40) | 沒有說明驗證邊界；未檢查值型別或答案正確性，容易被當成完整 testcase 驗證。 加在 validateTestcases 宣告上方。 | 補充：<br>`// Validate testcase structure and parameter names only.`<br>`// Value types, problem constraints, and expected-answer correctness are not checked here.` |

**[backend/src/services/storage.ts](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L5](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts:5) | 中文；使用固定「約 38 MB」數字容易隨題庫更新失準，保留上限的目的即可。 | `// Allow the bundled large sorting test data to fit within the local file-size limit.` |
| [L16–17](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts:16) | 非英文註解。 | `// Serialize mutations for each problem across service instances in this process.`<br>`// Multiple backend processes are not coordinated by this map.` |
| [L37](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts:37) | 非英文註解。 | `// O_NOFOLLOW rejects a final path component replaced by a symlink after lstat.` |
| [L50](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts:50) | 缺少固定分批並行讀取的資源限制目的。 加在 mapInBatches 宣告上方。 | 補充：<br>`// Limit concurrent reads so a large problem library does not open every file at once.` |
| [L72](/Users/tsengpinruei/JustCode/backend/src/services/storage.ts:72) | 非英文註解。 | `// Rename within the same directory so readers see either the complete old JSON or the complete new JSON.` |

**[backend/src/services/leetcodeService.ts](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L5](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:5) | 非英文註解。 | `// Model only the GraphQL fields used by the importer.` |
| [L30](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:30) | 非英文註解。 | `// Extract signatures for display only; runner generation uses structured metaData.` |
| [L34](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:34) | 非英文註解。 | `// Normalize known LeetCode type aliases; unknown labels are handled separately.` |
| [L71–76](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:71) | 中文區塊註解列出多個重複 URL，沒有突出 host allowlist 與驗證邊界。 | `// Accept problem URLs on the allowed LeetCode hosts and normalize the slug to lowercase.`<br>`// Reject credentials and non-default ports before making a request.` |
| [L90–93](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:90) | 非英文註解。 使用不必要的區塊註解。 | `// Fetch public metadata, templates, and example inputs; hidden judge tests are not requested.` |
| [L136](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:136) | 非英文註解。 | `// Limit bytes read from the decoded response stream; Content-Length alone cannot bound it.` |
| [L171–174](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:171) | 非英文註解。 使用不必要的區塊註解。 | `// Parse the expected LeetCode HTML into description text, examples, and constraints.`<br>`// These patterns depend on the source markup and may need updates when it changes.` |
| [L180](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:180) | 「分別累積欄位可避免局部失敗中斷匯入」不成立：這只是初始化變數；缺例或數量不符仍由 parseTestcases 拒絕。刪除誤導理由。 | 刪除這些註解，保留程式碼。 |
| [L185](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:185) | 內容有價值但位置錯誤；此處只是尋找 Example，真正轉換在 stripHtml／stripAllHtml。 移至第 237 與 262 行 return this.decodeEntities(...) 的正上方。 | `// Strip HTML tags before decoding entities so escaped comparison signs remain text.` |
| [L186](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:186) | 非英文註解。 | `// Use the text before the first recognized example as the main description.` |
| [L194](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:194) | 非英文註解。 | `// Read displayed examples from HTML; executable inputs come from exampleTestcaseList.` |
| [L200](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:200) | 原文暗示這裡的 input/output 都會由 parseTestcases 轉成機器值；實際只使用此 output。 | `// Keep these values as display text; parseTestcases parses the expected output.`<br>`// Executable input values come from exampleTestcaseList, not this input string.` |
| [L213](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:213) | 原註解寫最後一個 Constraints，但此非 global 的 match 取第一個匹配。 | `// Read constraint list items after the first matching Constraints heading.` |
| [L217](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:217) | 非英文且置於 liRegex 前；真正空白正規化在 constraint 宣告。 移至第 221 行 const constraint 上方。 | `// Collapse whitespace so each constraint occupies one compact list item.` |
| [L233–235](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:233) | 非英文註解。 使用不必要的區塊註解。 | `// Preserve a small Markdown subset for the description while removing HTML tags.` |
| [L258–260](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:258) | 非英文註解。 使用不必要的區塊註解。 | `// Return literal example and constraint text without adding Markdown formatting.` |
| [L282–285](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:282) | 非英文註解。 使用不必要的區塊註解。 | `// Normalize known aliases and preserve unknown type labels.`<br>`// Importing a label does not guarantee that an executor supports its structure.` |
| [L291–294](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:291) | 非英文註解。 使用不必要的區塊註解。 | `// Match each newline-separated input list to metadata parameters in order.`<br>`// Pair it with the corresponding HTML example output, rejecting count mismatches.` |
| [L321](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:321) | 中文註解重述下一行的逐參數迴圈與 JSON.parse；契約已集中在方法註解，刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L328](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:328) | 非英文註解。 | `// Accept unquoted text only for string or character parameters.` |
| [L336](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:336) | 非英文註解。 | `// Accept unquoted expected text only for string or character results.`<br>`// Reject malformed JSON for numeric and collection results.` |
| [L353–355](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:353) | 非英文註解。 使用不必要的區塊註解。 | `// Convert public problem data to local metadata, templates, and visible tests.`<br>`// The caller is responsible for saving these files.` |
| [L363](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:363) | 中文註解重述 fetchProblemData 呼叫，沒有額外維護資訊。 | 刪除這些註解，保留程式碼。 |
| [L367](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:367) | 非英文註解。 | `// Use structured metaData for the method name, ordered parameters, and return type.` |
| [L383](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:383) | 中文註解重述 parseContent；解析限制已在該函式說明。 | 刪除這些註解，保留程式碼。 |
| [L386](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:386) | 中文註解重述 mapLeetCodeType；型別正規化契約已在該函式說明。 | 刪除這些註解，保留程式碼。 |
| [L394](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:394) | 非英文註解。 | `// Keep templates only for languages that have a local executor.` |
| [L404](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:404) | 重複第 30 行 signature 僅供顯示的註解；只保留一處契約即可。 | 刪除這些註解，保留程式碼。 |
| [L419](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:419) | 非英文註解。 | `// Import public example tests only; additional hidden tests must be supplied locally.` |
| [L427](/Users/tsengpinruei/JustCode/backend/src/services/leetcodeService.ts:427) | 中文註解只重述建立 metadata 物件。 | 刪除這些註解，保留程式碼。 |

**[backend/src/services/problemService.ts](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:1) | 中文區塊標題；「CRUD」和檔案枚舉可縮短。 移至 ProblemService 宣告（第 19 行）上方，使用 //。 | `// Store problem files and progress under the project's problems directory.` |
| [L24](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:24) | 中文且在 this.projectRoot 賦值前，但解釋的是 constructor 預設參數的 __dirname 解析。 移至 constructor 宣告（第 23 行）上方。 | `// Source and compiled service files resolve to the same project root, regardless of cwd.` |
| [L29](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:29) | 非英文註解。 使用不必要的區塊註解。 | `// Require lowercase IDs to prevent path traversal and aliases on case-insensitive filesystems.` |
| [L36](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:36) | 中文區塊註解重述驗證與 path.join，沒有必要背景。 | 刪除這些註解，保留程式碼。 |
| [L51](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:51) | 中文區塊註解只列用途；泛型轉型並非執行期驗證，應明確界定責任。 | `// Parse JSON here; callers must validate the resulting data shape.` |
| [L58](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:58) | 非英文註解。 使用不必要的區塊註解。 | `// Use the same validated metadata file for listing, display, and execution.` |
| [L63](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:63) | 非英文註解。 使用不必要的區塊註解。 | `// A non-empty visible testcase file is required for listing and Run.` |
| [L68](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:68) | 非英文註解。 使用不必要的區塊註解。 | `// A missing hidden testcase file is allowed so newly imported problems can still run.` |
| [L73](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:73) | 非英文註解。 | `// Treat a missing file as an empty test set, but report corruption instead of reducing coverage.` |
| [L79](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:79) | 非英文註解。 使用不必要的區塊註解。 | `// Resolve an existing project-relative file and require its real path to stay inside the project.` |
| [L94](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:94) | 非英文註解。 | `// Resolve symlinks before checking that the file stays inside the project.` |
| [L110](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:110) | 原文限定 AI 產生、且容易把驗證理解為保證測資正確；實際接受任何來源，只驗證結構。 使用不必要的區塊註解。 | `// Parse supplied JSON and validate testcase structure and parameter names.`<br>`// This does not verify value types or the correctness of expected answers.` |
| [L123](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:123) | 非英文註解。 使用不必要的區塊註解。 | `// List valid problem directories with non-empty visible tests, sorted by display title.` |
| [L125](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:125) | 中文註解重述第一層 readdir；實際還要求合法 ID，刪除比含糊敘述更清楚。 | 刪除這些註解，保留程式碼。 |
| [L134](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:134) | 「保留既有列表行為」依賴歷史背景；應直接寫出目前排除規則。 | `// Exclude problems without valid visible tests so listed problems can be run.` |
| [L138](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:138) | 原文只說無效 problem.json，但 catch 也涵蓋可見測資驗證及讀取失敗。 | `// Skip a problem if its metadata, visible tests, or required storage paths are invalid.` |
| [L145](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:145) | 原文用 LeetCode 前綴解釋排序，容易誤認為依題號排序；實際是 localeCompare 字串比較。 | `// Sort by the full display title, not by the numeric problem ID.` |
| [L151](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:151) | 「完整題目」與現有不讀 hidden tests 的實作矛盾；應更正用途。 使用不必要的區塊註解。 | `// Load display data and visible tests; hidden tests are omitted.` |
| [L155](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:155) | 中文註解只重述 readProblemMetadata 呼叫。 | 刪除這些註解，保留程式碼。 |
| [L158](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:158) | 非英文註解。 | `// A missing template yields an empty editor buffer; other read failures are still errors.` |
| [L171](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:171) | 非英文註解。 | `// The detail page does not need hidden tests, so avoid exposing them or reading their large files.` |
| [L188](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:188) | 註解仍寫 Run/Submit 共用；Run 已改走 getProblemForRun，此方法也確實會讀 hidden tests。 使用不必要的區塊註解。 | `// Load metadata and both testcase sets for Submit, without templates or the editorial.` |
| [L204](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:204) | 非英文註解。 使用不必要的區塊註解。 | `// Custom Run supplies its own input, so only metadata is needed.` |
| [L209](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:209) | 非英文註解。 使用不必要的區塊註解。 | `// Load metadata and visible tests for Run without reading hidden testcase files.` |
| [L220](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:220) | 原註解稱 Run 使用；全工作區只找到方法宣告，實際 route 不再呼叫；「為了效率」未提供有用契約。 使用不必要的區塊註解。 | `// Read visible tests without loading metadata or validating parameter names against it.` |
| [L225](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:225) | 原註解稱 Submit 使用；實際 Submit 呼叫 getProblemForExecution。 使用不必要的區塊註解。 | `// Read hidden tests without loading metadata or validating parameter names against it.` |
| [L230](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:230) | 非英文；來源不限 AI，且應說明 append／replace。 使用不必要的區塊註解。 | `// Append or replace locally supplied hidden testcases after structural validation.` |
| [L248](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:248) | 非英文註解。 | `// Content comes from pasted or uploaded text; project paths are read only after containment checks.` |
| [L260](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:260) | 原註解只提讀取順序；應補充 replace 刻意不讀舊檔的修復用途，已由 storage 測試證實。 | `// Validate incoming data before writing. Append also validates the existing file;`<br>`// replace skips that read so it can replace a corrupt hidden-test file.` |
| [L277](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:277) | 原註解稱 Submit 使用且為效率直接讀檔；實際無呼叫端，也沒有 metadata 參數驗證。 使用不必要的區塊註解。 | `// Combine visible and hidden tests without loading metadata.`<br>`// Parameter-name validation requires a metadata-aware loading method.` |
| [L287](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:287) | 非英文註解。 使用不必要的區塊註解。 | `// Create a new problem directory; reject an existing ID without overwriting its files.` |
| [L309](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:309) | 非英文註解。 | `// Import creates new problems only, preserving templates, progress, and hidden tests on duplicates.` |
| [L322](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:322) | 非英文註解。 | `// Publish the directory only after all files are written so readers never see a partial import.` |
| [L330](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:330) | 非英文註解。 使用不必要的區塊註解。 | `// Return null for missing progress; report corrupt files so autosave cannot overwrite recoverable data.` |
| [L337](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:337) | 非英文註解。 | `// Empty bundled progress uses blank language and timestamp fields to mean no saved attempt.` |
| [L356](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:356) | 中文區塊註解重述 saveProgress；真正重要的損毀保護已在第 361 行。 | 刪除這些註解，保留程式碼。 |
| [L361](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:361) | 非英文註解。 | `// Refuse to overwrite corrupt progress because it may contain recoverable solve history.` |
| [L367](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:367) | 中文區塊註解只說收集；缺少與 getAllProblems 不同的錯誤處理政策。 | `// Collect existing progress and propagate read or validation errors instead of hiding damaged history.` |
| [L393](/Users/tsengpinruei/JustCode/backend/src/services/problemService.ts:393) | 非英文註解。 使用不必要的區塊註解。 | `// Delete the entire problem directory; callers must enforce the protected-problem policy first.` |

**[backend/src/services/sandboxRunner.ts](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–5](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:1) | 中文區塊註解；應明確區分暫存工作目錄與真正隔離。 移至 SandboxRunner 宣告上方；與 executeLocal 的說明避免重複。 | `// Run judge commands in Docker or directly on the host.`<br>`// Local execution limits time and output but is not a security boundary.` |
| [L19](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:19) | 非英文註解。 | `// Pass command arguments directly to the runtime or Docker without using a shell.` |
| [L39](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:39) | 中文註解只列內部介面呼叫位置；ProcessRunOptions 名稱與使用處已足夠。 | 刪除這些註解，保留程式碼。 |
| [L58](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:58) | 中文且缺少負面結果也永久快取的限制；這會直接影響 auto 模式切換與除錯。 | `// Cache each image's readiness check, including failures, for this backend process.`<br>`// Restart the backend to recheck Docker after the daemon or available images change.` |
| [L62](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:62) | 非英文註解。 使用不必要的區塊註解。 | `// Forced Docker mode never falls back; auto uses Docker only after a successful readiness check.` |
| [L87](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:87) | 非英文註解。 | `// Auto mode requires both a responding daemon and an image already present locally.` |
| [L106–107](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:106) | 非英文註解。 | `// Local mode runs with host-user access; it is not a filesystem or network sandbox.`<br>`// Avoid the shell and pass only the environment variables needed by the runtimes.` |
| [L127–128](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:127) | 原文只說掛載 /workspace，遺漏 /tmp tmpfs；Python 已停用 bytecode cache，應避免泛稱所有編譯需要 cache 寫入。 | `// Disable network access, drop capabilities, and limit CPU, memory, and process count.`<br>`// Keep the root filesystem read-only, with a writable temporary filesystem at /tmp.`<br>`// The only host bind mount is /workspace; compilation may make it writable.` |
| [L178–179](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:178) | 原英文暗示容器確定移除後才清理 workspace；實際只等待 rm 指令完成，未檢查 rm 的 exitCode。 | `// Killing the Docker CLI may leave its container running.`<br>`// Await a forced-removal attempt before workspace cleanup; removal failure is not checked here.` |
| [L195](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:195) | 非英文註解。 | `// Pass only required runtime variables instead of inheriting host credential variables.` |
| [L211](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:211) | 非英文註解。 | `// Match the host user's UID and GID so compilation does not leave root-owned workspace files.` |
| [L250](/Users/tsengpinruei/JustCode/backend/src/services/sandboxRunner.ts:250) | 註解留在空 catch 內，沒有位於被解釋的處理邏輯上方。 移至第 242 行 try 上方，或緊接 catch 子句之前。 | `// The process can exit before the kill signal; ignore that race.` |

**[backend/src/types.ts](/Users/tsengpinruei/JustCode/backend/src/types.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/backend/src/types.ts:1) | 中文區塊標題僅重述 types.ts 的用途。 | 刪除這些註解，保留程式碼。 |
| [L9–10](/Users/tsengpinruei/JustCode/backend/src/types.ts:9) | 行尾中文例子把 ListNode 放在可支援型別旁；Java mapper 實際拒絕該型別。 | `// Metadata type label used by the runner's explicit type mapping.`<br>`// Custom structures such as ListNode and TreeNode are not supported by the Java runner.` |
| [L46](/Users/tsengpinruei/JustCode/backend/src/types.ts:46) | 非英文註解。 原註解位於行尾。 | `// Source basename, which may also identify a generated runner file.` |
| [L47](/Users/tsengpinruei/JustCode/backend/src/types.ts:47) | 中文行尾；這個介面不是 runtime diagnostics 的契約。 | `// One-based source line reported by syntax checking or compilation.` |
| [L48](/Users/tsengpinruei/JustCode/backend/src/types.ts:48) | 非英文註解。 原註解位於行尾。 | `// One-based column; current parsers use 1 when no column is extracted.` |
| [L49](/Users/tsengpinruei/JustCode/backend/src/types.ts:49) | 中文行尾註解只重述 message 欄位。 | 刪除這些註解，保留程式碼。 |
| [L59](/Users/tsengpinruei/JustCode/backend/src/types.ts:59) | 非英文註解。 原註解位於行尾。 | `// Structured source locations for Monaco diagnostics.` |
| [L60](/Users/tsengpinruei/JustCode/backend/src/types.ts:60) | 原文只說 RESULT_SEPARATOR 前的 stdout，遺漏分組、截斷、hidden suppression 與缺 marker 時的行為。 原註解位於行尾。 | `// Visible testcase stdout, grouped under [Testcase n] headers and capped in bytes.`<br>`// Hidden stdout is omitted; missing result markers leave the captured stdout as debug text.` |
| [L88](/Users/tsengpinruei/JustCode/backend/src/types.ts:88) | 非英文註解。 | `// content carries pasted or uploaded JSON text; projectPath is resolved inside the project.` |
| [L101](/Users/tsengpinruei/JustCode/backend/src/types.ts:101) | 非英文註解。 原註解位於行尾。 | `// Number of hidden testcases after the append or replace operation.` |
| [L105](/Users/tsengpinruei/JustCode/backend/src/types.ts:105) | 原文 attempted 寫「已儲存程式碼」；前端編輯時立即改狀態，儲存失敗仍可顯示 attempted，不能當作儲存成功證據。 使用不必要的區塊註解。 | `// none means no attempt; attempted means edited; solved records an accepted Submit.` |
| [L108](/Users/tsengpinruei/JustCode/backend/src/types.ts:108) | 非英文註解。 | `// Persisted timing and result summary for one accepted submission; it does not contain source code.` |
| [L111](/Users/tsengpinruei/JustCode/backend/src/types.ts:111) | 非英文註解。 原註解位於行尾。 | `// Browser timestamp when the accepted response was received, in ISO format.` |
| [L112](/Users/tsengpinruei/JustCode/backend/src/types.ts:112) | 非英文註解。 原註解位於行尾。 | `// Wall-clock time for this attempt, including idle and submission time.` |
| [L113](/Users/tsengpinruei/JustCode/backend/src/types.ts:113) | 非英文註解。 原註解位於行尾。 | `// Browser request duration, including compilation, test execution, and request overhead.`<br>`// Optional because older progress files did not record this measurement.` |
| [L119](/Users/tsengpinruei/JustCode/backend/src/types.ts:119) | 非英文註解。 使用不必要的區塊註解。 | `// Persisted per-problem state stored in progress.json.` |
| [L122](/Users/tsengpinruei/JustCode/backend/src/types.ts:122) | 非英文註解。 原註解位於行尾。 | `// Keep separate drafts for each language so switching languages preserves the other draft.` |
| [L125](/Users/tsengpinruei/JustCode/backend/src/types.ts:125) | 非英文註解。 原註解位於行尾。 | `// ISO timestamp assigned by the API when it validates a save request.` |

**[frontend/src/App.tsx](/Users/tsengpinruei/JustCode/frontend/src/App.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/App.tsx:1) | 中文區塊標題重複下方的宣告與 routes 清單；刪除即可。 | 刪除這些註解，保留程式碼。 |

**[frontend/src/main.tsx](/Users/tsengpinruei/JustCode/frontend/src/main.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–3](/Users/tsengpinruei/JustCode/frontend/src/main.tsx:1) | 中文區塊註解只是重述 createRoot().render()。 | 刪除這些註解，保留程式碼。 |

**[frontend/src/components/CodeEditor.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/CodeEditor.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/CodeEditor.tsx:1) | 中文區塊標題稱「即時錯誤標示」與「不干擾游標的外部更新」；實際由執行結果傳入 diagnostics，沒有在此實作即時編譯或游標保證。 移至 CodeEditor 宣告上方，改為 //。 | `// Update diagnostic markers when the page supplies a new Run or Submit result.` |
| [L82](/Users/tsengpinruei/JustCode/frontend/src/components/CodeEditor.tsx:82) | 中文；放在 fontSize 欄位前卻解釋整個 useMemo。 移至第 81 行 const editorOptions 正上方。 | `// Keep editor options stable between renders unless the font size changes.` |

**[frontend/src/components/ConsolePanel.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/ConsolePanel.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/ConsolePanel.tsx:1) | 中文區塊標題主要重述元件版面；activeTab 由父元件控制，無須保留模糊的「管理切換」。 | 刪除這些註解，保留程式碼。 |
| [L29](/Users/tsengpinruei/JustCode/frontend/src/components/ConsolePanel.tsx:29) | 選取的可見 testcase index 其實在 TestcaseTab，不在這裡；此處只保留 mode 與 customInput。 | `// Keep input mode and custom text here so Run uses them from either console tab.` |
| [L68](/Users/tsengpinruei/JustCode/frontend/src/components/ConsolePanel.tsx:68) | hidden 與條件渲染混用的狀態保存目的未說明，日後容易被改成卸載元件。 加在含 hidden 的 div 正上方；這裡需要 JSX 註解語法。 | 補充：<br>`{/* Keep TestcaseTab mounted so switching to Result preserves the selected case. */}` |

**[frontend/src/components/HiddenTestcaseModal.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx:1) | 中文區塊標題將輸入限定為 AI 產生，且「JSON 安全性」太泛；實際不驗證答案語意。 移至 HiddenTestcaseModal 宣告正上方。 | `// Collect pasted JSON, a browser-selected file, or a project-relative path.`<br>`// The backend validates the request structure and storage path, not answer correctness.` |
| [L36](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx:36) | 非英文註解。 | `// Enable import only when the active source has input, ignoring the inactive field.` |
| [L43](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx:43) | 現有英文誤稱符合 backend file-size ceiling。後端本機檔案上限為 64 MiB；HTTP JSON body 為 10 MiB，且不等於 raw File.size。 | `// Reject oversized files before reading them into browser memory.`<br>`// The API's 10 MiB limit includes the JSON wrapper and escaping, so smaller files can still be rejected.` |
| [L52](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx:52) | 非英文註解。 | `// Send a browser-selected file as text through the same API field used for pasted JSON.` |
| [L77](/Users/tsengpinruei/JustCode/frontend/src/components/HiddenTestcaseModal.tsx:77) | 非英文註解。 | `// Send only the selected source field; the backend validates content and path containment.` |

**[frontend/src/components/Navbar.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/Navbar.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/Navbar.tsx:1) | 中文區塊標題與導覽列名稱重複；只有 placeholder 限制值得保留，且原文含不必要的跳脫引號。 刪除檔首標題，把這一行放在第 23 行 placeholder li 群組正上方。 | `{/* Explore and Discuss are placeholders with no routes yet. */}` |

**[frontend/src/components/ProblemDescription.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–6](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:1) | 中文區塊標題過度概述整份檔案且位於 imports 前；重要 renderer／下載契約已有就地說明。 | 刪除這些註解，保留程式碼。 |
| [L21](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:21)、[L165](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:165)、[L280](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:280) | 中文装飾式區塊標題與緊接的程式名稱重複；刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L36](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:36) | 非英文註解。 | `// Group adjacent language-specific editorial code blocks into tabs.` |
| [L40](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:40) | 非英文註解。 | `// ReactMarkdown may nest elements inside pre; flatten them to recover copyable text.` |
| [L51](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:51) | 非英文註解。 | `// Try the async clipboard API, then fall back if it is unavailable or rejects the write.` |
| [L57](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:57) | 中文 catch 內註解重複第 51 行的 fallback 說明，且沒有位於程式碼正上方；合併到第 51 行即可。 | 刪除這些註解，保留程式碼。 |
| [L64](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:64) | 非英文註解。 | `// Keep the fallback textarea off screen to avoid visible layout changes while copying.` |
| [L105](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:105) | 非直觀的 request counter 防競態檢查沒有說明；較早 promise 不應覆蓋較新的複製狀態。 加在第 105 行條件正上方。 | 補充：<br>`// Ignore an older copy request or a result received after unmounting.` |
| [L132](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:132) | 非英文註解。 | `// remarkCodeGroup passes grouped language labels and source text as serialized JSON.` |
| [L183](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:183) | 中文且「不被視為可執行程式碼」不夠準確；這裡只決定 Markdown 顯示語意，不是執行控制。 | `// Keep example values in text fences so Markdown punctuation is displayed literally.` |
| [L202](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:202) | 非英文註解。 | `// Use a validated visible testcase as the sample so its input keys match the runner parameters.` |
| [L225](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:225) | 中文；此說明解釋整個下載 brief，卻放在 params 區域前。 移至 buildDescriptionDownload 宣告上方。 | `// Keep this downloaded test-generation brief consistent with the backend's JSON request shape.` |
| [L268](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:268) | 英文內容正確，但目前位於 Blob 建立前，與真正延遲回收的位置相隔多行。 移至第 277 行 setTimeout(...) 正上方。 | `// Let the browser start the download before releasing its object URL.` |
| [L287](/Users/tsengpinruei/JustCode/frontend/src/components/ProblemDescription.tsx:287) | 非英文註解。 | `// Remove characters that should not become part of the downloaded filename.` |

**[frontend/src/components/ResizableSplitPane.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–5](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:1) | 中文區塊標題重述元件名稱與 props；可縮短並就地放置。 移至 ResizableSplitPane 宣告正上方。 | `// Resize the leading pane using percentage bounds and optional pixel minimums.` |
| [L14](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:14) | 非英文註解。 原註解位於行尾。 | `// Initial left-pane size as a percentage of the available pane space.` |
| [L15](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:15) | 非英文註解。 原註解位於行尾。 | `// Initial top-pane size as a percentage of the available pane space.` |
| [L19](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:19) | 非英文註解。 原註解位於行尾。 | `// Minimum left width or top height in pixels, when both pane minimums fit.` |
| [L20](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:20) | 非英文註解。 原註解位於行尾。 | `// Minimum right width or bottom height in pixels, when both pane minimums fit.` |
| [L36](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:36) | 非英文註解。 | `// Store a percentage so the split follows container resizing.` |
| [L40](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:40) | 使用 mousemove 是過時名稱；目前事件為 pointermove，支援滑鼠與觸控。 | `// Pointer events may arrive faster than rendering; retain only the newest position per frame.` |
| [L53](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:53) | 中文且缺少兩處 -8 與 CSS divider 尺寸的跨檔案約束。 移至第 55 行 containerSize 上方；第 113 行需遵循同一約束。 | `// Convert pixel minimums using the space left after the divider's 8 px hit area.`<br>`// Keep this subtraction in sync with ResizableSplitPane.css and the drag calculation.` |
| [L135](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:135) | 非英文註解。 | `// Apply the last queued pointer position before ending the drag.` |
| [L150](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:150) | 非英文註解。 | `// Limit drag layout measurements and size updates to one animation frame.` |
| [L167–168](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:167) | capture 的說明放在 document listener 上方，而實際 setPointerCapture 位於第 92 行。 這一行保留在事件註冊處；另將 // Capture the pointer so dragging continues outside the divider. 移至第 92 行上方。 | `// End the drag on cancellation or window blur if pointerup never arrives.` |
| [L189](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.tsx:189) | 原文暗示一定可維持 pixel minima，但 minBound > maxBound 時會採折衷尺寸。 | `// Reapply size constraints after container or prop changes.`<br>`// If both minimums cannot fit, keep both panes visible using the fallback above.` |

**[frontend/src/components/ResizableSplitPane.css](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.css)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L42](/Users/tsengpinruei/JustCode/frontend/src/components/ResizableSplitPane.css:42) | 中文且位於 background 前；漏掉尺寸與 TS 計算的耦合。 移至第 52 行 divider 尺寸規則群組之前；CSS 需保留合法的單行 /* ... */。 | `/* Keep the divider hit area at 8 px; the drag calculations subtract this size. */`<br>`/* The inner line is 2 px so the handle remains easy to grab without looking wide. */` |

**[frontend/src/components/ResultPanel.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:1) | 中文區塊標題重述元件用途與狀態列表，沒有額外背景。 | 刪除這些註解，保留程式碼。 |
| [L15](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:15) | 只修改 backend status 不會讓這裡的型別檢查失敗：前後端 ExecutionResult 型別分別維護。 | `// Keep labels exhaustive for the frontend ExecutionResult status union.`<br>`// Update the separate backend and frontend contracts together.` |
| [L25](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:25) | 非英文註解。 | `// Show named input parameters on separate lines so testcase differences are easy to scan.` |
| [L38](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:38) | 「所有測試都通過」不精確，custom Run 的 AC 也可能沒有 expected answer；應依 result status 描述。 | `// Hide debug output for accepted results; it is shown only for failing visible cases.` |
| [L43](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:43) | 中文註解重述 failingIndices 的收集；由 debug 過濾契約說明即可。 | 刪除這些註解，保留程式碼。 |
| [L53](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:53) | 非英文註解。 | `// Match the backend's blank-line-delimited [Testcase n] headers when filtering debug text.` |
| [L67](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:67) | 非英文註解。 | `// Cache formatted values per result so repeated renders do not stringify large arrays again.` |
| [L111](/Users/tsengpinruei/JustCode/frontend/src/components/ResultPanel.tsx:111) | 中文 JSX 註解與第 38、53 行過濾規則重複；刪除即可。 | 刪除這些註解，保留程式碼。 |

**[frontend/src/components/SolveStatsPanel.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:1) | 中文區塊標題稱耗時包含排隊，但 API 滿載會回 429，不會排 execution queue；排名規則移至 rankRecords。 移至 SolveStatsPanel 宣告上方。 | `// Show local accepted-submission history and the current wall-clock attempt time.` |
| [L26](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:26) | 非英文註解。 | `// Older progress files have no request timing; display a placeholder instead of inventing one.` |
| [L32](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:32) | 非英文註解。 | `// Keep records without request timings in history, after records with measured timings.` |
| [L50](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:50) | 中文且未列完整排序規則；應與 durationMs／submitDurationMs 的量測範圍一致。 | `// Rank by browser request duration, then total attempt time, then timestamp.`<br>`// Request duration includes compilation, process startup, tests, and HTTP overhead.` |
| [L74](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:74) | 非英文註解。 | `// Derive the ranking from saved records so separate UI state cannot drift from history.` |
| [L84](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:84) | 中文且實際的 1 ms 下限設定在第 78 行，不在 getSubmitDuration。 移至第 78 行 maxSubmitDuration 宣告上方。 | `// Start with a nonzero chart scale; records without request timing do not expand it.` |
| [L162](/Users/tsengpinruei/JustCode/frontend/src/components/SolveStatsPanel.tsx:162) | 原文只提缺少計時的占位值；其實所有過短的計時也有 10% 下限。 | `// Keep every bar at least 10% wide, including records with no measured duration.`<br>`// The minimum is a visibility aid, so very short bars are not exactly proportional.` |

**[frontend/src/components/TestcaseTab.tsx](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:1) | 中文區塊標題重述元件和 UI 功能。 | 刪除這些註解，保留程式碼。 |
| [L23](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:23) | 選取某 Case 不代表只跑該 Case，缺少容易誤解的 UI／API 契約。 加在 selectedTestcase 宣告正上方。 | 補充：<br>`// This selection controls display only; Run executes all visible testcases.` |
| [L26](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:26) | 中文註解只說格式穩定，未提供可維護的目的；Object.entries／JSON.stringify 已明確。 | 刪除這些註解，保留程式碼。 |
| [L33](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:33) | 非英文註解。 | `// Expected output is display-only here; execution reads testcases from the backend files.` |
| [L37](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:37) | 原文說「匯入／新增題目時」會在掛載中變更 cases，但目前頁面以 ID 重掛載，hidden 匯入也不改 visible cases；應描述真正的 defensive condition。 | `// Reset an out-of-range selection if the supplied visible testcase list shrinks.` |
| [L62](/Users/tsengpinruei/JustCode/frontend/src/components/TestcaseTab.tsx:62) | 非英文註解。 | `// Seed an empty custom input from the first visible case to show the required JSON shape.` |

**[frontend/src/pages/ProblemList.tsx](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx:1) | 中文區塊標題主要重述版面；內建題目規則已在 PROTECTED_PROBLEMS 附近。 | 刪除這些註解，保留程式碼。 |
| [L10](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx:10) | 中文區塊註解的「隱藏內建題目」容易誤讀為列表不顯示題目；實際只隱藏刪除按鈕。 | `// Hide deletion controls for bundled problems; the backend enforces the same protected IDs.` |
| [L85](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx:85) | 非英文註解。 | `// Reload the sorted problem list after the backend publishes the imported directory.` |
| [L89](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx:89) | 非英文註解。 | `// Leave the success message visible briefly before closing the dialog.` |
| [L219](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemList.tsx:219) | 中文 JSX 註解重複 modal 內可見的 import notice，以及後端匯入契約。 | 刪除這些註解，保留程式碼。 |

**[frontend/src/pages/ProblemDetail.tsx](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–4](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:1) | 英文內容正確，但使用不必要區塊註解且遠離真正提供 key 的程式。 移至第 295 行 return 正上方，改為 //。 | `// Key by problem ID so navigation resets editor state, timers, and request ownership.` |
| [L31–33](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:31) | 三個 revision ref 的角色與區分缺少說明，直接影響 autosave／retry 正確性。 加在第 31 行 revisionRef 正上方。 | 補充：<br>`// Track the current draft, last successful save, and latest requested save separately.`<br>`// A request is not a saved revision until it succeeds.` |
| [L52–53](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:52) | 缺少 requestedRevision 比對與回復的競態理由。 加在第 52 行條件正上方。 | 補充：<br>`// An older failure must not reset the marker for a newer save request.` |
| [L79](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:79) | beforeunload 啟動非同步 flush 卻未說明只能提示、不能保證寫入完成。 加在 warnUnsavedChanges 宣告上方。 | 補充：<br>`// Warn before leaving with unsaved changes; starting a save cannot guarantee`<br>`// that an HTTP request will finish before the page closes.` |
| [L189](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:189) | 這裡與前面的 stale diagnostics 抑制採不同處理：仍記錄舊提交的 AC 並保留新草稿，缺少關鍵目的。 加在 AC 條件上方。 | 補充：<br>`// Record an accepted submission even if the editor changed while it ran.`<br>`// Preserve the newest draft; solve records contain timing and results, not a code snapshot.` |
| [L199–200](/Users/tsengpinruei/JustCode/frontend/src/pages/ProblemDetail.tsx:199) | 缺少兩種耗時的範圍，容易被誤認為純演算法效能。 加在 durationMs 欄位正上方。 | 補充：<br>`// Measure attempt time from page load or the previous acceptance, including idle time.`<br>`// Measure submission time from the browser request, not from testcase execution alone.` |

**[frontend/src/plugins/remarkCodeGroup.ts](/Users/tsengpinruei/JustCode/frontend/src/plugins/remarkCodeGroup.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L22](/Users/tsengpinruei/JustCode/frontend/src/plugins/remarkCodeGroup.ts:22) | 英文清楚，但使用不必要的單行 JSDoc block；editor tabs 也容易與 Monaco 編輯器混淆。 | `// Group adjacent fenced blocks with distinct language labels into editorial tabs.` |
| [L45](/Users/tsengpinruei/JustCode/frontend/src/plugins/remarkCodeGroup.ts:45) | 缺少遇到重複語言就中斷分組的業務規則理由。 加在第 45 行停止條件正上方。 | 補充：<br>`// A repeated language starts a new group so separate examples do not become duplicate tabs.` |

**[frontend/src/services/apiClient.ts](/Users/tsengpinruei/JustCode/frontend/src/services/apiClient.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L13](/Users/tsengpinruei/JustCode/frontend/src/services/apiClient.ts:13) | 「production uses the same origin」把部署前提寫成既有配置；此 repo 沒有自動配置一般 production reverse proxy。 | `// Use relative API URLs through Vite's proxy locally.`<br>`// Other hosting must serve or proxy /api on the frontend's origin.` |
| [L50](/Users/tsengpinruei/JustCode/frontend/src/services/apiClient.ts:50) | 原文把後端描述為嚴格限制整個 execution 60 秒；Docker 探測與清理等仍有額外耗時。 | `// Allow headroom above the backend's 60-second compilation/testcase budget`<br>`// for setup, cleanup, storage reads, and HTTP overhead.` |

**[frontend/src/services/progressPersistence.ts](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3–6](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts:3) | 不必要區塊註解；cannot read or overwrite an older snapshot 描述含糊，改為確切的 queue/read 行為。 | `// Keep save ordering outside React so it survives route changes in this tab.`<br>`// Reads wait for queued writes and prefer any remaining unsaved draft.` |
| [L11](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts:11) | 缺少失敗草稿儲存的生命週期限制，容易誤認為 durable offline recovery。 加在 drafts 宣告正上方。 | 補充：<br>`// Drafts are held only in this tab's memory and do not survive a reload or browser restart.` |
| [L15](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts:15) | catch 忽略錯誤的目的不明；不是把儲存標成成功，而是讓 read/remove 可以繼續。 加在 Promise.all 正上方。 | 補充：<br>`// Waiting callers may recover from retained drafts after a failed write.` |
| [L21–23](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts:21) | 缺少 catch 後串接 write 的錯誤復原目的。 加在 request 宣告正上方。 | 補充：<br>`// A failed earlier write must not prevent a newer snapshot or retry from being saved.` |
| [L27–29](/Users/tsengpinruei/JustCode/frontend/src/services/progressPersistence.ts:27) | 物件／Promise identity 判斷涉及較舊請求不能清掉較新草稿的競態，缺少就地說明。 加在第 27 行條件正上方，涵蓋接續兩個 identity 檢查。 | 補充：<br>`// Clear only the snapshot and queue entry completed by this request;`<br>`// a newer draft or queued request must remain available.` |

**[frontend/src/types/index.ts](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1–5](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:1) | 中文區塊標題；保留手動同步這項必要限制即可。 | `// These API types are maintained manually; keep them in sync with backend/src/types.ts.` |
| [L10](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:10) | 非英文註解。 | `// Metadata type label interpreted by the backend runner.` |
| [L69](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:69) | 中文行尾註解；需移至欄位上方。 | `// Structured source locations for Monaco diagnostics.` |
| [L70](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:70) | 中文行尾且只說 separator 前的 stdout，沒有描述 API 真正的分組、截斷與 hidden omission。 | `// Visible testcase stdout grouped under [Testcase n] headers and capped by the backend.`<br>`// Hidden debug output is omitted.` |
| [L74](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:74) | 非英文註解。 | `// Use pasted or uploaded JSON text, or a project-relative path validated by the backend.` |
| [L87](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:87) | 中文行尾註解；需移至欄位上方。 | `// Number of hidden testcases after the append or replace operation.` |
| [L93](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:93) | 非英文註解。 | `// Timing and result summary of an accepted submission; source code is not stored in the record.` |
| [L96](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:96) | 中文行尾註解。 | `// Browser timestamp when the accepted response was received, in ISO format.` |
| [L97](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:97) | 中文行尾註解，未說明 idle 與 request 是否計入。 | `// Wall-clock attempt time, including idle time and the accepted submission request.` |
| [L98](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:98) | 中文行尾註解只說 optional，沒有定義量測范围。 | `// Browser request duration, including compilation, tests, and HTTP overhead.`<br>`// Optional for compatibility with older progress files.` |
| [L106](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:106) | 非英文註解。 | `// Keep a draft for each language so switching languages preserves the other draft.` |
| [L110](/Users/tsengpinruei/JustCode/frontend/src/types/index.ts:110) | 非英文註解。 | `// ISO timestamp assigned by the backend when validating a save request.` |

**[frontend/vite.config.ts](/Users/tsengpinruei/JustCode/frontend/vite.config.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L1](/Users/tsengpinruei/JustCode/frontend/vite.config.ts:1) | 中文區塊標題重述配置用途，且 proxy 內容已有就地說明。 | 刪除這些註解，保留程式碼。 |
| [L22](/Users/tsengpinruei/JustCode/frontend/vite.config.ts:22) | 非英文註解。 | `// Proxy relative API requests to the local backend during development.` |

**[backend/tsconfig.json](/Users/tsengpinruei/JustCode/backend/tsconfig.json)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3](/Users/tsengpinruei/JustCode/backend/tsconfig.json:3) | 中文區塊註解位置在 target 前，但描述 outDir。 改成 //，移至第 9 行 outDir 正上方。 | `// Emit backend JavaScript into dist for npm start.` |
| [L18](/Users/tsengpinruei/JustCode/backend/tsconfig.json:18) | 中文且 JSONC 可使用 //，不需 block。 | `// Resolve imports using the Node-style lookup used by this CommonJS build.` |

**[frontend/tsconfig.json](/Users/tsengpinruei/JustCode/frontend/tsconfig.json)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L12](/Users/tsengpinruei/JustCode/frontend/tsconfig.json:12) | 中文區塊註解主要解釋 noEmit，卻放在 moduleResolution 前。 移至第 17 行 noEmit 上方，改為 //。 | `// Vite bundles the frontend; TypeScript checks types without emitting JavaScript.` |
| [L19](/Users/tsengpinruei/JustCode/frontend/tsconfig.json:19) | 原註解容易讓人以為 strict 自動驗證前後端 API 契約；兩份型別仍獨立維護，沒有 response 生成／驗證。 使用不必要的區塊註解。 | `// Check frontend types strictly; backend API changes still require manual type synchronization.` |

**[frontend/tsconfig.node.json](/Users/tsengpinruei/JustCode/frontend/tsconfig.node.json)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3](/Users/tsengpinruei/JustCode/frontend/tsconfig.node.json:3) | 中文且 JSONC 可使用 //，不需 block。 | `// Enable project references so the frontend configuration can reference the Vite config project.` |

**[install.sh](/Users/tsengpinruei/JustCode/install.sh)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3](/Users/tsengpinruei/JustCode/install.sh:3) | 中文行尾且「避免留下半套依賴」過度承諾；set -e 不會回滾 npm 已寫入的內容。 移至 set -euo pipefail 正上方。 | `# Stop on unhandled command failures, unset variables, and failed pipelines.` |
| [L25](/Users/tsengpinruei/JustCode/install.sh:25) | 中文且位置在輸出訊息／root 檢查前，與版本限制隔離。 移至第 47 行 NODE_MAJOR 檢查正上方。 | `# The backend uses native fetch, so require at least Node.js 18.` |
| [L56](/Users/tsengpinruei/JustCode/install.sh:56) | 中文且與 npm install 中間隔一個 echo。 移至第 58 行 if npm install 正上方。 | `# Install both frontend and backend dependencies through the root npm workspace.` |

**[uninstall.sh](/Users/tsengpinruei/JustCode/uninstall.sh)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L3](/Users/tsengpinruei/JustCode/uninstall.sh:3) | 中文行尾註解。 移至 set -euo pipefail 正上方。 | `# Stop on cleanup errors so the script does not report a complete uninstall.` |
| [L45](/Users/tsengpinruei/JustCode/uninstall.sh:45) | 非英文註解。 | `# Reject symlinked workspaces before cleanup so nested paths cannot delete files outside the project.` |
| [L64](/Users/tsengpinruei/JustCode/uninstall.sh:64) | -e 與 -L 的組合、directory／symlink 的分支缺少安全理由。 加在第 64 行判斷正上方。 | 補充：<br>`# Remove a symlink itself, even when its target is missing; never recurse into its target.` |
| [L83](/Users/tsengpinruei/JustCode/uninstall.sh:83) | 非英文註解。 | `# Require interactive confirmation unless --yes was explicitly supplied.` |
| [L123](/Users/tsengpinruei/JustCode/uninstall.sh:123) | 中文；可補上 find -prune 對 .git 的限制。 移至第 125 行清理迴圈正上方。 | `# Remove Finder metadata while leaving Git's internal files untouched.` |

**[frontend/src/index.css](/Users/tsengpinruei/JustCode/frontend/src/index.css)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L4](/Users/tsengpinruei/JustCode/frontend/src/index.css:4) | 非英文註解。 | `/* Shared colors and shadows for the dark theme. */` |
| [L50](/Users/tsengpinruei/JustCode/frontend/src/index.css:50) | 非英文註解。 | `/* Keep scrolling inside panels so the split workspace stays within the viewport. */` |
| [L63](/Users/tsengpinruei/JustCode/frontend/src/index.css:63) | 非英文註解。 | `/* Scale the whole interface, including Monaco, to the chosen desktop density. */` |
| [L69](/Users/tsengpinruei/JustCode/frontend/src/index.css:69) | 非英文註解。 | `/* Scrollbar styles. */` |
| [L88](/Users/tsengpinruei/JustCode/frontend/src/index.css:88) | 非英文註解。 | `/* Navigation. */` |
| [L147](/Users/tsengpinruei/JustCode/frontend/src/index.css:147) | 非英文註解。 | `/* Problem list. */` |
| [L149](/Users/tsengpinruei/JustCode/frontend/src/index.css:149) | 中文且位於 max-width 前，實際解釋 overflow-y。 移至第 156 行 overflow-y 正上方。 | `/* The body cannot scroll, so this page owns its vertical scrolling. */` |
| [L176](/Users/tsengpinruei/JustCode/frontend/src/index.css:176) | 非英文註解。 | `/* Keep long titles and tags from expanding the status and action columns. */` |
| [L260](/Users/tsengpinruei/JustCode/frontend/src/index.css:260) | 中文且稱題目詳細頁，實際下面先定義整個 app；與下一個 viewport 註解重複。 | 刪除這些註解，保留程式碼。 |
| [L262](/Users/tsengpinruei/JustCode/frontend/src/index.css:262) | 非英文註解。 | `/* Fill the viewport below the navigation and let each page or panel manage its scrolling. */` |
| [L274](/Users/tsengpinruei/JustCode/frontend/src/index.css:274) | 非英文註解。 | `/* Problem description. */` |
| [L340](/Users/tsengpinruei/JustCode/frontend/src/index.css:340) | 中文註解解釋 JSX 決定的擺放位置；此處只需樣式區段名稱。 | `/* Local solve statistics. */` |
| [L603](/Users/tsengpinruei/JustCode/frontend/src/index.css:603) | 中文装飾式標題。 移除中間空白，使註解緊鄰第 605 行 selector。 | `/* Tabbed editorial code blocks. */` |
| [L722](/Users/tsengpinruei/JustCode/frontend/src/index.css:722) | 缺少 96px padding 與右上方 Copy button 的關係。 加在 .code-block-wrapper pre 規則正上方。 | 補充：<br>`/* Reserve space for the overlaid Copy button so it does not cover code text. */` |
| [L732](/Users/tsengpinruei/JustCode/frontend/src/index.css:732) | 中文；規則不僅套用於 editorial，description 也有同一 wrapper。 | `/* Markdown tables in descriptions and editorials. */` |
| [L782](/Users/tsengpinruei/JustCode/frontend/src/index.css:782) | 過時：範例現由 React 直接渲染字串，不再使用 Markdown。 | `/* Literal example input and output. */` |
| [L817](/Users/tsengpinruei/JustCode/frontend/src/index.css:817) | 非英文註解。 | `/* Code editor controls. */` |
| [L877](/Users/tsengpinruei/JustCode/frontend/src/index.css:877) | 非英文註解。 | `/* Console panels. */` |
| [L885](/Users/tsengpinruei/JustCode/frontend/src/index.css:885) | 非英文註解。 | `/* Allow long preformatted values to shrink inside the flex pane. */` |
| [L969](/Users/tsengpinruei/JustCode/frontend/src/index.css:969) | 非英文註解。 | `/* Testcase selection and input. */` |
| [L1043](/Users/tsengpinruei/JustCode/frontend/src/index.css:1043) | 非英文註解。 | `/* Execution results. */` |
| [L1191](/Users/tsengpinruei/JustCode/frontend/src/index.css:1191) | 中文且放在 display 前；重點是 max-height 與 overflow。 移至第 1195 行 max-height 正上方。 | `/* Scroll large values within a bounded area instead of expanding the result panel. */` |
| [L1222](/Users/tsengpinruei/JustCode/frontend/src/index.css:1222) | 非英文註解。 | `/* Loading states. */` |
| [L1251](/Users/tsengpinruei/JustCode/frontend/src/index.css:1251) | 中文註解只重述 navbar-link-disabled selector。 | 刪除這些註解，保留程式碼。 |
| [L1257](/Users/tsengpinruei/JustCode/frontend/src/index.css:1257) | 非英文註解。 | `/* Problem table column widths. */` |
| [L1320](/Users/tsengpinruei/JustCode/frontend/src/index.css:1320)、[L1326](/Users/tsengpinruei/JustCode/frontend/src/index.css:1326)、[L1331](/Users/tsengpinruei/JustCode/frontend/src/index.css:1331)、[L1336](/Users/tsengpinruei/JustCode/frontend/src/index.css:1336)、[L1342](/Users/tsengpinruei/JustCode/frontend/src/index.css:1342) | 這些中文註解逐一重述單一 selector（placeholder、container、label、empty-state、margin）；沒有額外背景，刪除。 | 刪除這些註解，保留程式碼。 |
| [L1347](/Users/tsengpinruei/JustCode/frontend/src/index.css:1347) | 非英文註解。 | `/* Debug output. */` |
| [L1417](/Users/tsengpinruei/JustCode/frontend/src/index.css:1417) | 中文註解只重述 problem-list-header-row。 | 刪除這些註解，保留程式碼。 |
| [L1429](/Users/tsengpinruei/JustCode/frontend/src/index.css:1429) | 中文註解重述按鈕外觀；沒有重要選擇或約束。 | 刪除這些註解，保留程式碼。 |
| [L1461](/Users/tsengpinruei/JustCode/frontend/src/index.css:1461) | 非英文註解。 | `/* Modal overlay. */` |
| [L1484](/Users/tsengpinruei/JustCode/frontend/src/index.css:1484) | 非英文註解。 | `/* Import dialogs. */` |
| [L1503](/Users/tsengpinruei/JustCode/frontend/src/index.css:1503) | 非英文註解。 | `/* Keep the dialog body scrollable when large testcase JSON exceeds the viewport. */` |
| [L1630](/Users/tsengpinruei/JustCode/frontend/src/index.css:1630) | 0fr／1fr、延遲 visibility 與 mounted hidden source 的關係沒有說明，屬非直觀的狀態／動畫配合。 加在 .hidden-test-source-pane 規則正上方。 | 補充：<br>`/* Keep both source fields mounted so switching modes preserves their text. */`<br>`/* Collapse the inactive field and delay hiding it until its closing transition finishes. */` |
| [L1815](/Users/tsengpinruei/JustCode/frontend/src/index.css:1815) | 非英文註解。 | `/* Import feedback. */` |
| [L1856](/Users/tsengpinruei/JustCode/frontend/src/index.css:1856) | 中文註解只重述緊接的 media query。 | 刪除這些註解，保留程式碼。 |
| [L1925](/Users/tsengpinruei/JustCode/frontend/src/index.css:1925) | 非英文註解。 | `/* Reflow the existing table markup into cards on narrow screens. */` |
| [L1941](/Users/tsengpinruei/JustCode/frontend/src/index.css:1941) | 非英文註解。 | `/* Preserve the status, title, difficulty, tags, and actions order in the card layout. */` |
| [L2009](/Users/tsengpinruei/JustCode/frontend/src/index.css:2009) | 中文且位於只改 margin 的 solve-stats-panel 前，真正改排名欄位的是 solve-rank-row／meta。 移至第 2018 行 .solve-rank-row 正上方。 | `/* Move record metadata below the timing bar on narrow screens. */` |

**[tests/editorials.test.ts](/Users/tsengpinruei/JustCode/tests/editorials.test.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L7](/Users/tsengpinruei/JustCode/tests/editorials.test.ts:7) | 環境變數必須先設定再動態 import 的時序限制未說明；整理 imports 時容易破壞。 加在第 7 行正上方。 | 補充：<br>`// Set local mode before importing executors because constants read the environment at module load.` |

**[tests/execution-sandbox.test.ts](/Users/tsengpinruei/JustCode/tests/execution-sandbox.test.ts)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L9](/Users/tsengpinruei/JustCode/tests/execution-sandbox.test.ts:9) | 繞過 private 方法型別的理由不明；需說明測試固定使用 local runner。 加在 execute helper 正上方。 | 補充：<br>`// Call local execution directly so installed Docker images cannot change these process tests.` |

**[problems/add-two-integers/editorial.md](/Users/tsengpinruei/JustCode/problems/add-two-integers/editorial.md)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L89](/Users/tsengpinruei/JustCode/problems/add-two-integers/editorial.md:89) | 程式區塊內有非英文註解。 | `# Limit carry propagation to 32 bits so negative Python integers terminate.` |
| [L98](/Users/tsengpinruei/JustCode/problems/add-two-integers/editorial.md:98) | 中文「處理負數」過於籠統，未解釋 mask 與回復符號的目的。 | `# Interpret the 32-bit result as a signed two's-complement integer.` |
| [L140](/Users/tsengpinruei/JustCode/problems/add-two-integers/editorial.md:140) | 中文行尾且只說缺 return；Java 的裸算術運算也不是合法 statement expression。 | `// This is not a valid Java statement and does not return the sum.` |
| [L155](/Users/tsengpinruei/JustCode/problems/add-two-integers/editorial.md:155) | 中文行尾註解；應移至 def 上方。 | `# Instance methods need self before the problem parameters.` |

**[problems/sort-array/editorial.md](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md)**

| 原始位置 | 問題與放置建議 | 建議註解／修正 |
| --- | --- | --- |
| [L140](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:140) | 中文，對 duplicate 的平方時間描述過廣；three-way partition 不能消除所有 O(n^2) 輸入。 | `// Group equal values together so they are excluded from later partitions.` |
| [L143](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:143) | greater-than 分支不增加 i 的關鍵原因未寫明。 加在此分支前；可改放於第 140 行的多行 partition 說明，避免破壞 if/else 排版。 | 補充：<br>`// Recheck i after swapping from the unclassified right side.` |
| [L146](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:146) | 程式區塊內有非英文註解。 | `// Recurse into the smaller partition and loop over the larger one to bound stack depth.` |
| [L175](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:175) | 程式區塊內有非英文註解。 | `# Process the smaller partition now and defer the larger one to bound the stack size.` |
| [L187](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:187) | 原文混用中文標點且缺少尚未分類區段，應完整交代不變量。 | `# Maintain values below the pivot in [left, lt), equal values in [lt, i),`<br>`# and greater values in (gt, right]; [i, gt] is still unclassified.` |
| [L194](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:194) | 與 Java 相同：swap 後刻意不遞增 i 的原因未說明。 加在 nums[gt], nums[i] 賦值正上方。 | 補充：<br>`# Recheck i because the value swapped from gt has not been classified yet.` |
| [L257](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:257) | 中文註解只重述複製；應說明避免覆蓋尚未讀取元素。 | `// Copy unread values so merging into nums cannot overwrite either sorted half.` |
| [L262–264](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:262) | 三個中文行尾註解；合併成一行，放在第一個指標宣告上方。 | `// i and j read the left and right halves of temp; k writes the merged values into nums.` |
| [L267](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:267) | <= 的穩定性理由雖在段落文字出現，但可複製的實作中沒有就地註解。 加在 <= 條件正上方。 | 補充：<br>`// Prefer the left half on ties to preserve the order of equal values.` |
| [L274](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:274) | 中文註解只重述複製剩餘元素的 while 迴圈。 | 刪除這些註解，保留程式碼。 |
| [L303–305](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:303) | 中文行尾「左右指標」不足以解釋 slice offset 與原陣列 index 的差異。 合併後放在第 303 行上方。 | `# i and j index the copied slice from zero; k indexes the original array.` |
| [L309](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:309) | 缺少相等時選左邊與 stable sort 的關係。 加在 <= 條件正上方。 | 補充：<br>`# Prefer the left half on ties to preserve the order of equal values.` |
| [L366](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:366) | 程式區塊內有非英文註解。 | `// Build from the last parent upward so each node's child subtrees are already heaps.` |
| [L371](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:371) | 程式區塊內有非英文註解。 | `// Move the maximum into the sorted suffix and exclude that suffix from the next heap repair.` |
| [L381](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:381) | 迭代而非遞迴的空間複雜度選擇沒有說明。 加在 heapify 的 while 正上方。 | 補充：<br>`// Repair the heap iteratively to keep auxiliary space constant.` |
| [L409](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:409) | 程式區塊內有非英文註解。 | `# Build from the last parent upward so each node's child subtrees are already heaps.` |
| [L413](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:413) | 程式區塊內有非英文註解。 | `# Move the maximum into the sorted suffix and repair only the remaining heap.` |
| [L421](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:421) | 缺少 iterative heapify 與 O(1) 空間承諾的關係。 加在 while True 正上方。 | 補充：<br>`# Repair the heap iteratively to keep auxiliary space constant.` |
| [L472](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:472)、[L506](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:506) | 中文註解只把 min/max 取值邏輯翻譯成文字；真正必要的是 range 上限，移至配置 count 處。 | 刪除這些註解，保留程式碼。 |
| [L480](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:480) | 「計算出現次數」沒有說明記憶體假設或負數 offset。 | `// The problem bounds limit the count array to at most 100001 entries.`<br>`// Offset values by min so negative numbers map to nonnegative indices.` |
| [L487](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:487) | 中文只說填回；應說明此計數寫回法針對純整數，不能據此宣稱一般紀錄排序穩定。 | `// Rebuild integer values in order; this variant does not preserve identities of equal-key records.` |
| [L510](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:510) | 程式區塊內有非英文註解。 | `# The problem bounds limit the count array to at most 100001 entries.`<br>`# Offset values by min_val so negative numbers map to nonnegative indices.` |
| [L515](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:515) | 程式區塊內有非英文註解。 | `# Rebuild integer values in order; equal-key record identities are not retained.` |
| [L564](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:564) | 中文「正數」遺漏被歸在此組的 0。 | `// Sort nonnegative values separately from the magnitudes of negative values.` |
| [L572](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:572) | 中文行尾只說轉正數，未說 Java Integer.MIN_VALUE 不能直接取負的限制。 | `// Negation is safe under the problem's [-50000, 50000] bounds.` |
| [L576](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:576) | 中文註解只是重述兩次 radixSort 呼叫。 | 刪除這些註解，保留程式碼。 |
| [L582](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:582) | 中文行尾只說「正確順序」，缺少為什麼要反轉。 | `// Larger magnitudes must come first when restored to negative values.` |
| [L585](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:585) | 原文寫「正數」而實際包含 0；並有語言問題。 | `// Restore negative signs, then append the sorted nonnegative values.` |
| [L600](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:600) | 中文註解重述取 max；有效位數限制可集中至下面的 exp 迴圈。 | 刪除這些註解，保留程式碼。 |
| [L603](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:603) | 中文註解未說明 stable pass 是必要條件，以及 exp 使用 int 的輸入限制。 | `// Process decimal digits from least to most significant using stable passes.`<br>`// The problem's magnitude bound of 50000 keeps exp multiplication within int range.` |
| [L612](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:612) | 中文行尾「數字 0–9」重述 int[10]，沒有額外背景。 | 刪除這些註解，保留程式碼。 |
| [L614](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:614) | 中文註解重述 count[digit]++，可刪除。 | 刪除這些註解，保留程式碼。 |
| [L620](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:620) | 中文「累積次數」沒交代其與 count[digit] - 1 的關係。 | `// Prefix sums give each digit's exclusive end position in the output array.` |
| [L625](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:625) | 程式區塊內有非英文註解。 | `// Fill from right to left to preserve the order established by earlier digit passes.` |
| [L633](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:633) | 中文註解只重述 list.set 的寫回迴圈。 | 刪除這些註解，保留程式碼。 |
| [L647](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:647) | 中文且 positive 組包括 0。 | `# Sort nonnegative values separately from the magnitudes of negative values.` |
| [L649](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:649) | 中文行尾註解需移至負數群組的 list comprehension 上方。 | `# Use magnitudes so the digit sorter only handles nonnegative values.` |
| [L655](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:655) | 程式區塊內有非英文註解。 原註解位於行尾。 | `# Reverse magnitudes so restoring their signs produces ascending negative values.` |
| [L657](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:657) | 程式區塊內有非英文註解。 | `# Restore negative signs, then append the sorted nonnegative values.` |
| [L680](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:680) | 中文行尾「數字 0–9」重述配置長度，刪除即可。 | 刪除這些註解，保留程式碼。 |
| [L686](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:686) | 累積次數與 output index 的關係未說明。 加在 prefix-sum for 迴圈上方。 | 補充：<br>`# Prefix sums give each digit's exclusive end position in the output array.` |
| [L689](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:689) | 程式區塊內有非英文註解。 | `# Fill from right to left to preserve the order established by earlier digit passes.` |
| [L771](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:771) | 中文行尾且把最差情況當成無條件結果；應限定 partition 條件。 | `// An endpoint pivot can cause quadratic time on sorted input with simple two-way partitioning.` |
| [L774](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:774) | 程式區塊內有非英文註解。 原註解位於行尾。 | `# An endpoint pivot can cause quadratic time on sorted input with simple two-way partitioning.` |
| [L781–782](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:781) | 註解說選三者中位數，但程式只有 mid index 計算，未完成 median-of-three；註解還位於程式下方。 移至第 780 行計算正上方；刪除原本暗示已避免 worst case 的說明。 | `// This computes only the middle index; median-of-three selection still needs`<br>`// comparisons between the first, middle, and last values.` |
| [L786–787](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:786) | 同 Java 範例：沒有中位數選取實作，且註解置於計算後。 移至第 785 行計算正上方。 | `# This computes only the middle index; median-of-three selection still needs`<br>`# comparisons between the first, middle, and last values.` |
| [L795](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:795) | 中文行尾註解，應明確「若放在每次 merge 裡」才是配置重複的情況。 | `// Allocating inside each merge creates repeated temporary arrays.` |
| [L798](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:798) | 中文行尾；應客觀描述 allocation，而不是暗示此法排序不正確；前方 Python 完整解法就是這種實作。 | `# This slice allocates a new temporary list for each merge.` |
| [L804](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:804) | 中文行尾；不能只靠這行宣告就自動保證重用，需把放置時機與傳遞條件寫明。 | `// Allocate once before recursion and pass the buffer to each merge.` |
| [L807](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:807) | 程式區塊內有非英文註解。 原註解位於行尾。 | `# Allocate once before recursion and pass the buffer to each merge.` |
| [L815–816](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:815) | 兩個中文行尾註解，其中「錯誤」太泛；合併並解釋 index 基準。 刪除兩個行尾註解，把這行放在第 815 行上方。 | `// These child-index formulas assume a one-based heap; nums uses zero-based indices.` |
| [L819–820](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:819) | 兩個中文行尾註解，其中「錯誤」太泛。 合併後放在第 819 行上方。 | `# These child-index formulas assume a one-based heap; nums uses zero-based indices.` |
| [L826–827](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:826) | 中文行尾重複。 合併成一行，放在第 826 行上方。 | `// A zero-based heap stores children at 2 * i + 1 and 2 * i + 2.` |
| [L830–831](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:830) | 中文行尾重複。 合併成一行，放在第 830 行上方。 | `# A zero-based heap stores children at 2 * i + 1 and 2 * i + 2.` |
| [L839](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:839) | 中文行尾；在本題 50000 長度限制內不會 overflow，應說明這是泛用性限制。 | `// For larger arrays, left + right may overflow a Java int.` |
| [L845](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:845) | 程式區塊內有非英文註解。 原註解位於行尾。 | `// Avoid adding two potentially large indices when 0 <= left <= right.` |
| [L848–850](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:848) | 行尾中文加計算後的中文說明；「良好實務／可讀性」泛泛而談。 合併後移至第 848 行上方。 | `# Python integers do not overflow; this form matches the Java index calculation.` |
| [L860](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:860) | 程式區塊內有非英文註解。 | `// Case 1: Unsorted values.` |
| [L863](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:863) | 程式區塊內有非英文註解。 | `// Case 2: Ascending values.` |
| [L866](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:866) | 程式區塊內有非英文註解。 | `// Case 3: Descending values.` |
| [L869](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:869) | 程式區塊內有非英文註解。 | `// Case 4: Many duplicate values.` |
| [L874](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:874) | 程式區塊內有非英文註解。 | `# Case 1: Unsorted values.` |
| [L877](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:877) | 程式區塊內有非英文註解。 | `# Case 2: Ascending values.` |
| [L880](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:880) | 程式區塊內有非英文註解。 | `# Case 3: Descending values.` |
| [L883](/Users/tsengpinruei/JustCode/problems/sort-array/editorial.md:883) | 程式區塊內有非英文註解。 | `# Case 4: Many duplicate values.` |

已將逐檔閱讀結果與完整檔案清單交叉檢查，未發現遺漏的 project-owned source。共核對 396 個詞法註解片段，其中 342 個包含中文；多行 // 註解會計為多個片段，這些數字與上述審查項目數不同。既有中文註解均已對應到清單；既有英文註解亦已核對，只有存在問題者才列出。清單包含 47 筆刪除建議及 34 筆必要背景的補充建議。未發現 TODO／FIXME／HACK／XXX 註解。

驗證採逐檔靜態核對與呼叫流程追蹤，並閱讀相關測試確認實作契約；沒有執行測試或宣稱執行行為已通過測試。每個檔案連結與行號均已驗證有效。Codebase-memory 索引 Users-tsengpinruei-JustCode 狀態為 ready；圖譜用於導覽，動態路由等未完整收錄的關係由現行 source 交叉確認。
