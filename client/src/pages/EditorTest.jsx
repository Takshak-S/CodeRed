import React, { useState } from 'react';
import CodeEditor from '../components/CodeEditor';

export default function EditorTest() {
  const [code, setCode] = useState(`function greet(name) {\n  // TODO: implement greeting\n  return 'Hello, ' + name;\n}\n\nconsole.log(greet('World'))`);

  return (
    <div style={{ padding: 0, height: '100vh', boxSizing: 'border-box' }}>
      <CodeEditor
        code={code}
        onChange={(v) => setCode(v)}
        language="javascript"
        height="100%"
      />
    </div>
  );
}
