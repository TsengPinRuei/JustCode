/**
 * Problem Description \u2014 Renders problem description and editorial tabs.
 * Uses ReactMarkdown with custom renderers for tabbed code groups
 * and copy-to-clipboard buttons on code blocks. Also builds the downloadable
 * problem brief used when generating local hidden testcase JSON.
 */
import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCodeGroup from '../plugins/remarkCodeGroup';
import { Problem, ProblemProgress } from '../types';
import HiddenTestcaseModal from './HiddenTestcaseModal';
import SolveStatsPanel from './SolveStatsPanel';

interface ProblemDescriptionProps {
    problem: Problem;
    progress: ProblemProgress | null;
    currentElapsedMs: number;
}

/* ---- Tabbed code-group renderer ---- */

const LANG_LABELS: Record<string, string> = {
    java: 'Java',
    python: 'Python3',
    py: 'Python3',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    cpp: 'C++',
    c: 'C',
};

const DESCRIPTION_REMARK_PLUGINS = [remarkGfm];
// Editorials may contain adjacent language-specific code blocks that should become tabs.
const EDITORIAL_REMARK_PLUGINS = [remarkGfm, remarkCodeGroup];

const extractText = (node: React.ReactNode): string => {
    // ReactMarkdown may pass nested elements to <pre>; flatten them so copy works for all code blocks.
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return extractText(node.props.children);
    }
    return '';
};

const copyTextToClipboard = async (text: string) => {
    // Prefer the modern async clipboard API, then fall back for browsers/contexts where it is unavailable.
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // Fall through to the textarea fallback below.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Keep the fallback textarea off-screen so copying does not shift or flash the layout.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const copied = document.execCommand('copy');
        if (!copied) throw new Error('Copy command failed');
    } finally {
        document.body.removeChild(textarea);
    }
};

