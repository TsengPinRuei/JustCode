// 兩種語言 runner 共用的執行設定。
// 將這些值集中管理，確保 Java 與 Python judge 行為一致。

// 由產生的 runner 在機器可讀結果前立即印出。
// 此標記前的所有內容都視為使用者除錯輸出。
export const RESULT_SEPARATOR = '===RESULT_JSON_START===';

// 單一測試案例與編譯限制可避免失控提交阻塞伺服器。
export const TESTCASE_TIMEOUT_MS = 1000; // 每個測試案例 1 秒
export const COMPILE_TIMEOUT_MS = 10000; // 編譯 10 秒

// maxBuffer 需要足以容納大量除錯輸出，但仍必須有上限。
export const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024; // 10 MB，用來處理大型輸出

// Sandbox 模式：
// - auto: 需要的 image 已存在時使用 Docker，否則使用受限的本機執行。
// - docker: daemon/image 不可用時以封閉失敗方式處理。
// - local: 相容模式，不執行 shell，並使用最小化 process environment。
export const SANDBOX_MODE = process.env.JUSTCODE_SANDBOX_MODE || 'auto';
export const JAVA_SANDBOX_IMAGE = process.env.JUSTCODE_JAVA_SANDBOX_IMAGE || 'eclipse-temurin:17-jdk';
export const PYTHON_SANDBOX_IMAGE = process.env.JUSTCODE_PYTHON_SANDBOX_IMAGE || 'python:3.11-slim';
export const DOCKER_SANDBOX_MEMORY = process.env.JUSTCODE_DOCKER_MEMORY || '256m';
export const DOCKER_SANDBOX_CPUS = process.env.JUSTCODE_DOCKER_CPUS || '1';
export const DOCKER_SANDBOX_PIDS_LIMIT = process.env.JUSTCODE_DOCKER_PIDS_LIMIT || '64';

// 內建種子題目是已安裝 app 的一部分，不應被 UI 刪除。
export const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);
