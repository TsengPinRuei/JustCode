import { ProblemMetadata, Testcase, Language } from '../types';
import { isIdentifier, isRecord } from './problemValidation';
import { invalidInput } from './storage';

// JustCode 匯入的 LeetCode GraphQL 回應子集合形狀。
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

// Signature regex 只供顯示/參考；執行時改用 LeetCode metaData。
const JAVA_SIGNATURE_REGEX = /public\s+\S+\s+\w+\s*\([^)]*\)/;
const PYTHON_SIGNATURE_REGEX = /def\s+\w+\s*\(self[^)]*\)\s*->[^:]+/;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
// 將 LeetCode 型別標籤正規化為產生的 runner 支援的較窄集合。
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
     * 從 LeetCode URL 擷取 titleSlug。
     * 支援：https://leetcode.com/problems/two-sum/
     *           https://leetcode.com/problems/two-sum/description/
     *           https://leetcode.com/problems/two-sum
     */
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

    /**
     * 從 LeetCode GraphQL API 取得公開題目資料。
     * 只匯入可見 metadata/examples，不匯入 LeetCode hidden judge cases。
     */
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

        // 限制解壓後的 response 大小；只檢查 Content-Length 無法涵蓋壓縮或串流回應。
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

    /**
     * 將 LeetCode HTML content 解析成近似 Markdown 的 description、examples 與 constraints。
     * 這些 regex 刻意針對常見 LeetCode markup；若其 DOM 改變，可能需要更新。
     */
    private parseContent(html: string): {
        description: string;
        examples: Array<{ input: string; output: string; explanation?: string }>;
        constraints: string[];
    } {
        // 分別累積文字欄位，避免局部解析失敗導致整個匯入中斷。
        let description = '';
        const examples: Array<{ input: string; output: string; explanation?: string }> = [];
        const constraints: string[] = [];

        // 必須先移除 tags 再解碼 entities；否則 a &lt; b &gt; c 會被誤認成 HTML。
        // 若存在 "Example 1" marker，description 取其之前的所有內容。
        const exampleStart = html.search(/<strong[^>]*>Example\s*1/i);
        if (exampleStart !== -1) {
            description = this.stripHtml(html.substring(0, exampleStart)).trim();
        } else {
            description = this.stripHtml(html).trim();
        }

        // 範例從渲染後的題目敘述解析；原始測試案例 input 則來自 exampleTestcaseList。
        const exampleRegex = /<strong[^>]*>Example\s*(\d+)[^<]*<\/strong>([\s\S]*?)(?=<strong[^>]*>Example\s*\d|<strong[^>]*>Constraints|<p><strong[^>]*>Constraints|$)/gi;
        let exMatch;
        while ((exMatch = exampleRegex.exec(html)) !== null) {
            const exContent = exMatch[2];

            // 輸入/輸出在此保留為顯示用字串；parseTestcases 稍後轉成機器值。
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

        // Constraints 通常位於最後一個 Constraints 標題後方的列表。
        const constraintSection = html.match(/<strong[^>]*>Constraints[^<]*<\/strong>([\s\S]*?)$/i);
        if (constraintSection) {
            const constraintHtml = constraintSection[1];
            // 將每個 bullet 保持為單一精簡字串，供 UI 渲染。
            const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
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
     * 移除 HTML tags，同時保留足夠的類 Markdown 格式供 description 使用。
     */
    private stripHtml(html: string): string {
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

    /**
     * 從 examples/constraints 移除所有 HTML tags，避免 Markdown marker 造成雜訊。
     */
    private stripAllHtml(html: string): string {
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

    /**
     * 將 LeetCode type string 映射到 code executor 可理解的內部標籤。
     * 不支援的複雜結構會原樣回傳，執行前需要 executor 支援。
     */
    private mapLeetCodeType(lcType: string): string {
        const t = lcType.trim();
        return LEETCODE_TYPE_MAP[t] ?? t;
    }

    /**
     * 將 exampleTestcaseList value 解析成 testcase object。
     * 每個 example input 都是依 metadata 順序排列、以換行分隔的參數值。
     */
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

            // 每一行對應一個參數；JSON.parse 負責處理 arrays/numbers/booleans。
            for (let j = 0; j < params.length; j++) {
                const param = params[j];
                const line = lines[j];
                try {
                    input[param.name] = JSON.parse(line);
                } catch {
                    // LeetCode 範例中的裸字串不是合法 JSON，因此保留為文字。
                    if (!['string', 'char', 'character'].includes(param.type)) {
                        throw new Error(`Example ${i + 1} contains an invalid value for ${param.name}`);
                    }
                    input[param.name] = line;
                }
            }

            // 僅字串回傳值容許非 JSON 文字；數值或集合解析失敗時拒絕產生錯誤 testcase。
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

    /**
     * 主要匯入函式：從 LeetCode 取得資料，並轉成 JustCode 的檔案式格式。
     */
    async importProblem(url: string): Promise<{
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }> {
        const titleSlug = this.extractSlug(url);

        // 轉成本機題目檔案前，先取得公開題目敘述 metadata。
        const response = await this.fetchProblemData(titleSlug);
        const question = response.data.question;

        // metaData 提供 runner 產生流程使用的標準函式名稱、params 與 return type。
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

        // 從 LeetCode HTML content 解析人類可讀的題目敘述區段。
        const { description, examples, constraints } = this.parseContent(question.content);

        // 儲存 executor 使用的 metadata 前，先正規化參數型別。
        const params = metaData.params.map(p => ({
            name: p.name,
            type: this.mapLeetCodeType(p.type),
        }));

        const returnType = this.mapLeetCodeType(metaData.return.type);

        // 只保存此專案已有 executor 支援的語言。
        const supportedLanguages: Language[] = [];
        const templates: Record<string, string> = {};
        const functionSignatures: Record<string, string> = {};

        for (const snippet of question.codeSnippets) {
            if (Object.prototype.hasOwnProperty.call(templates, snippet.langSlug)) continue;
            if (snippet.langSlug === 'java') {
                supportedLanguages.push('java');
                templates['java'] = snippet.code;
                // 保留顯示用 signature 供 UI/參考；執行時改用 metadata。
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

        // LeetCode 只公開範例測試案例；隱藏案例需稍後手動加入。
        const testcases = this.parseTestcases(
            question.exampleTestcaseList,
            params,
            examples,
            returnType
        );

        // 建立保存到 problem.json 的標準題目 metadata。
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
