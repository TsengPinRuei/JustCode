import { ProblemMetadata, Testcase, Language } from '../types';
import { isIdentifier, isRecord } from './problemValidation';
import { invalidInput } from './storage';

// Model only the GraphQL fields used by the importer.
interface LeetCodeGraphQLResponse {
    data: {
        question: {
            questionFrontendId: string;
            title: string;
            content: string;
            difficulty: string;
            topicTags: Array<{ name: string }>;
            codeSnippets: Array<{
                langSlug: string;
                code: string;
            }>;
            exampleTestcaseList: string[];
            metaData: string;
        };
    };
}

interface LeetCodeMetaData {
    name: string;
    params: Array<{ name: string; type: string }>;
    return: { type: string };
}

// Extract signatures for display only; runner generation uses structured metaData.
const JAVA_SIGNATURE_REGEX = /public\s+\S+\s+\w+\s*\([^)]*\)/;
const PYTHON_SIGNATURE_REGEX = /def\s+\w+\s*\(self[^)]*\)\s*->[^:]+/;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
// Normalize known LeetCode type aliases; unknown labels are handled separately.
const LEETCODE_TYPE_MAP: Record<string, string> = {
    integer: 'int',
    int: 'int',
    'integer[]': 'int[]',
    'int[]': 'int[]',
    'integer[][]': 'int[][]',
    'int[][]': 'int[][]',
    string: 'string',
    'string[]': 'string[]',
    'string[][]': 'string[][]',
    boolean: 'boolean',
    'boolean[]': 'boolean[]',
    double: 'double',
    float: 'double',
    'double[]': 'double[]',
    'float[]': 'double[]',
    long: 'long',
    'long[]': 'long[]',
    character: 'char',
    char: 'char',
    'character[]': 'char[]',
    'char[]': 'char[]',
    'character[][]': 'char[][]',
    'char[][]': 'char[][]',
    'list<integer>': 'list<integer>',
    'list<int>': 'list<integer>',
    'list<string>': 'list<string>',
    'list<list<integer>>': 'list<list<integer>>',
    'list<list<int>>': 'list<list<integer>>',
    'list<list<string>>': 'list<list<string>>',
    'list<boolean>': 'list<boolean>',
};

export class LeetCodeService {
    private readonly GRAPHQL_URL = 'https://leetcode.com/graphql';

