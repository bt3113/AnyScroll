import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import NavBar from './components/NavBar';
import { initDocsStore } from './lib/docsStore';

const Library = lazy(() => import('./pages/Library'));
const Reader = lazy(() => import('./pages/Reader'));

export default function App() {
  useEffect(() => {
    initDocsStore();
  }, []);

  return (
    <HashRouter>
      <div className="app-shell">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/reader/:docId" element={<Reader />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <NavBar />
      </div>
    </HashRouter>
  );
}
