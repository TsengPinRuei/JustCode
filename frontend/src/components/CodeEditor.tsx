/**
 * 程式碼編輯器元件：包裝 Monaco Editor，支援語言切換、字級控制、
 * 即時錯誤標示，以及不干擾游標的外部更新。
 */
import { useState, useEffect, useMemo, type FC } from 'react';
import Editor from '@monaco-editor/react';
import type * as MonacoApi from 'monaco-editor/editor';
import '../services/monacoSetup';
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

    useEffect(() => {
        if (!instance) return;
        const { editor: mountedEditor, monaco } = instance;
        const model = mountedEditor.getModel();
        if (!model) return;

        // Compiler locations may refer to generated wrapper lines outside the
        // user's buffer. Clamp them before asking Monaco for a line's bounds.
        const markers = (compilationErrors ?? []).map(error => {
            const line = Math.max(1, Math.min(model.getLineCount(), error.line));
            const maxColumn = model.getLineMaxColumn(line);
            const column = Math.max(1, Math.min(maxColumn, error.column));
            return {
                severity: error.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
                message: error.message,
                startLineNumber: line,
                startColumn: column,
                endLineNumber: line,
                endColumn: maxColumn,
            };
        });
        monaco.editor.setModelMarkers(model, 'compilation', markers);
        return () => {
            if (!model.isDisposed()) monaco.editor.setModelMarkers(model, 'compilation', []);
        };
    }, [instance, compilationErrors, selectedLanguage]);

    const editorLanguage = selectedLanguage === 'java' ? 'java' : 'python';
    const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
        // 除字級外保持 Monaco options 穩定，避免每次 render 都重新設定編輯器。
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
