import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

type HtmlNode = DefaultTreeAdapterMap['node'];
type HtmlElement = DefaultTreeAdapterMap['element'];
type Marker = { kind: 'example' | 'constraints' | 'input' | 'output' | 'explanation'; node: HtmlElement; number?: number };

function isElement(node: HtmlNode): node is HtmlElement {
    return 'tagName' in node;
}

function children(node: HtmlNode): HtmlNode[] {
    return 'childNodes' in node ? node.childNodes : [];
}

function textContent(node: HtmlNode): string {
    return 'value' in node ? node.value : children(node).map(textContent).join('');
}

function markers(node: HtmlNode, result: Marker[] = []): Marker[] {
    if (isElement(node)) {
        if (['script', 'style', 'template', 'code'].includes(node.tagName)) return result;
        if (['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
            const text = textContent(node).trim();
            const example = /^Example\s+(\d+)\s*:\s*$/i.exec(text);
            const field = /^(Constraints|Input|Output|Explanation)\s*:\s*$/i.exec(text);
            if (example || field) {
                result.push({
                    kind: example ? 'example' : field![1].toLowerCase() as Marker['kind'],
                    node,
                    ...(example ? { number: Number(example[1]) } : {}),
                });
                return result;
            }
        }
    }
    for (const child of children(node)) markers(child, result);
    return result;
}

function start(marker: Marker): number { return marker.node.sourceCodeLocation!.startOffset; }
function end(marker: Marker): number { return marker.node.sourceCodeLocation!.endOffset; }

function safeUrl(value: string | undefined, sourceUrl: string): string | null {
    if (!value?.trim()) return null;
    try {
        const url = new URL(value, sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return url.href.replace(/[<>]/g, char => encodeURIComponent(char));
    } catch {
        return null;
    }
}

function escapeLabel(value: string): string {
    return value.replace(/([\\\[\]])/g, '\\$1').replace(/\s+/g, ' ');
}

function mathSuffix(value: string, symbol: string): string {
    const text = value.trim();
    return `${symbol}${/^[a-z0-9]+$/i.test(text) ? text : `(${text})`}`;
}

// Decode entities once through the HTML parser, while preserving the semantics of
// math, images, and links in every field. Executable example values use literal mode.
export function htmlToText(html: string, sourceUrl: string, markdown = false): string {
    function render(node: HtmlNode): string {
        if ('value' in node) return node.value;
        if (!isElement(node)) return children(node).map(render).join('');
        if (['script', 'style', 'template'].includes(node.tagName)) return '';
        const content = children(node).map(render).join('');
        const attr = (name: string) => node.attrs.find(item => item.name === name)?.value;
        switch (node.tagName) {
            case 'sup': return mathSuffix(content, '^');
            case 'sub': return mathSuffix(content, '_');
            case 'br': return '\n';
            case 'img': {
                const alt = attr('alt') || 'Image';
                const url = safeUrl(attr('src'), sourceUrl);
                return url ? `![${escapeLabel(alt)}](<${url}>)` : `[Image unavailable: ${escapeLabel(alt)}]`;
            }
            case 'a': {
                const url = safeUrl(attr('href'), sourceUrl);
                return url ? `[${escapeLabel(content || url)}](<${url}>)` : `${content} (link omitted: unsupported URL)`;
            }
            case 'code': return markdown ? `\`${content}\`` : content;
            case 'strong': case 'b': return markdown ? `**${content}**` : content;
            case 'em': case 'i': return markdown ? `*${content}*` : content;
            case 'li': return markdown ? `- ${content.trim()}\n` : `${content}\n`;
            case 'p': case 'div': case 'pre': case 'ul': case 'ol': case 'figure': case 'figcaption':
                return `\n${content}\n`;
            default: return content;
        }
    }
    return render(parseFragment(html)).replace(/\n{3,}/g, '\n\n').trim();
}

function fieldEnd(marker: Marker, boundary: number): number {
    // A value ends with its containing pre/paragraph even when unrelated prose
    // follows the example. Do not let that prose become part of the expected answer.
    let parent = marker.node.parentNode;
    while (parent && isElement(parent)) {
        if (['pre', 'p'].includes(parent.tagName)) {
            const location = parent.sourceCodeLocation;
            return Math.min(boundary, location?.endTag?.startOffset ?? location?.endOffset ?? boundary);
        }
        parent = parent.parentNode;
    }
    return boundary;
}

export function parseLeetCodeContent(html: string, sourceUrl: string): {
    description: string;
    examples: Array<{ input: string; output: string; explanation?: string }>;
    constraints: string[];
} {
    const document = parseFragment(html, { sourceCodeLocationInfo: true });
    const allMarkers = markers(document);
    const headings = allMarkers.filter(marker => marker.kind === 'example' || marker.kind === 'constraints');
    const firstHeading = headings[0];
    const description = htmlToText(html.slice(0, firstHeading ? start(firstHeading) : html.length), sourceUrl, true);
    const examples: Array<{ input: string; output: string; explanation?: string }> = [];
    const constraints: string[] = [];

    for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        const boundary = headings[index + 1] ? start(headings[index + 1]) : html.length;
        if (heading.kind === 'constraints') {
            const fragment = parseFragment(html.slice(end(heading), boundary));
            const findList = (node: HtmlNode): HtmlElement | undefined => {
                if (isElement(node) && ['ul', 'ol'].includes(node.tagName)) return node;
                for (const child of children(node)) {
                    const found = findList(child);
                    if (found) return found;
                }
                return undefined;
            };
            const list = findList(fragment);
            if (list) for (const node of list.childNodes) {
                if (isElement(node) && node.tagName === 'li') {
                    // The same rendering rules apply to constraint nodes, including sup/sub.
                    const renderNode = (item: HtmlNode): string => {
                        if ('value' in item) return item.value;
                        const content = children(item).map(renderNode).join('');
                        if (!isElement(item)) return content;
                        if (item.tagName === 'sup') return mathSuffix(content, '^');
                        if (item.tagName === 'sub') return mathSuffix(content, '_');
                        if (item.tagName === 'br') return ' ';
                        return content;
                    };
                    const constraint = renderNode(node).replace(/\s+/g, ' ').trim();
                    if (constraint) constraints.push(constraint);
                }
            }
            continue;
        }
        const fields = allMarkers.filter(marker => start(marker) >= end(heading) && start(marker) < boundary &&
            !['example', 'constraints'].includes(marker.kind));
        if (fields.length < 2 || fields.length > 3 || fields[0].kind !== 'input' || fields[1].kind !== 'output' ||
            (fields[2] && fields[2].kind !== 'explanation')) {
            throw new Error(`Example ${heading.number} has ambiguous Input/Output/Explanation labels; import was not saved`);
        }
        const input = htmlToText(html.slice(end(fields[0]), fieldEnd(fields[0], start(fields[1]))), sourceUrl);
        const output = htmlToText(html.slice(end(fields[1]), fieldEnd(fields[1], fields[2] ? start(fields[2]) : boundary)), sourceUrl);
        if (!output) throw new Error(`Example ${heading.number} has an incomplete input or expected output`);
        const explanation = fields[2]
            ? htmlToText(html.slice(end(fields[2]), boundary), sourceUrl, true) : undefined;
        examples.push({ input, output, ...(explanation ? { explanation } : {}) });
    }
    return { description, examples, constraints };
}
