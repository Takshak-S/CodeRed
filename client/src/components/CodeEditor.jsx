// CodeEditor component with Yjs CRDT collaborative editing via y-monaco
// Includes live remote cursors and "who is typing" name tags
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
const WS_URL = SERVER_URL.replace('http://', 'ws://').replace('https://', 'wss://');

// Message types (must match server)
const MSG_SYNC_REQUEST = 0;
const MSG_SYNC_RESPONSE = 1;
const MSG_UPDATE = 2;
const MSG_AWARENESS = 3;

function CodeEditor({ 
  code, 
  onChange, 
  readOnly = false, 
  language = 'javascript',
  height = '720px',
  roomCode = null,
  playerId = null,
  playerName = 'Anonymous',
  playerColor = '#00ff88',
  playerRole = null
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const wsRef = useRef(null);
  const yTextRef = useRef(null);
  const bindingRef = useRef(null);
  const initialCodeRef = useRef(code);
  const onChangeRef = useRef(onChange);
  const cursorDecorationsRef = useRef([]);   // Monaco decoration IDs for remote cursors
  const cursorWidgetsRef = useRef(new Map()); // playerId -> content widget for name tags
  const remoteCursorsRef = useRef({});        // latest remote cursor states
  
  const [locked, setLocked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});

  // Keep onChange ref current so the yText observer always calls the latest
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Helper: create or recreate the MonacoBinding when both editor and yText are ready
  const ensureBinding = useCallback(() => {
    if (editorRef.current && yTextRef.current) {
      bindingRef.current?.destroy();
      bindingRef.current = new MonacoBinding(
        yTextRef.current,
        editorRef.current.getModel(),
        new Set([editorRef.current])
      );
    }
  }, []);

  // Render remote cursors as Monaco decorations + name-tag widgets
  const renderRemoteCursors = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const states = remoteCursorsRef.current;
    const newDecorations = [];

    // Remove old name-tag widgets
    cursorWidgetsRef.current.forEach((widget) => {
      try { editor.removeContentWidget(widget); } catch (_) { /* ignore */ }
    });
    cursorWidgetsRef.current.clear();

    Object.entries(states).forEach(([pid, state]) => {
      if (!state?.cursor) return;
      const { cursor, selection, color = '#00ff88', name = 'Anonymous' } = state;
      const ln = cursor.lineNumber;
      const col = cursor.column;

      // ── Cursor line decoration (thin colored bar) ──
      newDecorations.push({
        range: new monaco.Range(ln, col, ln, col),
        options: {
          className: `remote-cursor-${pid}`,
          beforeContentClassName: `remote-cursor-bar-${pid}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });

      // ── Selection highlight ──
      if (selection &&
          (selection.startLineNumber !== selection.endLineNumber ||
           selection.startColumn !== selection.endColumn)) {
        newDecorations.push({
          range: new monaco.Range(
            selection.startLineNumber, selection.startColumn,
            selection.endLineNumber, selection.endColumn
          ),
          options: {
            className: `remote-selection-${pid}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });
      }

      // ── Inject dynamic CSS for this cursor's color ──
      const styleId = `remote-cursor-style-${pid}`;
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        .remote-cursor-bar-${pid}::before {
          content: '';
          position: absolute;
          width: 2px;
          height: 18px;
          background: ${color};
          top: 0;
          margin-left: -1px;
          z-index: 10;
          animation: cursorBlink-${pid} 1s ease-in-out infinite;
        }
        @keyframes cursorBlink-${pid} {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .remote-selection-${pid} {
          background: ${color}22;
        }
      `;

      // ── Name-tag content widget ──
      const widgetId = `cursor-widget-${pid}`;
      const widget = {
        getId: () => widgetId,
        getDomNode: () => {
          let node = document.getElementById(widgetId);
          if (!node) {
            node = document.createElement('div');
            node.id = widgetId;
            node.style.cssText = `
              background: ${color};
              color: #000;
              font-size: 10px;
              font-weight: 700;
              padding: 1px 5px;
              border-radius: 2px;
              pointer-events: none;
              white-space: nowrap;
              z-index: 100;
              position: relative;
              top: -18px;
              font-family: 'Share Tech Mono', monospace;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            node.textContent = name;
          } else {
            node.textContent = name;
            node.style.background = color;
          }
          return node;
        },
        getPosition: () => ({
          position: { lineNumber: ln, column: col },
          preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
        })
      };
      editor.addContentWidget(widget);
      cursorWidgetsRef.current.set(pid, widget);
    });

    // Apply all decorations at once
    cursorDecorationsRef.current = editor.deltaDecorations(
      cursorDecorationsRef.current,
      newDecorations
    );
  }, []);

  // Setup Yjs doc, WebSocket, and MonacoBinding
  useEffect(() => {
    if (!roomCode) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const yText = ydoc.getText('code');
    yTextRef.current = yText;

    // Do NOT insert initial code here — the server's Yjs doc is the
    // single source of truth and will send its state via MSG_SYNC_RESPONSE.
    // Inserting locally causes duplicate content when multiple clients race.

    // Notify parent component of any yText content change (local or remote)
    const textObserver = () => {
      if (onChangeRef.current) {
        onChangeRef.current(yText.toString());
      }
    };
    yText.observe(textObserver);

    // Create MonacoBinding if editor is already mounted
    ensureBinding();

    // WebSocket connection for syncing Yjs updates across clients
    const wsUrl = `${WS_URL}/yjs/${roomCode}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Yjs WebSocket connected');
      setConnected(true);
      ws.send(JSON.stringify({ type: MSG_SYNC_REQUEST }));
      if (playerId) {
        ws.send(JSON.stringify({
          type: MSG_AWARENESS,
          playerId,
          state: { name: playerName, color: playerColor }
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case MSG_SYNC_RESPONSE:
            if (data.state) {
              Y.applyUpdate(ydoc, new Uint8Array(data.state), 'remote');
            }
            break;
          case MSG_UPDATE:
            if (data.update) {
              Y.applyUpdate(ydoc, new Uint8Array(data.update), 'remote');
            }
            break;
          case MSG_AWARENESS:
            if (data.playerId && data.playerId !== playerId) {
              if (data.state === null) {
                // Player disconnected — remove their cursor
                setRemoteCursors(prev => {
                  const next = { ...prev };
                  delete next[data.playerId];
                  return next;
                });
                const copy = { ...remoteCursorsRef.current };
                delete copy[data.playerId];
                remoteCursorsRef.current = copy;
                // Remove their dynamic style + widget DOM node
                const styleEl = document.getElementById(`remote-cursor-style-${data.playerId}`);
                if (styleEl) styleEl.remove();
                const widgetNode = document.getElementById(`cursor-widget-${data.playerId}`);
                if (widgetNode) widgetNode.remove();
              } else {
                setRemoteCursors(prev => ({ ...prev, [data.playerId]: data.state }));
                remoteCursorsRef.current = { ...remoteCursorsRef.current, [data.playerId]: data.state };
              }
              renderRemoteCursors();
            } else if (data.states) {
              const filtered = Object.fromEntries(
                Object.entries(data.states).filter(([id]) => id !== playerId)
              );
              setRemoteCursors(filtered);
              remoteCursorsRef.current = filtered;
              renderRemoteCursors();
            }
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('Yjs message parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Yjs WebSocket disconnected');
      setConnected(false);
    };

    ws.onerror = (err) => {
      console.error('Yjs WebSocket error:', err);
      setConnected(false);
    };

    // Send local Yjs updates over WebSocket to the server
    const updateHandler = (update, origin) => {
      if (origin !== 'remote' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: MSG_UPDATE,
          update: Array.from(update)
        }));
      }
    };
    ydoc.on('update', updateHandler);

    return () => {
      yText.unobserve(textObserver);
      ydoc.off('update', updateHandler);
      bindingRef.current?.destroy();
      bindingRef.current = null;
      ws.close();
      ydoc.destroy();
      ydocRef.current = null;
      yTextRef.current = null;

      // Clean up remote cursor decorations, widgets, and dynamic styles
      const editor = editorRef.current;
      if (editor) {
        cursorWidgetsRef.current.forEach((widget) => {
          try { editor.removeContentWidget(widget); } catch (_) {}
        });
        cursorWidgetsRef.current.clear();
        if (cursorDecorationsRef.current.length) {
          editor.deltaDecorations(cursorDecorationsRef.current, []);
          cursorDecorationsRef.current = [];
        }
      }
      // Remove all injected remote-cursor style elements
      document.querySelectorAll('[id^="remote-cursor-style-"]').forEach(el => el.remove());
    };
  }, [roomCode, playerId, playerName, playerColor, ensureBinding, renderRemoteCursors]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Create MonacoBinding now that editor is ready (yText may already exist)
    ensureBinding();

    // Send cursor position on every cursor change
    editor.onDidChangeCursorPosition((e) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && playerId) {
        const selection = editor.getSelection();
        ws.send(JSON.stringify({
          type: MSG_AWARENESS,
          playerId,
          state: {
            name: playerName,
            color: playerColor,
            cursor: {
              lineNumber: e.position.lineNumber,
              column: e.position.column
            },
            selection: selection ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn
            } : null
          }
        }));
      }
    });

    // Also send on selection change (e.g. shift+arrow, mouse drag)
    editor.onDidChangeCursorSelection((e) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && playerId) {
        const sel = e.selection;
        ws.send(JSON.stringify({
          type: MSG_AWARENESS,
          playerId,
          state: {
            name: playerName,
            color: playerColor,
            cursor: {
              lineNumber: sel.positionLineNumber,
              column: sel.positionColumn
            },
            selection: {
              startLineNumber: sel.startLineNumber,
              startColumn: sel.startColumn,
              endLineNumber: sel.endLineNumber,
              endColumn: sel.endColumn
            }
          }
        }));
      }
    });
  };

  // Add decoration styles
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

  const validateRemote = async () => {
    const currentCode = yTextRef.current 
      ? yTextRef.current.toString() 
      : (editorRef.current ? editorRef.current.getValue() : '');
    
    if (!currentCode) {
      alert('No code to validate');
      return;
    }

    // Use socket instead of HTTP
    if (window.gameSocket) {
      window.gameSocket.emit('validateBugFix', { code: currentCode }, (response) => {
        console.log('Validation response:', response);
        if (response.success) {
          let message = response.message;
          
          if (response.results) {
             const failures = response.results.filter(r => !r.passed);
             if (failures.length > 0) {
                const details = failures.map(f => {
                  let reason = f.error;
                  if (!reason && f.expected !== undefined) {
                    reason = `Expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`;
                  }
                  return `❌ ${f.method}: ${reason}`;
                }).join('\n');
                
                message += `\n\n${failures.length} Issues Found:\n${details}`;
             }
          }
          
          alert(message);
        } else {
          alert(`Error: ${response.error || 'Validation failed'}`);
        }
      });
    } else {
      alert('Not connected to game server');
    }
  };

  const styles = {
    container: {
      backgroundColor: '#1e1e1e',
      borderRadius: '8px',
      overflow: 'hidden',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    },
    editorHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      backgroundColor: '#1f2937',
      color: 'white',
      borderBottom: '1px solid #374151'
    },
    editorTitle: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#00ff88'
    },
    language: {
      fontSize: '10px',
      padding: '3px 6px',
      backgroundColor: '#374151',
      borderRadius: '4px',
      textTransform: 'uppercase',
      color: '#999'
    },
    connectionStatus: {
      fontSize: '10px',
      padding: '3px 8px',
      borderRadius: '4px',
      backgroundColor: connected ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 51, 102, 0.2)',
      color: connected ? '#00ff88' : '#ff3366',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    btn: {
      padding: '4px 10px',
      fontSize: '10px',
      background: 'rgba(0,255,136,0.1)',
      border: '1px solid #00ff88',
      color: '#00ff88',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit'
    },
    editorWrapper: {
      backgroundColor: '#1e1e1e',
      flex: 1,
      minHeight: 0
    },
    remoteCursorsInfo: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },
    cursorBadge: {
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: '3px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.editorHeader}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={styles.editorTitle}>Code Editor</span>
          <span style={styles.language}>{language}</span>
          {roomCode && (
            <span style={styles.connectionStatus}>
              <span style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                backgroundColor: connected ? '#00ff88' : '#ff3366' 
              }}></span>
              {connected ? 'LIVE' : 'CONNECTING...'}
            </span>
          )}
          {!readOnly && (
            <>
              <button onClick={() => { setLocked(s => !s); }} style={styles.btn}>
                {locked ? 'Unlock' : 'Lock'}
              </button>
              {playerRole === 'debugger' && (
                <button onClick={validateRemote} style={styles.btn}>Validate</button>
              )}
            </>
          )}
        </div>
        <div style={styles.remoteCursorsInfo}>
          {Object.entries(remoteCursors).map(([id, state]) => (
            <span 
              key={id} 
              style={{
                ...styles.cursorBadge,
                backgroundColor: `${state.color}33`,
                color: state.color
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: state.color
              }}></span>
              {state.name}
            </span>
          ))}
        </div>
      </div>
      <div style={styles.editorWrapper}>
        <Editor
          height={'100%'}
          language={language}
          defaultValue={code}
          onMount={handleEditorMount}
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

export default CodeEditor;