import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from '@/contexts/ThemeContext';
import { Skeleton } from '@/components/ui/skeleton';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
}

export interface CodeEditorRef {
  undo: () => void;
  redo: () => void;
}

const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  readOnly = false,
}, ref) {
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    undo: () => {
      editorRef.current?.trigger('keyboard', 'undo', null);
    },
    redo: () => {
      editorRef.current?.trigger('keyboard', 'redo', null);
    },
  }), []);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        theme: theme === 'dark' ? 'vs-dark' : 'vs',
      });
    }
  }, [theme]);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      onChange={(val) => onChange(val || '')}
      onMount={handleEditorMount}
      loading={
        <div className="flex items-center justify-center h-full">
          <Skeleton className="h-full w-full" />
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
      }}
    />
  );
});

export default CodeEditor;
