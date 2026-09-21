import { visit } from 'unist-util-visit';
import type { Parent, Root, RootContent } from 'mdast';

interface CodeGroup extends Parent {
    type: 'codeGroup';
    children: [];
    data: {
        hName: string;
        hProperties: { languages: string };
    };
}

declare module 'mdast' {
    interface RootContentMap {
        codeGroup: CodeGroup;
    }
    interface BlockContentMap {
        codeGroup: CodeGroup;
    }
}

/** Group adjacent fenced blocks with distinct language labels into editor tabs. */
export default function remarkCodeGroup() {
    return (tree: Root) => {
        visit(tree, node => {
            if (!('children' in node)) return;
            const parent = node as Parent;
            const children = parent.children;
            let replacement: RootContent[] | undefined;
            let index = 0;

            while (index < children.length) {
                const child = children[index];
                if (child.type !== 'code' || !child.lang) {
                    replacement?.push(child);
                    index += 1;
                    continue;
                }

                const start = index;
                const group: { lang: string; value: string }[] = [];
                const languages = new Set<string>();
                while (index < children.length) {
                    const current = children[index];
                    if (current.type !== 'code' || !current.lang || languages.has(current.lang)) break;
                    group.push({ lang: current.lang, value: current.value });
                    languages.add(current.lang);
                    index += 1;
                }

                if (group.length > 1) {
                    replacement ??= children.slice(0, start);
                    replacement.push({
                        type: 'codeGroup',
                        data: {
                            hName: 'code-group',
                            hProperties: { languages: JSON.stringify(group) },
                        },
                        children: [],
                    });
                } else {
                    // Keep the original node, including meta, position, and
                    // plugin data that would be lost by reconstructing it.
                    replacement?.push(child);
                }
            }

            // Most Markdown parents contain no groups; leave their arrays intact.
            if (replacement) parent.children = replacement;
        });
    };
}
