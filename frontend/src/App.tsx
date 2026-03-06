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

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/explorer" element={<Explorer />} />
                    <Route path="/explorer/:fuente/:titulo" element={<Explorer />} />
                    <Route path="/crossmedia" element={<CrossMedia />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/twitter-sources" element={<TwitterSources />} />
                </Route>
                <Route path="/situation-monitor" element={<SituationMonitor />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
