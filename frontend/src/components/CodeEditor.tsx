import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Language, CompilationError } from '../types';

interface CodeEditorProps {
    code: string;
    onChange: (value: string) => void;
    onReset: () => void;
    language: Language;
    compilationErrors?: CompilationError[];
    // Language selector props
    selectedLanguage: Language;
    supportedLanguages: Language[];
    onLanguageChange: (language: Language) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    onChange,
    onReset,
    language,
    compilationErrors,
    selectedLanguage,
    supportedLanguages,
    onLanguageChange
}) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [fontSize, setFontSize] = useState(14);
    // Track whether onChange should be suppressed (during external code sync)
    const preventOnChangeRef = useRef(false);
    // Track the previous code prop to detect external changes
    const prevCodeRef = useRef(code);

    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 24;

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    const handleEditorChange = (value: string | undefined) => {
        if (preventOnChangeRef.current) return;
        if (value !== undefined) {
            onChange(value);
        }
    };

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 2, MAX_FONT_SIZE));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 2, MIN_FONT_SIZE));
    };

    // Sync external code changes (reset, language switch) to the editor via ref.
    // User typing goes directly through Monaco without this path.
    useEffect(() => {
        if (editorRef.current && code !== prevCodeRef.current) {
            const currentValue = editorRef.current.getValue();
            if (code !== currentValue) {
                preventOnChangeRef.current = true;
                editorRef.current.setValue(code);
                preventOnChangeRef.current = false;
            }
        }
        prevCodeRef.current = code;
    }, [code]);

    // Update Monaco markers when compilation errors change
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
                // Clear markers when no errors
                monaco.editor.setModelMarkers(model, 'compilation', []);
            }
        }
    }, [compilationErrors]);

    const getLanguageLabel = (lang: Language): string => {
        return lang === 'java' ? 'Java' : 'Python3';
    };

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
                                {getLanguageLabel(lang)}
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
                    language={language === 'java' ? 'java' : 'python'}
                    defaultValue={code}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                        fontSize: fontSize,
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
                    }}
                />
            </div>
        </>
    );
};

export default CodeEditor;