    // Accept problem URLs on the allowed LeetCode hosts and normalize the slug to lowercase.
    // Reject credentials and non-default ports before making a request.
    private extractSlug(url: string): string {
        try {
            const parsed = new URL(url);
            const match = parsed.pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/i);
            if (!['https:', 'http:'].includes(parsed.protocol) ||
                !['leetcode.com', 'www.leetcode.com'].includes(parsed.hostname) ||
                parsed.username || parsed.password || parsed.port || !match) throw new Error('Invalid URL');
            return match[1].toLowerCase();
        } catch {
            throw invalidInput('Invalid LeetCode URL. Expected format: https://leetcode.com/problems/<problem-slug>/');
        }
    }

    // Fetch public metadata, templates, and example inputs; hidden judge tests are not requested.
    private async fetchProblemData(titleSlug: string): Promise<LeetCodeGraphQLResponse> {
        const query = `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionFrontendId
                    title
                    content
                    difficulty
                    topicTags {
                        name
                    }
                    codeSnippets {
                        langSlug
                        code
                    }
                    exampleTestcaseList
                    metaData
                }
            }
        `;

        const response = await fetch(this.GRAPHQL_URL, {
            method: 'POST',
            signal: AbortSignal.timeout(15_000),
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json',
                'Referer': `https://leetcode.com/problems/${titleSlug}/`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            body: JSON.stringify({
                query,
                variables: { titleSlug },
                operationName: 'questionData',
            }),
        });

        if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`LeetCode API returned ${response.status}: ${response.statusText}`);
        }

        // Limit bytes read from the decoded response stream; Content-Length alone cannot bound it.
        if (!response.body) throw new Error('LeetCode API returned an empty response');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > MAX_RESPONSE_BYTES) throw new Error('LeetCode API response exceeds 10 MB');
                chunks.push(value);
            }
        } finally {
            await reader.cancel();
            reader.releaseLock();
        }
        const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        if (!isRecord(data) || !isRecord(data.data) || !isRecord(data.data.question)) {
            throw new Error(`Problem "${titleSlug}" not found on LeetCode`);
        }
        const question = data.data.question;
        if (typeof question.content !== 'string' || !question.content.trim() ||
            typeof question.metaData !== 'string' || typeof question.title !== 'string' ||
            typeof question.questionFrontendId !== 'string' ||
            typeof question.difficulty !== 'string' || !['Easy', 'Medium', 'Hard'].includes(question.difficulty) ||
            !Array.isArray(question.topicTags) || !question.topicTags.every((tag) => isRecord(tag) && typeof tag.name === 'string') ||
            !Array.isArray(question.codeSnippets) || !question.codeSnippets.every((snippet) =>
                isRecord(snippet) && typeof snippet.langSlug === 'string' && typeof snippet.code === 'string') ||
            !Array.isArray(question.exampleTestcaseList) || !question.exampleTestcaseList.every((example) => typeof example === 'string')) {
            throw new Error('LeetCode returned incomplete or unavailable public problem data');
        }
        return data as unknown as LeetCodeGraphQLResponse;
    }

    // Parse the expected LeetCode HTML into description text, examples, and constraints.
    // These patterns depend on the source markup and may need updates when it changes.
    private parseContent(html: string): {
        description: string;
        examples: Array<{ input: string; output: string; explanation?: string }>;
        constraints: string[];
    } {
        let description = '';
        const examples: Array<{ input: string; output: string; explanation?: string }> = [];
        const constraints: string[] = [];

        // Use the text before the first recognized example as the main description.
        const exampleStart = html.search(/<strong[^>]*>Example\s*1/i);
        if (exampleStart !== -1) {
            description = this.stripHtml(html.substring(0, exampleStart)).trim();
        } else {
            description = this.stripHtml(html).trim();
        }

        // Read displayed examples from HTML; executable inputs come from exampleTestcaseList.
        const exampleRegex = /<strong[^>]*>Example\s*(\d+)[^<]*<\/strong>([\s\S]*?)(?=<strong[^>]*>Example\s*\d|<strong[^>]*>Constraints|<p><strong[^>]*>Constraints|$)/gi;
        let exMatch;
        while ((exMatch = exampleRegex.exec(html)) !== null) {
            const exContent = exMatch[2];

            // Keep these values as display text; parseTestcases parses the expected output.
            // Executable input values come from exampleTestcaseList, not this input string.
            const inputMatch = exContent.match(/Input:\s*([\s\S]*?)(?=Output:|$)/i);
            const outputMatch = exContent.match(/Output:\s*([\s\S]*?)(?=Explanation:|<\/pre>|$)/i);
            const explanationMatch = exContent.match(/Explanation:\s*([\s\S]*?)(?=<\/pre>|$)/i);

            if (inputMatch && outputMatch) {
                const input = this.stripAllHtml(inputMatch[1]).trim();
                const output = this.stripAllHtml(outputMatch[1]).trim();
                const explanation = explanationMatch ? this.stripAllHtml(explanationMatch[1]).trim() : undefined;
                examples.push({ input, output, ...(explanation ? { explanation } : {}) });
            }
        }

        // Read constraint list items after the first matching Constraints heading.
        const constraintSection = html.match(/<strong[^>]*>Constraints[^<]*<\/strong>([\s\S]*?)$/i);
        if (constraintSection) {
            const constraintHtml = constraintSection[1];
            const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
            let liMatch;
            while ((liMatch = liRegex.exec(constraintHtml)) !== null) {
                // Collapse whitespace so each constraint occupies one compact list item.
                const constraint = this.stripAllHtml(liMatch[1])
                    .replace(/\s+/g, ' ')
                    .trim();
                if (constraint) {
                    constraints.push(constraint);
                }
            }
        }

        return { description, examples, constraints };
    }

    // Preserve a small Markdown subset for the description while removing HTML tags.
    private stripHtml(html: string): string {
        // Strip HTML tags before decoding entities so escaped comparison signs remain text.
        return this.decodeEntities(html
            .replace(/<code>/g, '`')
            .replace(/<\/code>/g, '`')
            .replace(/<strong>/g, '**')
            .replace(/<\/strong>/g, '**')
            .replace(/<em>/g, '*')
            .replace(/<\/em>/g, '*')
            .replace(/<sup>/g, '^')
            .replace(/<\/sup>/g, '')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<\/?p>/g, '\n')
            .replace(/<\/?pre>/g, '')
            .replace(/<\/?ul>/g, '\n')
            .replace(/<\/?ol>/g, '\n')
            .replace(/<li>/g, '- ')
            .replace(/<\/li>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim());
    }

    // Return literal example and constraint text without adding Markdown formatting.
    private stripAllHtml(html: string): string {
        // Strip HTML tags before decoding entities so escaped comparison signs remain text.
        return this.decodeEntities(html
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<\/?p>/g, '\n')
            .replace(/<\/?pre>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim());
    }

    private decodeEntities(text: string): string {
        const entities: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
        return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos|nbsp);/gi, (match, entity: string) => {
            if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
            const hex = entity[1].toLowerCase() === 'x';
            const codepoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
            return codepoint > 0 && codepoint <= 0x10ffff && !(codepoint >= 0xd800 && codepoint <= 0xdfff)
                ? String.fromCodePoint(codepoint) : match;
        });
    }

    // Normalize known aliases and preserve unknown type labels.
    // Importing a label does not guarantee that an executor supports its structure.
    private mapLeetCodeType(lcType: string): string {
        const t = lcType.trim();
        return LEETCODE_TYPE_MAP[t] ?? t;
    }

    // Match each newline-separated input list to metadata parameters in order.
    // Pair it with the corresponding HTML example output, rejecting count mismatches.
    private parseTestcases(
        exampleTestcaseList: string[],
        params: Array<{ name: string; type: string }>,
        examples: Array<{ input: string; output: string }>,
        returnType: string
    ): Testcase[] {
        if (exampleTestcaseList.length === 0 || exampleTestcaseList.length !== examples.length) {
            throw new Error('Could not match every public example input with its expected output');
        }
        const testcases: Testcase[] = [];

        for (let i = 0; i < exampleTestcaseList.length; i++) {
            const rawInput = exampleTestcaseList[i];
            const lines: string[] = [];
            for (const rawLine of rawInput.split('\n')) {
                const line = rawLine.trim();
                if (line !== '') {
                    lines.push(line);
                }
            }

            if (lines.length !== params.length) {
                throw new Error(`Example ${i + 1} does not match the problem parameter count`);
            }
            const input: Record<string, unknown> = Object.create(null);

            for (let j = 0; j < params.length; j++) {
                const param = params[j];
                const line = lines[j];
                try {
                    input[param.name] = JSON.parse(line);
                } catch {
                    // Accept unquoted text only for string or character parameters.
                    if (!['string', 'char', 'character'].includes(param.type)) {
                        throw new Error(`Example ${i + 1} contains an invalid value for ${param.name}`);
                    }
                    input[param.name] = line;
                }
            }

            // Accept unquoted expected text only for string or character results.
            // Reject malformed JSON for numeric and collection results.
            let output: unknown;
            try {
                output = JSON.parse(examples[i].output);
            } catch {
                if (!['string', 'char'].includes(returnType)) {
                    throw new Error(`Example ${i + 1} has an unsupported expected output`);
                }
                output = examples[i].output;
            }

            testcases.push({ input, output });
        }

        return testcases;
    }

    // Convert public problem data to local metadata, templates, and visible tests.
    // The caller is responsible for saving these files.
    async importProblem(url: string): Promise<{
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }> {
        const titleSlug = this.extractSlug(url);

        const response = await this.fetchProblemData(titleSlug);
        const question = response.data.question;

        // Use structured metaData for the method name, ordered parameters, and return type.
        let parsedMetadata: unknown;
        try {
            parsedMetadata = JSON.parse(question.metaData);
        } catch {
            throw new Error('Failed to parse problem metadata from LeetCode');
        }
        if (!isRecord(parsedMetadata) || !isIdentifier(parsedMetadata.name) ||
            !Array.isArray(parsedMetadata.params) || !parsedMetadata.params.every((param) =>
                isRecord(param) && isIdentifier(param.name) && typeof param.type === 'string' && param.type.trim()) ||
            new Set(parsedMetadata.params.map((param) => param.name)).size !== parsedMetadata.params.length ||
            !isRecord(parsedMetadata.return) || typeof parsedMetadata.return.type !== 'string' || !parsedMetadata.return.type.trim()) {
            throw invalidInput('Only problems with a supported function signature can be imported; design-class problems are unsupported');
        }
        const metaData = parsedMetadata as unknown as LeetCodeMetaData;

        const { description, examples, constraints } = this.parseContent(question.content);

        const params = metaData.params.map(p => ({
            name: p.name,
            type: this.mapLeetCodeType(p.type),
        }));

        const returnType = this.mapLeetCodeType(metaData.return.type);

        // Keep templates only for languages that have a local executor.
        const supportedLanguages: Language[] = [];
        const templates: Record<string, string> = {};
        const functionSignatures: Record<string, string> = {};

        for (const snippet of question.codeSnippets) {
            if (Object.prototype.hasOwnProperty.call(templates, snippet.langSlug)) continue;
            if (snippet.langSlug === 'java') {
                supportedLanguages.push('java');
                templates['java'] = snippet.code;
                const sigMatch = snippet.code.match(JAVA_SIGNATURE_REGEX);
                functionSignatures['java'] = sigMatch ? sigMatch[0] : '';
            } else if (snippet.langSlug === 'python3') {
                supportedLanguages.push('python3');
                templates['python3'] = snippet.code;
                const sigMatch = snippet.code.match(PYTHON_SIGNATURE_REGEX);
                functionSignatures['python3'] = sigMatch ? sigMatch[0] : '';
            }
        }

        if (supportedLanguages.length === 0) {
            throw new Error('No supported languages (Java/Python3) found for this problem');
        }

        // Import public example tests only; additional hidden tests must be supplied locally.
        const testcases = this.parseTestcases(
            question.exampleTestcaseList,
            params,
            examples,
            returnType
        );

        const metadata: ProblemMetadata = {
            id: titleSlug,
            title: `${question.questionFrontendId}. ${question.title}`,
            difficulty: question.difficulty as 'Easy' | 'Medium' | 'Hard',
            tags: question.topicTags.map(t => t.name),
            description,
            examples,
            constraints,
            supportedLanguages,
            functionSignatures: functionSignatures as Record<Language, string>,
            functionName: metaData.name,
            params,
            returnType,
        };

        return {
            metadata,
            templates,
            visibleTestcases: testcases,
        };
    }
}
