import { ProblemMetadata, Testcase } from '../types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const isProblemId = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,199}$/.test(value);

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

// Function names are inserted into generated source, so accept identifier-shaped names only.
export const isIdentifier = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);

export function validateMetadata(value: unknown, problemId: string): ProblemMetadata {
    if (!isRecord(value) || value.id !== problemId || typeof value.title !== 'string' || !value.title.trim() ||
        typeof value.difficulty !== 'string' || !['Easy', 'Medium', 'Hard'].includes(value.difficulty) ||
        typeof value.description !== 'string' || !isStringArray(value.tags) || !isStringArray(value.constraints) ||
        !Array.isArray(value.examples) || !value.examples.every((example) => isRecord(example) &&
            typeof example.input === 'string' && typeof example.output === 'string' &&
            (example.explanation === undefined || typeof example.explanation === 'string')) ||
        !Array.isArray(value.supportedLanguages) || value.supportedLanguages.length === 0 ||
        !value.supportedLanguages.every((language) => language === 'java' || language === 'python3') ||
        new Set(value.supportedLanguages).size !== value.supportedLanguages.length ||
        !isRecord(value.functionSignatures) ||
        !value.supportedLanguages.every((language) => typeof (value.functionSignatures as Record<string, unknown>)[language] === 'string')) {
        throw new Error(`Invalid metadata for problem: ${problemId}`);
    }
    if ((value.functionName !== undefined && !isIdentifier(value.functionName)) ||
        (value.returnType !== undefined && (typeof value.returnType !== 'string' || !value.returnType.trim())) ||
        (value.params !== undefined && (!Array.isArray(value.params) ||
            !value.params.every((param) => isRecord(param) && isIdentifier(param.name) &&
                typeof param.type === 'string' && Boolean(param.type.trim())) ||
            new Set(value.params.map((param) => param.name)).size !== value.params.length))) {
        throw new Error(`Invalid function metadata for problem: ${problemId}`);
    }
    return value as unknown as ProblemMetadata;
}

// Validate testcase structure and parameter names only.
// Value types, problem constraints, and expected-answer correctness are not checked here.
export function validateTestcases(value: unknown, metadata?: ProblemMetadata, allowEmpty = true): Testcase[] {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
        throw new Error(`Testcases must be ${allowEmpty ? 'a' : 'a non-empty'} JSON array`);
    }
    const names = metadata?.params?.map((param) => param.name);
    const nameSet = names && new Set(names);
    value.forEach((item, index) => {
        if (!isRecord(item) || !isRecord(item.input) || !Object.prototype.hasOwnProperty.call(item, 'output')) {
            throw new Error(`Testcase ${index + 1} must include an input object and an output field`);
        }
        if (names && nameSet && (Object.keys(item.input).length !== names.length ||
            !Object.keys(item.input).every((name) => nameSet.has(name)))) {
            throw new Error(`Testcase ${index + 1} input keys must exactly match params: ${names.join(', ')}`);
        }
    });
    return value as Testcase[];
}
