import { stringifyJson } from '../../../backend/src/shared/json';
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCodeGroup from '../plugins/remarkCodeGroup';
import { Problem, ProblemProgress } from '../types';
import SolveStatsPanel from './SolveStatsPanel';

interface ProblemDescriptionProps {
    problem: Problem;
    progress: ProblemProgress | null;
    attemptStartedAt: number;
}

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
// Group adjacent language-specific editorial code blocks into tabs.
const EDITORIAL_REMARK_PLUGINS = [remarkGfm, remarkCodeGroup];

const extractText = (node: React.ReactNode): string => {
    // ReactMarkdown may nest elements inside pre; flatten them to recover copyable text.
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return extractText(node.props.children);
    }
    return '';
};

function CodeGroupBlock({ languages }: { languages: string }) {
    // remarkCodeGroup passes grouped language labels and source text as serialized JSON.
    const items = useMemo(
        () => JSON.parse(languages) as { lang: string; value: string }[],
        [languages]
    );
    const [active, setActive] = useState(0);
    const activeIndex = Math.min(active, items.length - 1);
    const activeItem = items[activeIndex];
    if (!activeItem) return null;

    return (
        <div className="code-group">
            <div className="code-group-tabs">
                {items.map((item, idx) => (
                    <button
                        key={item.lang}
                        className={`code-group-tab ${idx === activeIndex ? 'active' : ''}`}
                        aria-pressed={idx === activeIndex}
                        onClick={() => setActive(idx)}
                    >
                        {LANG_LABELS[item.lang] ?? item.lang}
                    </button>
                ))}
            </div>
            <div className="code-block-wrapper">
                <CopyButton getText={() => activeItem.value} />
                <pre className="code-group-pre">
                    <code>{activeItem.value}</code>
                </pre>
            </div>
        </div>
    );
}

const markdownComponents: Components & {
    'code-group': React.FC<ExtraProps & { languages?: string }>;
} = {
    'code-group': ({ languages, node }) => {
        const serialized = languages ?? node?.properties?.languages;
        return typeof serialized === 'string' ? <CodeGroupBlock languages={serialized} /> : null;
    },
    pre: ({ node: _node, children, ...props }) => (
        <div className="code-block-wrapper">
            <CopyButton getText={() => extractText(children)} />
            <pre {...props}>{children}</pre>
        </div>
    ),
};

const formatExampleBlock = (problem: Problem): string => {
    // Keep example values in text fences so Markdown punctuation is displayed literally.
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
    // Use a validated visible testcase as the sample so its input keys match the runner parameters.
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

// Keep this downloaded test-generation brief consistent with the backend's JSON request shape.
const buildDescriptionDownload = (problem: Problem): string => {
    const params = problem.metadata.params && problem.metadata.params.length > 0
        ? problem.metadata.params.map((param) => `- \`${param.name}\`: \`${param.type}\``).join('\n')
        : '- No parameter metadata available.';
    const constraints = problem.metadata.constraints.length > 0
        ? problem.metadata.constraints.map((constraint) => `- ${constraint}`).join('\n')
        : '- No constraints provided.';
    const sampleJson = stringifyJson(buildHiddenTestcaseSample(problem), 2);

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
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Let the browser start the download before releasing its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const ProblemDescription: React.FC<ProblemDescriptionProps> = ({ problem, progress, attemptStartedAt }) => {
    const [activeTab, setActiveTab] = useState<'description' | 'editorial'>('description');

    const handleDownloadDescription = () => {
        // Remove characters that should not become part of the downloaded filename.
        const safeId = problem.metadata.id.replace(/[^a-z0-9-_]+/gi, '-');
        downloadTextFile(`${safeId}-description.md`, buildDescriptionDownload(problem));
    };

    return (
        <>
            <div className="problem-header">
                <div className="problem-title-row">
                    <h1 className="problem-title-text">{problem.metadata.title}</h1>
                    <button
                        type="button"
                        className="problem-icon-action"
                        aria-label="Download Description"
                        title="Download Description"
                        onClick={handleDownloadDescription}
                    >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
                        </svg>
                    </button>
                    <Link
                        className="problem-icon-action"
                        to={`/activity?problemId=${encodeURIComponent(problem.metadata.id)}`}
                        aria-label="Submission history"
                        title="Submission history"
                    >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M3 4v5h5M3.7 9a8.5 8.5 0 1 1-.2 6M12 7v5l3.5 2" />
                        </svg>
                    </Link>
                </div>
                <span className={`difficulty-badge difficulty-${problem.metadata.difficulty.toLowerCase()}`}>
                    {problem.metadata.difficulty}
                </span>
                {problem.metadata.tags.length > 0 && (
                    <details className="problem-topic-disclosure" key={problem.metadata.id}>
                        <summary>Tags</summary>
                        <ul className="problem-topic-list" aria-label="Problem tags">
                            {problem.metadata.tags.map((tag, index) => (
                                <li key={index} className="tag">{tag}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>

            <SolveStatsPanel progress={progress} attemptStartedAt={attemptStartedAt} />

            <div className="tabs" data-active-tab={activeTab}>
                <button
                    className={`tab ${activeTab === 'description' ? 'active' : ''}`}
                    aria-pressed={activeTab === 'description'}
                    onClick={() => setActiveTab('description')}
                >
                    Description
                </button>
                <button
                    className={`tab ${activeTab === 'editorial' ? 'active' : ''}`}
                    aria-pressed={activeTab === 'editorial'}
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
                                {/* Inputs and outputs are literal data, not Markdown. */}
                                <div className="example-io">
                                    <div className="example-section">
                                        <strong>Input:</strong>
                                        <div className="example-content">
                                            {example.input}
                                        </div>
                                    </div>
                                    <div className="example-section">
                                        <strong>Output:</strong>
                                        <div className="example-content">
                                            {example.output}
                                        </div>
                                    </div>
                                </div>
                                {example.explanation && (
                                    <div className="example-explanation">
                                        <strong>Explanation:</strong>
                                        <ReactMarkdown remarkPlugins={DESCRIPTION_REMARK_PLUGINS}>{example.explanation}</ReactMarkdown>
                                    </div>
                                )}
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
        </>
    );
};

export default ProblemDescription;
