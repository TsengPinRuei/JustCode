/**
 * Code Editor Component \u2014 Monaco Editor wrapper with language switching,
 * font size controls, real-time error highlighting, and cursor-safe external updates.
 */
import { useRef, useState, useEffect, useMemo, type FC } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Language, CompilationError } from '../types';

interface CodeEditorProps {
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

const CodeEditor: FC<CodeEditorProps> = ({
    code,
    onChange,
    onReset,
    compilationErrors,
    selectedLanguage,
    supportedLanguages,
    onLanguageChange
}) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [fontSize, setFontSize] = useState(14);
    // Suppress onChange while setValue applies external resets/language switches.
    const preventOnChangeRef = useRef(false);
    // Track the previous code prop to detect external changes.
    const prevCodeRef = useRef(code);
    // User edits already update Monaco, so they should not be replayed through setValue.
    const isUserEditRef = useRef(false);

    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 24;

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    const handleEditorChange = (value: string | undefined) => {
        if (preventOnChangeRef.current) return;
        if (value !== undefined) {
            isUserEditRef.current = true;
            onChange(value);
        }
    };

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 2, MAX_FONT_SIZE));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 2, MIN_FONT_SIZE));
    };

    // Sync external code changes (reset, language switch) through the editor ref.
    // Replaying user typing with setValue would move the cursor, so that path is skipped.
    useEffect(() => {
        if (editorRef.current && code !== prevCodeRef.current) {
            if (isUserEditRef.current) {
                // Change originated from user typing; Monaco already has the latest text.
                isUserEditRef.current = false;
            } else {
                // External change such as reset/language switch; update Monaco without firing onChange.
                const currentValue = editorRef.current.getValue();
                if (code !== currentValue) {
                    preventOnChangeRef.current = true;
                    editorRef.current.setValue(code);
                    preventOnChangeRef.current = false;
                }
            }
        }
        prevCodeRef.current = code;
    }, [code]);

    // Update Monaco markers when compilation errors change.
    // The backend reports 1-based locations that Monaco can consume directly.
    useEffect(() => {
        if (editorRef.current) {
            const monaco = (window as any).monaco;
            if (!monaco) return;

            const model = editorRef.current.getModel();
            if (!model) return;

            if (compilationErrors && compilationErrors.length > 0) {
                const markers = compilationErrors.map(error => ({
                    severity: error.severity === 'error'
                        ? monaco.MarkerSeverity.Error
                        : monaco.MarkerSeverity.Warning,
                    message: error.message,
                    startLineNumber: error.line,
                    startColumn: error.column,
                    endLineNumber: error.line,
                    endColumn: model.getLineMaxColumn(error.line),
                }));
                monaco.editor.setModelMarkers(model, 'compilation', markers);
            } else {
                // Clear old diagnostics after successful compilation/execution.
                monaco.editor.setModelMarkers(model, 'compilation', []);
            }
        }
    }, [compilationErrors]);

    const editorLanguage = selectedLanguage === 'java' ? 'java' : 'python';
    const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
        // Keep Monaco options stable except for font size so the editor is not reconfigured on every render.
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
                    language={editorLanguage}
                    defaultValue={code}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={editorOptions}
                />
            </div>
        </>
    );
};

export default CodeEditor;
