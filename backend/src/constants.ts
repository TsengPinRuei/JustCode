// Shared constants for code execution

// Separator marker between debug output and JSON result
export const RESULT_SEPARATOR = '===RESULT_JSON_START===';

// Execution timeouts
export const TESTCASE_TIMEOUT_MS = 1000; // 1 second per testcase
export const COMPILE_TIMEOUT_MS = 10000; // 10 seconds for compilation

// Output limits
export const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024; // 10 MB to handle large outputs

// Built-in problems that cannot be deleted
export const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);
