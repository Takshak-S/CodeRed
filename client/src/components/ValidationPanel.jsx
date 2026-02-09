// ValidationPanel component - Cyberpunk themed test results display
import React from 'react';
import { Play, Check, X, AlertTriangle, Loader2, Terminal } from 'lucide-react';

function ValidationPanel({ 
  results, 
  isRunning, 
  onRunTests, 
  error,
  disabled 
}) {
  const hasResults = results && results.length > 0;
  const passedCount = hasResults ? results.filter(r => r.passed).length : 0;
  const totalCount = hasResults ? results.length : 0;
  const allPassed = hasResults && passedCount === totalCount;

  return (
    <div className="validation-panel">
      <div className="panel-header">
        <Terminal size={16} className="header-icon" />
        <span>TEST RUNNER</span>
        <button 
          className={`run-btn ${isRunning ? 'running' : ''}`}
          onClick={onRunTests}
          disabled={isRunning || disabled}
        >
          {isRunning ? (
            <><Loader2 size={14} className="spin" /> RUNNING...</>
          ) : (
            <><Play size={14} /> RUN TESTS</>
          )}
        </button>
      </div>

      <div className="panel-content">
        {error && (
          <div className="error-message">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {!hasResults && !error && !isRunning && (
          <div className="empty-state">
            Click RUN TESTS to validate your code
          </div>
        )}

        {hasResults && (
          <>
            <div className={`summary ${allPassed ? 'passed' : 'failed'}`}>
              <span className="count">{passedCount}/{totalCount}</span>
              <span className="label">TESTS PASSED</span>
            </div>

            <div className="test-results">
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`test-case ${result.passed ? 'passed' : 'failed'}`}
                >
                  <div className="test-header">
                    <span className="test-icon">
                      {result.passed ? <Check size={14} /> : <X size={14} />}
                    </span>
                    <span className="test-number">Test #{index + 1}</span>
                  </div>
                  <div className="test-details">
                    <div className="detail-row">
                      <span className="label">Input:</span>
                      <code>{JSON.stringify(result.input)}</code>
                    </div>
                    <div className="detail-row">
                      <span className="label">Expected:</span>
                      <code>{JSON.stringify(result.expected)}</code>
                    </div>
                    {!result.passed && (
                      <div className="detail-row actual">
                        <span className="label">Actual:</span>
                        <code>{result.error ? result.error : JSON.stringify(result.actual)}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .validation-panel {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(0, 221, 255, 0.3);
          border-radius: 8px;
          overflow: hidden;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: linear-gradient(90deg, rgba(0, 221, 255, 0.1), transparent);
          border-bottom: 1px solid rgba(0, 221, 255, 0.2);
          font-size: 12px;
          font-weight: 600;
          color: #00ddff;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .header-icon {
          opacity: 0.7;
        }

        .run-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #00ddff, #00ff88);
          border: none;
          border-radius: 4px;
          color: #000;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }

        .run-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 221, 255, 0.4);
        }

        .run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .run-btn.running {
          background: rgba(0, 221, 255, 0.2);
          color: #00ddff;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .panel-content {
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: rgba(0, 221, 255, 0.3);
          border-radius: 3px;
        }

        .error-message {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 51, 102, 0.1);
          border: 1px solid rgba(255, 51, 102, 0.3);
          border-radius: 6px;
          color: #ff3366;
          font-size: 12px;
        }

        .empty-state {
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          text-align: center;
          padding: 20px;
        }

        .summary {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .summary.passed {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .summary.failed {
          background: rgba(255, 51, 102, 0.1);
          border: 1px solid rgba(255, 51, 102, 0.3);
        }

        .summary .count {
          font-size: 24px;
          font-weight: 700;
        }

        .summary.passed .count {
          color: #00ff88;
        }

        .summary.failed .count {
          color: #ff3366;
        }

        .summary .label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .test-results {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .test-case {
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid transparent;
        }

        .test-case.passed {
          background: rgba(0, 255, 136, 0.05);
          border-color: rgba(0, 255, 136, 0.2);
        }

        .test-case.failed {
          background: rgba(255, 51, 102, 0.05);
          border-color: rgba(255, 51, 102, 0.2);
        }

        .test-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .test-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
        }

        .test-case.passed .test-icon {
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
        }

        .test-case.failed .test-icon {
          background: rgba(255, 51, 102, 0.2);
          color: #ff3366;
        }

        .test-number {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
        }

        .test-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 28px;
        }

        .detail-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
        }

        .detail-row .label {
          color: rgba(255, 255, 255, 0.5);
          min-width: 60px;
        }

        .detail-row code {
          color: #00ddff;
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 3px;
          word-break: break-all;
        }

        .detail-row.actual code {
          color: #ff3366;
        }
      `}</style>
    </div>
  );
}

export default ValidationPanel;
