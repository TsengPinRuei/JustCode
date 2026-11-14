import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';

// JSON integer tokens remain integers on disk and over HTTP. BigInt is only the
// in-memory representation; numeric-looking strings remain strings.
function parseNumber(token: string): number | bigint | LosslessNumber {
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!;
    const fraction = match[3] || '';
    const digits = match[2] + fraction;
    const scale = Number(match[4] || 0) - fraction.length;
    let integer: string | undefined;
    if (/^0+$/.test(digits)) integer = '0';
    else if (scale >= 0 && scale <= 1_000_000) integer = digits + '0'.repeat(scale);
    else if (scale < 0 && -scale < digits.length && /^0+$/.test(digits.slice(scale))) integer = digits.slice(0, scale);
    if (integer !== undefined) {
        const exact = BigInt(match[1] + integer);
        return exact >= BigInt(Number.MIN_SAFE_INTEGER) && exact <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(exact) : exact;
    }
    const number = Number(token);
    // Retain fractional tokens that round to integers, underflow, or overflow so
    // integer validation cannot accidentally accept a rounded value.
    return Number.isFinite(number) && !Number.isInteger(number) ? number : new LosslessNumber(token);
}

export function parseJson(text: string): unknown {
    return parse(text, undefined, { parseNumber });
}

export function stringifyJson(value: unknown, space?: number): string {
    const result = stringify(value, undefined, space);
    if (result === undefined) throw new TypeError('Value is not JSON serializable');
    return result;
}

export { isLosslessNumber };
