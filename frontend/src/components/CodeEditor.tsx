import React, { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
    code: string;
    onChange: (value: string) => void;
    onReset: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, onReset }) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [fontSize, setFontSize] = useState(14);

    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 24;

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    const handleEditorChange = (value: string | undefined) => {
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

    return (
        <>
            <div className="editor-toolbar">
                <div className="editor-toolbar-left">
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
                    defaultLanguage="java"
                    value={code}
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

