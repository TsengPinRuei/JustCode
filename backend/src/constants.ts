// Shared execution settings used by both language runners.
// Keep these values centralized so Java and Python judge behavior stays aligned.

// Printed by generated runners immediately before the machine-readable result.
// Everything before this marker is treated as user debug output.
export const RESULT_SEPARATOR = '===RESULT_JSON_START===';

// Per-testcase and compilation limits keep runaway submissions from blocking the server.
export const TESTCASE_TIMEOUT_MS = 1000; // 1 second per testcase
export const COMPILE_TIMEOUT_MS = 10000; // 10 seconds for compilation

// maxBuffer must be large enough for debug-heavy runs but still bounded.
export const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024; // 10 MB to handle large outputs

// Built-in seed problems are part of the installed app and should survive UI deletes.
export const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);
