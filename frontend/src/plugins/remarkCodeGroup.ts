import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

/**
 * Remark plugin that groups consecutive fenced code blocks (with different
 * language tags) into a single `codeGroup` node.  The React renderer can
 * then display these as a tabbed component.
 *
 * Example input AST:
 *   code(lang=java)  →  codeGroup { data: { languages: [{lang:'java', value:'…'}, {lang:'python', value:'…'}] } }
 *   code(lang=python)
 *
 * Lone code blocks are left untouched.
 */
export default function remarkCodeGroup() {
    return (tree: Root) => {
        // Grouping requires parent-level access because consecutive code blocks are sibling nodes.
        visit(tree, (node: any) => {
            if (!node.children || !Array.isArray(node.children)) return;

            const children = node.children as any[];
            const newChildren: any[] = [];
            let i = 0;

            while (i < children.length) {
                const child = children[i];

                // Only fenced code blocks with language tags can become tab labels.
                if (child.type === 'code' && child.lang) {
                    // Collect adjacent languages until a duplicate language or non-code node appears.
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
                        // Use hName/hProperties so ReactMarkdown can render a custom <code-group> element.
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
                        // Single code blocks should keep normal markdown rendering and copy behavior.
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
