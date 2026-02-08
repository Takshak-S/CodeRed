// Main App component with routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Result from './pages/Result';
// import EditorTest from './pages/EditorTest';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
        {/* <Route path="/editor" element={<EditorTest />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
