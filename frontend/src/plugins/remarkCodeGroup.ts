import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

/**
 * Remark plugin：將連續且語言標籤不同的 fenced code block
 * 群組成單一 `codeGroup` node，讓 React renderer 可顯示為分頁元件。
 *
 * 輸入 AST 範例：
 *   code(lang=java)  →  codeGroup { data: { languages: [{lang:'java', value:'…'}, {lang:'python', value:'…'}] } }
 *   code(lang=python)
 *
 * 單獨的 code block 會維持原樣。
 */
export default function remarkCodeGroup() {
    return (tree: Root) => {
        // 連續 code block 是 sibling node，因此分組需要 parent-level 存取。
        visit(tree, (node: any) => {
            if (!node.children || !Array.isArray(node.children)) return;

            const children = node.children as any[];
            const newChildren: any[] = [];
            let i = 0;

            while (i < children.length) {
                const child = children[i];

                // 只有帶語言標籤的 fenced code block 可成為分頁標籤。
                if (child.type === 'code' && child.lang) {
                    // 收集相鄰語言，直到遇到重複語言或非 code node。
                    const group: { lang: string; value: string }[] = [];
                    const seenLangs = new Set<string>();

                    while (i < children.length) {
                        const curr = children[i];
                        if (curr.type === 'code' && curr.lang && !seenLangs.has(curr.lang)) {
                            group.push({ lang: curr.lang, value: curr.value });
                            seenLangs.add(curr.lang);
                            i++;
                        } else {
                            break;
                        }
                    }

                    if (group.length > 1) {
                        // 使用 hName/hProperties，讓 ReactMarkdown 可渲染自訂 <code-group> 元素。
                        newChildren.push({
                            type: 'codeGroup',
                            data: {
                                hName: 'code-group',
                                hProperties: {
                                    languages: JSON.stringify(group),
                                },
                            },
                            children: [],
                        });
                    } else {
                        // 單一 code block 應保留一般 Markdown 渲染與複製行為。
                        newChildren.push({
                            type: 'code',
                            lang: group[0].lang,
                            value: group[0].value,
                        });
                    }
                } else {
                    newChildren.push(child);
                    i++;
                }
            }

            node.children = newChildren;
        });
    };
}
