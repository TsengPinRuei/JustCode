/**
 * 根 App 元件：設定 React Router，並渲染 Navbar 與頁面路由。
 * 路由：/（redirect）、/problems（列表）、/problems/:id（詳細頁）。
 */
import { useEffect } from 'react';
import { problemsApi } from './services/apiClient';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProblemList from './pages/ProblemList';
import ProblemDetail from './pages/ProblemDetail';
import './index.css';

function App() {
    useEffect(() => {
        // Failed saves remain recoverable across route changes in this tab.
        const warnUnsavedProgress = (event: BeforeUnloadEvent) => {
            if (problemsApi.hasUnsavedProgress()) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', warnUnsavedProgress);
        return () => window.removeEventListener('beforeunload', warnUnsavedProgress);
    }, []);
    return (
        <Router>
            <div className="app">
                <Navbar />
                <Routes>
                    <Route path="/" element={<Navigate to="/problems" replace />} />
                    <Route path="/problems" element={<ProblemList />} />
                    <Route path="/problems/:id" element={<ProblemDetail />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
