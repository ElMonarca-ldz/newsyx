import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Explorer } from '@/pages/Explorer';
import { Sources } from '@/pages/Sources';
import { CrossMedia } from '@/pages/CrossMedia';
import { Settings } from '@/pages/Settings';
import SituationMonitor from '@/pages/SituationMonitor';
import { TwitterSources } from '@/pages/TwitterSources';
import { ArticlesManagement } from '@/pages/ArticlesManagement';
import { UserManagement } from '@/pages/UserManagement';
import { Login } from '@/pages/Login';
import { ProtectedRoute } from '@/context/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

function App() {
    const { isAuthenticated } = useAuth();

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Landing Redirect */}
                <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/situation-monitor" replace />} />

                {/* Auth */}
                <Route path="/acceso-usuarios" element={<Login />} />

                {/* Dashboard & Admin (Protected) */}
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/explorer" element={<Explorer />} />
                    <Route path="/explorer/:fuente/:titulo" element={<Explorer />} />
                    <Route path="/crossmedia" element={<CrossMedia />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/twitter-sources" element={<TwitterSources />} />
                    <Route path="/articles-management" element={<ArticlesManagement />} />
                    <Route path="/user-management" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
                </Route>

                {/* Public Situation Monitor */}
                <Route path="/situation-monitor" element={<SituationMonitor />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
