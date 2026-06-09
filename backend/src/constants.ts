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

// Sandbox mode:
// - auto: use Docker when the required image is already present, otherwise use restricted local execution.
// - docker: fail closed through Docker if the daemon/image is unavailable.
// - local: compatibility mode with no shell execution and a minimal process environment.
export const SANDBOX_MODE = process.env.JUSTCODE_SANDBOX_MODE || 'auto';
export const JAVA_SANDBOX_IMAGE = process.env.JUSTCODE_JAVA_SANDBOX_IMAGE || 'eclipse-temurin:17-jdk';
export const PYTHON_SANDBOX_IMAGE = process.env.JUSTCODE_PYTHON_SANDBOX_IMAGE || 'python:3.11-slim';
export const DOCKER_SANDBOX_MEMORY = process.env.JUSTCODE_DOCKER_MEMORY || '256m';
export const DOCKER_SANDBOX_CPUS = process.env.JUSTCODE_DOCKER_CPUS || '1';
export const DOCKER_SANDBOX_PIDS_LIMIT = process.env.JUSTCODE_DOCKER_PIDS_LIMIT || '64';

// Built-in seed problems are part of the installed app and should survive UI deletes.
export const PROTECTED_PROBLEMS = new Set(['sort-array', 'add-two-integers']);
