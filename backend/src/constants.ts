// The runners print this marker on its own line before the JSON result.
// Output before the final marker is treated as debug text.
export const RESULT_SEPARATOR = '===RESULT_JSON_START===';

// Limit each testcase and compilation step so runaway code cannot run indefinitely.
export const TESTCASE_TIMEOUT_MS = 1000;
export const COMPILE_TIMEOUT_MS = 10000;
// Share this deadline across compilation and testcase execution.
// Setup, Docker checks, and cleanup may add time outside process timeouts.
export const EXECUTION_TIMEOUT_MS = 60000;

// Cap combined stdout and stderr bytes for each process.
// Apply the same byte cap separately to retained debug text for the submission.
export const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024;

// auto: use Docker when the daemon and image are available; otherwise run locally.
// docker: report Docker failures without falling back to local execution.
// local: run without a shell and with a restricted environment, but no filesystem isolation.
export const SANDBOX_MODE = process.env.JUSTCODE_SANDBOX_MODE || 'auto';
export const JAVA_SANDBOX_IMAGE = process.env.JUSTCODE_JAVA_SANDBOX_IMAGE || 'eclipse-temurin:17-jdk';
export const PYTHON_SANDBOX_IMAGE = process.env.JUSTCODE_PYTHON_SANDBOX_IMAGE || 'python:3.11-slim';
export const DOCKER_SANDBOX_MEMORY = process.env.JUSTCODE_DOCKER_MEMORY || '256m';
export const DOCKER_SANDBOX_CPUS = process.env.JUSTCODE_DOCKER_CPUS || '1';
export const DOCKER_SANDBOX_PIDS_LIMIT = process.env.JUSTCODE_DOCKER_PIDS_LIMIT || '64';

// Protect the bundled problems from deletion through the API and UI.
export const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);
