import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCodeGroup from '../plugins/remarkCodeGroup';
import { Problem } from '../types';

interface ProblemDescriptionProps {
    problem: Problem;
}

/* ---- Tabbed code-group renderer ---- */

const LANG_LABELS: Record<string, string> = {
    java: 'Java',
    python: 'Python',
    py: 'Python',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    cpp: 'C++',
    c: 'C',
};

function CodeGroupBlock({ languages }: { languages: string }) {
    const items: { lang: string; value: string }[] = JSON.parse(languages);
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
            <pre className="code-group-pre">
                <code>{items[active].value}</code>
            </pre>
        </div>
    );
}

/* ---- Custom components map for ReactMarkdown ---- */

const markdownComponents: Record<string, React.FC<any>> = {
    'code-group': ({ node, ...props }: any) => {
        const langs = props.languages ?? node?.properties?.languages;
        if (!langs) return null;
        return <CodeGroupBlock languages={langs} />;
    },
};

/* ---- Main component ---- */

const ProblemDescription: React.FC<ProblemDescriptionProps> = ({ problem }) => {
    const [activeTab, setActiveTab] = useState<'description' | 'editorial'>('description');

    return (
        <>
            <div className="problem-header">
                <div className="problem-title-row">
                    <h1 className="problem-title-text">{problem.metadata.title}</h1>
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.metadata.description}</ReactMarkdown>

                        <h3>Examples</h3>
                        {problem.metadata.examples.map((example, index) => (
                            <div key={index} className="example-container">
                                <p><strong>Example {index + 1}:</strong></p>
                                <div className="example-io">
                                    <div className="example-section">
                                        <strong>Input:</strong>
                                        <div className="example-content">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{example.input}</ReactMarkdown>
                                        </div>
                                    </div>
                                    <div className="example-section">
                                        <strong>Output:</strong>
                                        <div className="example-content">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{example.output}</ReactMarkdown>
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
                                remarkPlugins={[remarkGfm, remarkCodeGroup]}
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
