// CodeEditor component
import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

function CodeEditor({ 
  code, 
  onChange, 
  readOnly = false, 
  language = 'javascript',
  height = '720px'
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [lastCode, setLastCode] = useState(code || '');
  const [messages, setMessages] = useState([]);
  const decorationIdsRef = useRef([]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    if (!document.getElementById('code-editor-decor')) {
      const style = document.createElement('style');
      style.id = 'code-editor-decor';
      style.innerHTML = `
        .myErrorLine { background: rgba(239,68,68,0.08); border-left: 4px solid rgba(239,68,68,0.6); }
        .myWarnLine { background: rgba(245,158,11,0.04); border-left: 4px solid rgba(245,158,11,0.5); }
        .myInfoLine { background: rgba(59,130,246,0.04); border-left: 4px solid rgba(59,130,246,0.5); }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const applyHighlights = (highlights = []) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;

    const decorations = highlights.map(h => {
      const className = h.type === 'error' ? 'myErrorLine' : (h.type === 'warning' ? 'myWarnLine' : 'myInfoLine');
      return {
        range: new monaco.Range(h.line, 1, h.line, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: className,
          hoverMessage: { value: h.reason || '' }
        }
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);
  };

  const handleEditorChange = (value) => {
    // Prevent editing if locked
    if (locked) {
      // revert to last known good code
      if (editorRef.current) {
        editorRef.current.setValue(lastCode);
      }
      return;
    }

    setLastCode(value);
    if (onChange) onChange(value);
  };

  const validateRemote = async () => {
    const payload = { code: editorRef.current ? editorRef.current.getValue() : lastCode };
    try {
      const res = await fetch('http://localhost:3001/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      const combined = [ ...(json.errors || []), ...(json.warnings || []) ];
      setMessages(combined.map(m => ({ ...m })));
      if (json.highlights) applyHighlights(json.highlights);
    } catch (err) {
      setMessages([{ message: 'Validation request failed', details: err.message }]);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.editorHeader}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={styles.editorTitle}>Code Editor</span>
          <span style={styles.language}>{language}</span>
          <button onClick={() => { setLocked(s => !s); }} style={styles.btn}>{locked ? 'Unlock' : 'Lock'}</button>
          <button onClick={validateRemote} style={styles.btn}>Validate</button>
        </div>
        <div>
          {messages.slice(0,3).map((m, i) => (
            <div key={i} style={{ color: m.line ? '#f59e0b' : '#ef4444', fontSize: 12 }}>{m.message}{m.line ? ` (line ${m.line})` : ''}</div>
          ))}
        </div>
      </div>
      <div style={styles.editorWrapper}>
        <Editor
          height={'100%'}
          language={language}
          value={code}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            readOnly: readOnly || locked,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on'
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
    width: '70%',
    maxWidth: '1100px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#1f2937',
    color: 'white'
  },
  editorTitle: {
    fontSize: '14px',
    fontWeight: '600'
  },
  language: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#374151',
    borderRadius: '4px',
    textTransform: 'uppercase'
  },
  editorWrapper: {
    backgroundColor: '#1e1e1e',
    flex: 1,
    minHeight: 0
  }
};

export default CodeEditor;
