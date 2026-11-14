import { useState, useEffect, useMemo, type FC } from 'react';
import Editor from '@monaco-editor/react';
import type * as MonacoApi from 'monaco-editor/editor';
import '../services/monacoSetup';
import type { editor } from 'monaco-editor';
import { Language, CompilationError } from '../types';

interface CodeEditorProps {
    problemId: string;
    code: string;
    onChange: (value: string) => void;
    onReset: () => void;
    compilationErrors?: CompilationError[];
    selectedLanguage: Language;
    supportedLanguages: Language[];
    onLanguageChange: (language: Language) => void;
}

const LANGUAGE_LABELS: Record<Language, string> = {
    java: 'Java',
    python3: 'Python3',
};

// Update diagnostic markers when the page supplies a new Run or Submit result.
const CodeEditor: FC<CodeEditorProps> = ({
    problemId,
    code,
    onChange,
    onReset,
    compilationErrors,
    selectedLanguage,
    supportedLanguages,
    onLanguageChange
}) => {
    const [instance, setInstance] = useState<{ editor: editor.IStandaloneCodeEditor; monaco: typeof MonacoApi } | null>(null);
    const [fontSize, setFontSize] = useState(14);
    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 24;

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) onChange(value);
    };

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 2, MAX_FONT_SIZE));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 2, MIN_FONT_SIZE));
    };

    const modelPath = `justcode:///${encodeURIComponent(problemId)}/${selectedLanguage === 'java' ? 'Solution.java' : 'solution.py'}`;

    useEffect(() => {
        if (!instance) return;
        const { editor: mountedEditor, monaco } = instance;
        const updateMarkers = () => {
            const model = mountedEditor.getModel();
            if (!model) return;
            const sourceFile = selectedLanguage === 'java' ? 'Solution.java' : 'solution.py';
            const markers = (compilationErrors ?? []).filter(error =>
                error.file.replace(/\\/g, '/').split('/').pop() === sourceFile
                && error.line >= 1 && error.line <= model.getLineCount()
            ).map(error => {
                const maxColumn = model.getLineMaxColumn(error.line);
                return {
                    severity: error.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
                    message: error.message,
                    startLineNumber: error.line,
                    startColumn: Math.max(1, Math.min(maxColumn, error.column)),
                    endLineNumber: error.line,
                    endColumn: maxColumn,
                };
            });
            monaco.editor.setModelMarkers(model, 'compilation', markers);
        };
        updateMarkers();
        const listener = mountedEditor.onDidChangeModel(updateMarkers);
        return () => {
            listener.dispose();
            const model = mountedEditor.getModel();
            if (model && !model.isDisposed()) monaco.editor.setModelMarkers(model, 'compilation', []);
        };
    }, [instance, compilationErrors, selectedLanguage]);

    useEffect(() => {
        if (!instance) return;
        // Keep models while switching languages, then release this problem's models on navigation.
        return () => {
            for (const language of ['java', 'python3'] as const) {
                const path = `justcode:///${encodeURIComponent(problemId)}/${language === 'java' ? 'Solution.java' : 'solution.py'}`;
                instance.monaco.editor.getModel(instance.monaco.Uri.parse(path))?.dispose();
            }
        };
    }, [instance, problemId]);

    const editorLanguage = selectedLanguage === 'java' ? 'java' : 'python';
    // Keep editor options stable between renders unless the font size changes.
    const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
        fontSize,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: {
            enabled: true,
        },
        formatOnPaste: false,
        formatOnType: false,
    }), [fontSize]);

    return (
        <>
            <div className="editor-toolbar">
                <div className="editor-toolbar-left">
                    <label htmlFor="language-select" className="editor-language-label">Language</label>
                    <select
                        id="language-select"
                        value={selectedLanguage}
                        onChange={(e) => onLanguageChange(e.target.value as Language)}
                        className="language-selector"
                    >
                        {supportedLanguages.map(lang => (
                            <option key={lang} value={lang}>
                                {LANGUAGE_LABELS[lang]}
                            </option>
                        ))}
                    </select>
                    <button className="editor-btn" onClick={onReset}>
                        Reset
                    </button>
                </div>
                <div className="editor-toolbar-right">
                    <span className="font-size-display">{fontSize} pt</span>
                    <button
                        className="editor-btn"
                        onClick={decreaseFontSize}
                        disabled={fontSize <= MIN_FONT_SIZE}
                        title="Decrease font size"
                    >
                        A<sup>-</sup>
                    </button>
                    <button
                        className="editor-btn"
                        onClick={increaseFontSize}
                        disabled={fontSize >= MAX_FONT_SIZE}
                        title="Increase font size"
                    >
                        A<sup>+</sup>
                    </button>
                </div>
            </div>
            <div className="monaco-editor-wrapper">
                <Editor
                    height="100%"
                    path={modelPath}
                    keepCurrentModel
                    saveViewState
                    language={editorLanguage}
                    value={code}
                    onChange={handleEditorChange}
                    onMount={(mountedEditor, monaco) => setInstance({ editor: mountedEditor, monaco })}
                    theme="vs-dark"
                    options={editorOptions}
                />
            </div>
        </>
    );
};

export default CodeEditor;
