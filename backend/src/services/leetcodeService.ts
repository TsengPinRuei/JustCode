import { ProblemMetadata, Testcase, Language } from '../types';

// Shape of the subset of LeetCode's GraphQL response that JustCode imports.
interface LeetCodeGraphQLResponse {
    data: {
        question: {
            questionId: string;
            questionFrontendId: string;
            title: string;
            titleSlug: string;
            content: string;
            difficulty: string;
            topicTags: Array<{ name: string; slug: string }>;
            codeSnippets: Array<{
                lang: string;
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

const LEETCODE_PROBLEM_SLUG_REGEX = /leetcode\.com\/problems\/([a-z0-9-]+)/i;
// Signature regexes are for display/reference only; execution uses LeetCode metaData instead.
const JAVA_SIGNATURE_REGEX = /public\s+\S+\s+\w+\s*\([^)]*\)/;
const PYTHON_SIGNATURE_REGEX = /def\s+\w+\s*\(self[^)]*\)\s*->[^:]+/;
// Normalize LeetCode type labels to the narrower set supported by the generated runners.
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

    /**
     * Extract titleSlug from a LeetCode URL.
     * Supports: https://leetcode.com/problems/two-sum/
     *           https://leetcode.com/problems/two-sum/description/
     *           https://leetcode.com/problems/two-sum
     */
    private extractSlug(url: string): string {
        const match = url.match(LEETCODE_PROBLEM_SLUG_REGEX);
        if (!match) {
            throw new Error('Invalid LeetCode URL. Expected format: https://leetcode.com/problems/<problem-slug>/');
        }
        return match[1].toLowerCase();
    }

    /**
     * Fetch public problem data from LeetCode's GraphQL API.
     * This imports only visible metadata/examples, not LeetCode's hidden judge cases.
     */
    private async fetchProblemData(titleSlug: string): Promise<LeetCodeGraphQLResponse> {
        const query = `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    content
                    difficulty
                    topicTags {
                        name
                        slug
                    }
                    codeSnippets {
                        lang
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
            throw new Error(`LeetCode API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as LeetCodeGraphQLResponse;
        if (!data.data?.question) {
            throw new Error(`Problem "${titleSlug}" not found on LeetCode`);
        }

        return data;
    }

    /**
     * Parse LeetCode HTML content into markdown-ish description, examples, and constraints.
     * The regexes intentionally target common LeetCode markup and may need updates if their DOM changes.
     */
    private parseContent(html: string): {
        description: string;
        examples: Array<{ input: string; output: string; explanation?: string }>;
        constraints: string[];
    } {
        // Accumulate text fields separately so partial parsing failures do not break all imports.
        let description = '';
        const examples: Array<{ input: string; output: string; explanation?: string }> = [];
        const constraints: string[] = [];

        // Decode the small entity set LeetCode commonly emits before applying markup regexes.
        const cleanHtml = html
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');

        // The description is everything before "Example 1" when that marker exists.
        const exampleStart = cleanHtml.search(/<strong[^>]*>Example\s*1/i);
        if (exampleStart !== -1) {
            description = this.stripHtml(cleanHtml.substring(0, exampleStart)).trim();
        } else {
            description = this.stripHtml(cleanHtml).trim();
        }

        // Examples are parsed from the rendered statement, while raw testcase input comes from exampleTestcaseList.
        const exampleRegex = /<strong[^>]*>Example\s*(\d+)[^<]*<\/strong>([\s\S]*?)(?=<strong[^>]*>Example\s*\d|<strong[^>]*>Constraints|<p><strong[^>]*>Constraints|$)/gi;
        let exMatch;
        while ((exMatch = exampleRegex.exec(cleanHtml)) !== null) {
            const exContent = exMatch[2];

            // Inputs/outputs remain display strings here; parseTestcases converts machine values later.
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

        // Constraints usually live in a list after the final Constraints heading.
        const constraintSection = cleanHtml.match(/<strong[^>]*>Constraints[^<]*<\/strong>([\s\S]*?)$/i);
        if (constraintSection) {
            const constraintHtml = constraintSection[1];
            // Keep each bullet as a single compact string for UI rendering.
            const liRegex = /<li>([\s\S]*?)<\/li>/gi;
            let liMatch;
            while ((liMatch = liRegex.exec(constraintHtml)) !== null) {
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

    /**
     * Strip HTML tags while preserving enough markdown-like formatting for descriptions.
     */
    private stripHtml(html: string): string {
        return html
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
            .trim();
    }

    /**
     * Strip all HTML tags from examples/constraints where markdown markers would be noisy.
     */
    private stripAllHtml(html: string): string {
        return html
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<\/?p>/g, '\n')
            .replace(/<\/?pre>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Map LeetCode type strings to the internal labels understood by code executors.
     * Unsupported complex structures are returned as-is and need executor support before they run.
     */
    private mapLeetCodeType(lcType: string): string {
        const t = lcType.trim();
        return LEETCODE_TYPE_MAP[t] ?? t;
    }

    /**
     * Parse exampleTestcaseList values into testcase objects.
     * Each example input is a newline-delimited series of parameter values in metadata order.
     */
    private parseTestcases(
        exampleTestcaseList: string[],
        params: Array<{ name: string; type: string }>,
        examples: Array<{ input: string; output: string }>
    ): Testcase[] {
        const testcases: Testcase[] = [];

        for (let i = 0; i < exampleTestcaseList.length; i++) {
            const rawInput = exampleTestcaseList[i];
            const lines = rawInput
                .split('\n')
                .map(line => line.trim())
                .filter(line => line !== '');

            const input: Record<string, unknown> = {};

            // Each line corresponds to one parameter; JSON.parse handles arrays/numbers/booleans.
            for (let j = 0; j < params.length && j < lines.length; j++) {
                const param = params[j];
                const line = lines[j];
                try {
                    input[param.name] = JSON.parse(line);
                } catch {
                    // Bare strings are not valid JSON in LeetCode examples, so keep them as text.
                    input[param.name] = line;
                }
            }

            // The display output may be JSON-compatible; otherwise keep its raw string form.
            let output: unknown = null;
            if (i < examples.length) {
                try {
                    output = JSON.parse(examples[i].output);
                } catch {
                    output = examples[i].output;
                }
            }

            testcases.push({ input, output });
        }

        return testcases;
    }

    /**
     * Main import function: fetch from LeetCode and convert to JustCode's file-backed format.
     */
    async importProblem(url: string): Promise<{
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }> {
        const titleSlug = this.extractSlug(url);

        // Fetch public statement metadata before converting it into local problem files.
        const response = await this.fetchProblemData(titleSlug);
        const question = response.data.question;

        // metaData supplies the canonical function name, params, and return type for runner generation.
        let metaData: LeetCodeMetaData;
        try {
            metaData = JSON.parse(question.metaData);
        } catch {
            throw new Error('Failed to parse problem metadata from LeetCode');
        }

        // Parse human-readable statement sections from LeetCode's HTML content.
        const { description, examples, constraints } = this.parseContent(question.content);

        // Normalize parameter types before saving metadata consumed by executors.
        const params = metaData.params.map(p => ({
            name: p.name,
            type: this.mapLeetCodeType(p.type),
        }));

        const returnType = this.mapLeetCodeType(metaData.return.type);

        // Save only languages that this project has executor support for.
        const supportedLanguages: Language[] = [];
        const templates: Record<string, string> = {};
        const functionSignatures: Record<string, string> = {};

        for (const snippet of question.codeSnippets) {
            if (snippet.langSlug === 'java') {
                supportedLanguages.push('java');
                templates['java'] = snippet.code;
                // Keep the displayed signature for UI/reference; execution uses metadata instead.
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

        // LeetCode exposes example testcases only; hidden cases must be added manually later.
        const testcases = this.parseTestcases(
            question.exampleTestcaseList,
            metaData.params,
            examples
        );

        // Build the canonical problem metadata saved in problem.json.
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
