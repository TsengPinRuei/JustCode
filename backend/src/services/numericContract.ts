import { isLosslessNumber } from '../shared/json';
import { Language, ProblemMetadata, Testcase } from '../types';

export class FloatingPointRangeError extends Error {}

export function normalizeFloatingValue(value: unknown, type: string): unknown {
    const normalized = type.toLowerCase().replace(/\s/g, '');
    if (normalized.endsWith('[]') && Array.isArray(value)) {
        return value.map(item => normalizeFloatingValue(item, normalized.slice(0, -2)));
    }
    if (normalized === 'double' || normalized === 'float') {
        if (typeof value === 'number' || typeof value === 'bigint' || isLosslessNumber(value)) {
            const number = Number(String(value));
            if (!Number.isFinite(number)) throw new FloatingPointRangeError('Value is outside the finite double range');
            return number;
        }
    }
    return value;
}

function normalizeValue(value: unknown, type: string, location: string, language?: Language, nullable = false): unknown {
    const normalized = type.toLowerCase().replace(/\s/g, '');
    const list = /^list<(.+)>$/.exec(normalized);
    const array = normalized.endsWith('[]');
    if (value === null) {
        if (nullable || list || array || !['int', 'integer', 'long', 'double', 'float', 'boolean', 'bool', 'char'].includes(normalized)) return value;
        throw new Error(`${location}: null is not allowed for ${type}`);
    }
    if (list || array) {
        if (!Array.isArray(value)) throw new Error(`${location}: expected ${type}`);
        const childType = list ? list[1] : normalized.slice(0, -2);
        return value.map((item, index) => normalizeValue(item, childType, `${location}[${index}]`, language, Boolean(list)));
    }
    if (['int', 'integer', 'long'].includes(normalized)) {
        if (typeof value !== 'bigint' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
            throw new Error(`${location}: expected an exact integer for ${type}`);
        }
        const integer = BigInt(value);
        if (language === 'java') {
            const [minimum, maximum] = normalized === 'long' ? [-9223372036854775808n, 9223372036854775807n] : [-2147483648n, 2147483647n];
            if (integer < minimum || integer > maximum) throw new Error(`${location}: value is outside Java ${normalized === 'long' ? 'long' : 'int'} range`);
        }
        return value;
    }
    if (normalized === 'double' || normalized === 'float') {
        const number = normalizeFloatingValue(value, normalized);
        if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error(`${location}: expected a finite double (float is a double alias)`);
        return number;
    }
    // Other supported types keep their existing conversion semantics. In
    // particular primitive boolean/char array elements may never become null.
    return value;
}

export function normalizeTestcases(testcases: Testcase[], metadata?: ProblemMetadata, language?: Language): Testcase[] {
    if (!metadata?.params) return testcases;
    return testcases.map((testcase, index) => {
        const input = { ...testcase.input };
        for (const param of metadata.params!) {
            input[param.name] = normalizeValue(input[param.name], param.type, `Testcase ${index + 1} input.${param.name}`, language);
        }
        // null also represents custom input's intentionally absent expected answer.
        const output = metadata.returnType && testcase.output !== null ?
            normalizeValue(testcase.output, metadata.returnType, `Testcase ${index + 1} output`, language) : testcase.output;
        return { input, output };
    });
}
