// Add only standard names actually referenced by the downloaded snippet. The
// imports become visible template lines, so compiler diagnostics need no offset.
const JAVA_UTIL_TYPES = [
    'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'LinkedHashMap', 'TreeMap',
    'Set', 'HashSet', 'LinkedHashSet', 'TreeSet', 'Queue', 'Deque', 'ArrayDeque',
    'PriorityQueue', 'Stack', 'Collection', 'Collections', 'Arrays', 'Comparator',
    'Iterator', 'Optional', 'Objects',
];
const PYTHON_TYPING_TYPES = [
    'List', 'Optional', 'Tuple', 'Dict', 'Set', 'FrozenSet', 'Deque', 'DefaultDict',
    'Union', 'Any', 'Iterable', 'Iterator', 'Sequence', 'MutableSequence', 'Mapping',
    'MutableMapping', 'Callable', 'Literal', 'Collection',
];

export function addJavaStandardImports(code: string): string {
    const existingImports = [...code.matchAll(/^\s*import\s+(?!static\b)([\w.]+(?:\*)?)\s*;/gm)].map(match => match[1]);
    if (existingImports.includes('java.util.*')) return code;
    const missing = JAVA_UTIL_TYPES.filter(name =>
        new RegExp(`(?<![\\w.])${name}\\b`).test(code) &&
        !existingImports.some(value => value.endsWith(`.${name}`)) &&
        !new RegExp(`\\b(?:class|interface|enum|record)\\s+${name}\\b`).test(code));
    if (!missing.length) return code;
    const prelude = missing.map(name => `import java.util.${name};`).join('\n') + '\n';
    const packageLine = /^\s*package\s+[\w.]+\s*;/m.exec(code);
    const position = packageLine ? packageLine.index + packageLine[0].length : 0;
    return code.slice(0, position) + (position ? '\n' : '') + prelude + code.slice(position);
}

export function addPythonStandardImports(code: string): string {
    const imported = new Set<string>();
    for (const match of code.matchAll(/^\s*from\s+[\w.]+\s+import\s+(\([^)]*\)|[^\n]+)/gm)) {
        if (/^\s*from\s+typing\s+import\s/.test(match[0]) && match[1].trim() === '*') return code;
        for (const entry of match[1].replace(/[()]/g, '').split(',')) {
            const binding = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*(?:#.*)?$/.exec(entry);
            if (binding) imported.add(binding[2] || binding[1]);
        }
    }
    const missing = PYTHON_TYPING_TYPES.filter(name =>
        new RegExp(`(?<![\\w.])${name}\\b`).test(code) && !imported.has(name) &&
        !new RegExp(`^\\s*(?:(?:class|def)\\s+${name}\\b|${name}\\s*=)`, 'm').test(code));
    if (!missing.length) return code;
    const prelude = `from typing import ${missing.join(', ')}\n`;
    // Future imports must remain before every ordinary import. Imported snippets
    // with a module docstring retain it when they also have a future import.
    const futures = [...code.matchAll(/^from\s+__future__\s+import\s+(?:\([^)]*\)|[^\n]+)\n?/gm)];
    const lastFuture = futures[futures.length - 1];
    const position = lastFuture ? lastFuture.index! + lastFuture[0].length : 0;
    return code.slice(0, position) + prelude + code.slice(position);
}