function CopyButton({ getText }: { getText: () => string }) {
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

    const handleCopy = useCallback(async () => {
        try {
            await copyTextToClipboard(getText());
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 2000);
        } catch {
            setCopyState('failed');
            setTimeout(() => setCopyState('idle'), 2000);
        }
    }, [getText]);

    const label = copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy';

    return (
        <button
            type="button"
            className={`code-copy-btn ${copyState}`}
            onClick={handleCopy}
            title={copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
            aria-label={copyState === 'copied' ? 'Copied code' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
        >
            {copyState === 'copied' && (
                <span className="code-copy-icon" aria-hidden="true">✓</span>
            )}
            <span>{label}</span>
        </button>
    );
}

function CodeGroupBlock({ languages }: { languages: string }) {
    // remarkCodeGroup serializes grouped code blocks into this prop for the custom renderer.
    const items = useMemo(
        () => JSON.parse(languages) as { lang: string; value: string }[],
        [languages]
    );
    const [active, setActive] = useState(0);

    return (
        <div className="code-group">
            <div className="code-group-tabs">
                {items.map((item, idx) => (
                    <button
                        key={item.lang}
                        className={`code-group-tab ${idx === active ? 'active' : ''}`}
                        onClick={() => setActive(idx)}
                    >
                        {LANG_LABELS[item.lang] ?? item.lang}
                    </button>
                ))}
            </div>
            <div className="code-block-wrapper">
                <CopyButton getText={() => items[active].value} />
                <pre className="code-group-pre">
                    <code>{items[active].value}</code>
                </pre>
            </div>
        </div>
    );
}

/* ---- Custom components map for ReactMarkdown ---- */

const markdownComponents: Record<string, React.FC<any>> = {
    'code-group': (props: any) => {
        // ReactMarkdown exposes hProperties differently across versions; support both paths.
        const langs = props.languages ?? props.node?.properties?.languages;
        if (!langs) return null;
        return <CodeGroupBlock languages={langs} />;
    },
    pre: (props: any) => {
        const getText = () => extractText(props.children);
        return (
            <div className="code-block-wrapper">
                <CopyButton getText={getText} />
                <pre {...props} />
            </div>
        );
    },
};

const formatExampleBlock = (problem: Problem): string => {
    // The downloaded brief needs fenced text blocks so generated examples are readable but not executable code.
    return problem.metadata.examples.map((example, index) => {
        const explanation = example.explanation ? `\nExplanation:\n${example.explanation}\n` : '';
        return [
            `### Example ${index + 1}`,
            'Input:',
            '```text',
            example.input,
            '```',
            'Output:',
            '```text',
            example.output,
            '```',
            explanation.trimEnd(),
        ].filter(Boolean).join('\n');
    }).join('\n\n');
};

const buildHiddenTestcaseSample = (problem: Problem) => {
    // Prefer a visible testcase as the schema example because it already matches runner parameter names.
    const firstVisibleTestcase = problem.visibleTestcases[0];
    if (firstVisibleTestcase) {
        return [
            {
                input: firstVisibleTestcase.input,
                output: firstVisibleTestcase.output,
            },
        ];
    }

    const input = Object.fromEntries(
        (problem.metadata.params ?? []).map((param) => [param.name, `value matching ${param.type}`])
    );
    return [
        {
            input,
            output: 'expected output',
        },
    ];
};

const buildDescriptionDownload = (problem: Problem): string => {
    // This file is a prompt/brief for generating hidden tests; keep its JSON contract aligned with backend validation.
    const params = problem.metadata.params && problem.metadata.params.length > 0
        ? problem.metadata.params.map((param) => `- \`${param.name}\`: \`${param.type}\``).join('\n')
        : '- No parameter metadata available.';
    const constraints = problem.metadata.constraints.length > 0
        ? problem.metadata.constraints.map((constraint) => `- ${constraint}`).join('\n')
        : '- No constraints provided.';
    const sampleJson = JSON.stringify(buildHiddenTestcaseSample(problem), null, 2);

    return [
        `# ${problem.metadata.title}`,
        '',
        '## Task',
        'Generate hidden testcases for this JustCode problem. Return only valid JSON using the exact format below.',
        '',
        '## Description',
        problem.metadata.description,
        '',
        '## Function',
        `- Name: \`${problem.metadata.functionName ?? 'unknown'}\``,
        `- Return Type: \`${problem.metadata.returnType ?? 'unknown'}\``,
        '',
        '## Params',
        params,
        '',
        '## Examples',
        formatExampleBlock(problem) || 'No examples provided.',
        '',
        '## Constraints',
        constraints,
        '',
        '## Required Hidden Testcase JSON Format',
        'Return a JSON array. Each item must include `input` and `output`. The `input` keys must exactly match the Params above.',
        '',
        '```json',
        sampleJson,
        '```',
        '',
        'Do not include Markdown, explanation, comments, trailing commas, or any text outside the JSON array.',
    ].join('\n');
};

const downloadTextFile = (filename: string, content: string) => {
    // Object URLs are short-lived; revoke after the synthetic click to avoid leaking browser memory.
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/* ---- Main component ---- */

const ProblemDescription: React.FC<ProblemDescriptionProps> = ({ problem, progress, currentElapsedMs }) => {
    const [activeTab, setActiveTab] = useState<'description' | 'editorial'>('description');
    const [showHiddenTestModal, setShowHiddenTestModal] = useState(false);

    const handleDownloadDescription = () => {
        // Sanitize the problem ID before using it as a local download filename.
        const safeId = problem.metadata.id.replace(/[^a-z0-9-_]+/gi, '-');
        downloadTextFile(`${safeId}-description.md`, buildDescriptionDownload(problem));
    };

    return (
        <>
            <div className="problem-header">
                <div className="problem-title-row">
                    <h1 className="problem-title-text">{problem.metadata.title}</h1>
                    <div className="problem-header-actions">
                        <button
                            type="button"
                            className="problem-header-action-btn"
                            onClick={handleDownloadDescription}
                        >
                            Download Description
                        </button>
                        <button
                            type="button"
                            className="problem-header-action-btn primary"
                            onClick={() => setShowHiddenTestModal(true)}
                        >
                            Add Hidden Tests
                        </button>
                    </div>
                </div>
                <div className="problem-meta">
                    <span className={`difficulty-badge difficulty-${problem.metadata.difficulty.toLowerCase()}`}>
                        {problem.metadata.difficulty}
                    </span>
                    {problem.metadata.tags.slice(0, 4).map((tag, index) => (
                        <span key={index} className="tag">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <SolveStatsPanel progress={progress} currentElapsedMs={currentElapsedMs} />

            <div className="tabs" data-active-tab={activeTab}>
                <button
                    className={`tab ${activeTab === 'description' ? 'active' : ''}`}
                    onClick={() => setActiveTab('description')}
                >
                    Description
                </button>
                <button
                    className={`tab ${activeTab === 'editorial' ? 'active' : ''}`}
                    onClick={() => setActiveTab('editorial')}
                >
                    Editorial
                </button>
            </div>

            <div className="problem-content">
                {activeTab === 'description' ? (
                    <div className="problem-description">
                        <ReactMarkdown remarkPlugins={DESCRIPTION_REMARK_PLUGINS}>{problem.metadata.description}</ReactMarkdown>

                        <h3>Examples</h3>
                        {problem.metadata.examples.map((example, index) => (
                            <div key={index} className="example-container">
                                <p><strong>Example {index + 1}:</strong></p>
                                <div className="example-io">
                                    <div className="example-section">
                                        <strong>Input:</strong>
                                        <div className="example-content">
                                            <ReactMarkdown remarkPlugins={DESCRIPTION_REMARK_PLUGINS}>{example.input}</ReactMarkdown>
                                        </div>
                                    </div>
                                    <div className="example-section">
                                        <strong>Output:</strong>
                                        <div className="example-content">
                                            <ReactMarkdown remarkPlugins={DESCRIPTION_REMARK_PLUGINS}>{example.output}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                                {example.explanation && <p><em>Explanation: {example.explanation}</em></p>}
                            </div>
                        ))}

                        <h3>Constraints</h3>
                        <ul>
                            {problem.metadata.constraints.map((constraint, index) => (
                                <li key={index}><code>{constraint}</code></li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="problem-description">
                        {problem.editorial ? (
                            <ReactMarkdown
                                remarkPlugins={EDITORIAL_REMARK_PLUGINS}
                                components={markdownComponents}
                            >
                                {problem.editorial}
                            </ReactMarkdown>
                        ) : (
                            <p className="editorial-placeholder">
                                Editorial coming soon...
                            </p>
                        )}
                    </div>
                )}
            </div>

            {showHiddenTestModal && (
                <HiddenTestcaseModal
                    problem={problem}
                    onClose={() => setShowHiddenTestModal(false)}
                />
            )}
        </>
    );
};

export default ProblemDescription;
