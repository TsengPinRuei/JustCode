/**
 * 程式碼編輯器元件：包裝 Monaco Editor，支援語言切換、字級控制、
 * 即時錯誤標示，以及不干擾游標的外部更新。
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
    // setValue 套用外部 reset/語言切換時，暫時抑制 onChange。
    const preventOnChangeRef = useRef(false);
    // 追蹤前一次 `code` prop，用來偵測外部變更。
    const prevCodeRef = useRef(code);
    // 使用者編輯已經更新 Monaco，不應再透過 setValue 重播。
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

    // 透過 editor ref 同步外部程式碼變更（reset、語言切換）。
    // 使用 setValue 重播使用者輸入會移動游標，因此會略過該路徑。
    useEffect(() => {
        if (editorRef.current && code !== prevCodeRef.current) {
            if (isUserEditRef.current) {
                // 變更來自使用者輸入；Monaco 已經有最新文字。
                isUserEditRef.current = false;
            } else {
                // reset/語言切換等外部變更：更新 Monaco，但不觸發 onChange。
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

    // 編譯錯誤變更時更新 Monaco markers。
    // 後端回報的是 1-based 位置，Monaco 可直接使用。
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
                // 編譯/執行成功後清除舊診斷。
                monaco.editor.setModelMarkers(model, 'compilation', []);
            }
        }
    }, [compilationErrors]);

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
