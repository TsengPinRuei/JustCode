import { ProblemMetadata, Testcase, Language } from '../types';

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

export class LeetCodeService {
    private readonly GRAPHQL_URL = 'https://leetcode.com/graphql';

    /**
     * Extract titleSlug from a LeetCode URL
     * Supports: https://leetcode.com/problems/two-sum/
     *           https://leetcode.com/problems/two-sum/description/
     *           https://leetcode.com/problems/two-sum
     */
    private extractSlug(url: string): string {
        const match = url.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
        if (!match) {
            throw new Error('Invalid LeetCode URL. Expected format: https://leetcode.com/problems/<problem-slug>/');
        }
        return match[1].toLowerCase();
    }

    /**
     * Fetch problem data from LeetCode's GraphQL API
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
     * Parse HTML content to extract description, examples, and constraints
     */
    private parseContent(html: string): {
        description: string;
        examples: Array<{ input: string; output: string; explanation?: string }>;
        constraints: string[];
    } {
        // Strip HTML tags for description
        let description = '';
        const examples: Array<{ input: string; output: string; explanation?: string }> = [];
        const constraints: string[] = [];

        // Remove HTML tags and decode entities for the description part
        // Split content by example sections
        const cleanHtml = html
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');

        // Extract description (text before the first example)
        const exampleStart = cleanHtml.search(/<strong[^>]*>Example\s*1/i);
        if (exampleStart !== -1) {
            description = this.stripHtml(cleanHtml.substring(0, exampleStart)).trim();
        } else {
            description = this.stripHtml(cleanHtml).trim();
        }

        // Extract examples
        const exampleRegex = /<strong[^>]*>Example\s*(\d+)[^<]*<\/strong>([\s\S]*?)(?=<strong[^>]*>Example\s*\d|<strong[^>]*>Constraints|<p><strong[^>]*>Constraints|$)/gi;
        let exMatch;
        while ((exMatch = exampleRegex.exec(cleanHtml)) !== null) {
            const exContent = exMatch[2];

            // Extract input
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

        // Extract constraints
        const constraintSection = cleanHtml.match(/<strong[^>]*>Constraints[^<]*<\/strong>([\s\S]*?)$/i);
        if (constraintSection) {
            const constraintHtml = constraintSection[1];
            // Extract list items
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
     * Strip HTML tags from a string
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
     * Strip all HTML tags from a string without any markdown conversion
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
     * Map LeetCode type strings to our internal type format
     */
    private mapLeetCodeType(lcType: string): string {
        const t = lcType.trim();
        // Common LeetCode types
        if (t === 'integer' || t === 'int') return 'int';
        if (t === 'integer[]' || t === 'int[]') return 'int[]';
        if (t === 'integer[][]' || t === 'int[][]') return 'int[][]';
        if (t === 'string') return 'string';
        if (t === 'string[]') return 'string[]';
        if (t === 'string[][]') return 'string[][]';
        if (t === 'boolean') return 'boolean';
        if (t === 'boolean[]') return 'boolean[]';
        if (t === 'double' || t === 'float') return 'double';
        if (t === 'double[]' || t === 'float[]') return 'double[]';
        if (t === 'long') return 'long';
        if (t === 'long[]') return 'long[]';
        if (t === 'character' || t === 'char') return 'char';
        if (t === 'character[]' || t === 'char[]') return 'char[]';
        if (t === 'character[][]' || t === 'char[][]') return 'char[][]';
        if (t === 'list<integer>' || t === 'list<int>') return 'list<integer>';
        if (t === 'list<string>') return 'list<string>';
        if (t === 'list<list<integer>>' || t === 'list<list<int>>') return 'list<list<integer>>';
        if (t === 'list<list<string>>') return 'list<list<string>>';
        if (t === 'list<boolean>') return 'list<boolean>';
        // Default
        return t;
    }

    /**
     * Parse the exampleTestcaseList values into testcase objects based on param types
     * Each example is a series of lines, one per parameter
     */
    private parseTestcases(
        exampleTestcaseList: string[],
        params: Array<{ name: string; type: string }>,
        examples: Array<{ input: string; output: string }>
    ): Testcase[] {
        const testcases: Testcase[] = [];

        for (let i = 0; i < exampleTestcaseList.length; i++) {
            const rawInput = exampleTestcaseList[i];
            const lines = rawInput.split('\n').filter(l => l.trim() !== '');

            const input: Record<string, unknown> = {};

            // Each line corresponds to a parameter
            for (let j = 0; j < params.length && j < lines.length; j++) {
                const param = params[j];
                const line = lines[j].trim();
                try {
                    input[param.name] = JSON.parse(line);
                } catch {
                    // If not valid JSON, treat as string
                    input[param.name] = line;
                }
            }

            // Parse expected output from examples
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
     * Main import function: fetch from LeetCode and convert to JustCode format
     */
    async importProblem(url: string): Promise<{
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }> {
        const titleSlug = this.extractSlug(url);

        // Fetch from LeetCode API
        const response = await this.fetchProblemData(titleSlug);
        const question = response.data.question;

        // Parse metaData for function name and parameter types
        let metaData: LeetCodeMetaData;
        try {
            metaData = JSON.parse(question.metaData);
        } catch {
            throw new Error('Failed to parse problem metadata from LeetCode');
        }

        // Parse content
        const { description, examples, constraints } = this.parseContent(question.content);

        // Map params
        const params = metaData.params.map(p => ({
            name: p.name,
            type: this.mapLeetCodeType(p.type),
        }));

        const returnType = this.mapLeetCodeType(metaData.return.type);

        // Determine supported languages and extract code snippets
        const supportedLanguages: Language[] = [];
        const templates: Record<string, string> = {};
        const functionSignatures: Record<string, string> = {};

        for (const snippet of question.codeSnippets) {
            if (snippet.langSlug === 'java') {
                supportedLanguages.push('java');
                templates['java'] = snippet.code;
                // Extract function signature from code snippet
                const sigMatch = snippet.code.match(/public\s+\S+\s+\w+\s*\([^)]*\)/);
                functionSignatures['java'] = sigMatch ? sigMatch[0] : '';
            } else if (snippet.langSlug === 'python3') {
                supportedLanguages.push('python3');
                templates['python3'] = snippet.code;
                const sigMatch = snippet.code.match(/def\s+\w+\s*\(self[^)]*\)\s*->[^:]+/);
                functionSignatures['python3'] = sigMatch ? sigMatch[0] : '';
            }
        }

        if (supportedLanguages.length === 0) {
            throw new Error('No supported languages (Java/Python3) found for this problem');
        }

        // Parse test cases
        const testcases = this.parseTestcases(
            question.exampleTestcaseList,
            metaData.params,
            examples
        );

        // Build metadata
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
