import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Settings as SettingsIcon,
    Terminal,
    Activity,
    Database,
    Check,
    ExternalLink,
    Key,
    Cpu,
    Search,
    Save,
    RefreshCcw,
    AlertCircle,
    Eye,
    EyeOff,
    FileText
} from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

export const Settings = () => {
    const [settings, setSettings] = useState<any>(null);
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingModels, setLoadingModels] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state - OpenRouter
    const [orApiKey, setOrApiKey] = useState('');
    const [orModel, setOrModel] = useState('');
    const [showOrKey, setShowOrKey] = useState(false);

    // Form state - Google
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [googleModel, setGoogleModel] = useState('');
    const [showGoogleKey, setShowGoogleKey] = useState(false);

    // Form state - Groq
    const [groqApiKey, setGroqApiKey] = useState('');
    const [groqModel, setGroqModel] = useState('');
    const [showGroqKey, setShowGroqKey] = useState(false);

    // Form state - GPT4Free
    const [gpt4freeModel, setGpt4freeModel] = useState('');

    const [modelSearch, setModelSearch] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    const [promptStatus, setPromptStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const [analysisPrompt, setAnalysisPrompt] = useState('');
    const [crossmediaPrompt, setCrossmediaPrompt] = useState('');
    const [savingPrompts, setSavingPrompts] = useState(false);
    const [loadingPrompts, setLoadingPrompts] = useState(true);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<any>({});

    // Pipeline settings
    const [ingestionCycle, setIngestionCycle] = useState<string>('');
    const [maxArticles, setMaxArticles] = useState<string>('');
    const [savingPipeline, setSavingPipeline] = useState(false);
    const [pipelineStatus, setPipelineStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // Logs state
    const [llmLogs, setLlmLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchPrompts();
        fetchLogs();
        const logInterval = setInterval(fetchLogs, 30000); // Poll logs every 30s
        return () => clearInterval(logInterval);
    }, []);

    const handleTestConnection = async (provider: string, apiKey: string) => {
        setTestingProvider(provider);
        setTestResults((prev: any) => ({ ...prev, [provider]: null }));

        try {
            const res = await fetch(`${API_BASE_URL}/settings/llm/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, apiKey })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setTestResults((prev: any) => ({ ...prev, [provider]: { type: 'success', message: data.message } }));
            } else {
                setTestResults((prev: any) => ({ ...prev, [provider]: { type: 'error', message: data.error || 'Error de conexión' } }));
            }
        } catch (err: any) {
            setTestResults((prev: any) => ({ ...prev, [provider]: { type: 'error', message: err.message } }));
        } finally {
            setTestingProvider(null);
        }
    };

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch(`${API_BASE_URL}/settings/llm/logs`);
            if (res.ok) {
                const data = await res.json();
                setLlmLogs(data);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchPrompts = async () => {
        setLoadingPrompts(true);
        try {
            const res = await fetch(`${API_BASE_URL}/settings/prompts`);
            if (res.ok) {
                const data = await res.json();
                setAnalysisPrompt(data.analysisPrompt || '');
                setCrossmediaPrompt(data.crossmediaPrompt || '');
            }
        } catch (err) {
            console.error('Error fetching prompts:', err);
        } finally {
            setLoadingPrompts(false);
        }
    };

    const handleSavePrompts = async () => {
        setSavingPrompts(true);
        setPromptStatus({ type: null, message: '' });
        try {
            const res = await fetch(`${API_BASE_URL}/settings/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysisPrompt: analysisPrompt,
                    crossmediaPrompt: crossmediaPrompt
                })
            });

            if (res.ok) {
                setPromptStatus({ type: 'success', message: 'Prompts guardados correctamente' });
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar prompts');
            }
        } catch (err: any) {
            setPromptStatus({ type: 'error', message: err.message });
        } finally {
            setSavingPrompts(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`);
            const data = await res.json();
            setSettings(data);

            // Populate models
            setOrModel(data.pipeline?.openrouter_model || '');
            setGoogleModel(data.pipeline?.google_model || '');
            setGroqModel(data.pipeline?.groq_model || '');
            setGpt4freeModel(data.pipeline?.gpt4free_model || '');

            setIngestionCycle(data.pipeline?.ingestion_cycle_minutes || '15');
            setMaxArticles(data.pipeline?.max_articles_per_cycle || '200');

            setLoading(false);

            // If we have an API key (even if masked), try fetching OpenRouter models
            if (data.pipeline?.openrouter_api_key) {
                fetchModels();
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            setLoading(false);
        }
    };

    const fetchModels = async () => {
        setLoadingModels(true);
        try {
            const res = await fetch(`${API_BASE_URL}/settings/openrouter/models`);
            if (!res.ok) throw new Error('Error al obtener modelos');
            const data = await res.json();
            setModels(data);
        } catch (err) {
            console.error('Error fetching models:', err);
        } finally {
            setLoadingModels(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus({ type: null, message: '' });
        try {
            const res = await fetch(`${API_BASE_URL}/settings/llm/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    openrouterApiKey: orApiKey || undefined,
                    openrouterModel: orModel,
                    googleApiKey: googleApiKey || undefined,
                    googleModel: googleModel,
                    groqApiKey: groqApiKey || undefined,
                    groqModel: groqModel,
                    gpt4freeModel: gpt4freeModel
                })
            });

            if (res.ok) {
                setStatus({ type: 'success', message: 'Configuración guardada correctamente' });
                setOrApiKey('');
                setGoogleApiKey('');
                setGroqApiKey('');
                fetchSettings();
            } else {
                const text = await res.text();
                let errorMessage = 'Error al guardar';
                try {
                    const err = JSON.parse(text);
                    errorMessage = err.error || errorMessage;
                } catch (e) {
                    // If not JSON, it might be an HTML error page from Express/Nginx
                    errorMessage = `Server Error: ${res.status} ${res.statusText}`;
                }
                throw new Error(errorMessage);
            }
        } catch (err: any) {
            console.error('Save error details:', err);
            setStatus({ type: 'error', message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePipeline = async () => {
        setSavingPipeline(true);
        setPipelineStatus({ type: null, message: '' });
        try {
            const res = await fetch(`${API_BASE_URL}/settings/pipeline/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingestionCycleMinutes: ingestionCycle,
                    maxArticlesPerCycle: maxArticles
                })
            });

            if (res.ok) {
                setPipelineStatus({ type: 'success', message: 'Configuración de ingesta guardada' });
                fetchSettings();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Error al guardar configuración de ingesta');
            }
        } catch (err: any) {
            setPipelineStatus({ type: 'error', message: err.message });
        } finally {
            setSavingPipeline(false);
        }
    };

    const filteredModels = useMemo(() => {
        return models.filter(m =>
            m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
            m.id.toLowerCase().includes(modelSearch.toLowerCase())
        );
    }, [models, modelSearch]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Iniciando Newsyx Operations...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Configuración
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg">Control total sobre el núcleo de inteligencia de Newsyx.</p>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">System Health: Optimal</span>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-12">
                {/* AI Configuration Section */}
                <div className="md:col-span-8 space-y-8">
                    <Card className="shadow-xl border-t-4 border-t-primary/50 overflow-hidden relative group">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Cpu className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">LLM Router Hub</CardTitle>
                                    <CardDescription>Configura la cascada de proveedores para máxima fiabilidad</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-10">
                            {/* P0: GPT4Free */}
                            <div className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-emerald-500/10 relative">
                                <div className="absolute -top-3 -left-2 bg-emerald-600 text-[10px] font-black px-2 py-0.5 rounded text-white shadow-sm">
                                    PRIORIDAD 0 (FREE)
                                </div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        GPT4Free (g4f)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTestConnection('gpt4free', '')}
                                            disabled={testingProvider === 'gpt4free'}
                                            className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            {testingProvider === 'gpt4free' ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                            VALIDAR
                                        </button>
                                        <span className="text-[10px] font-mono opacity-50">Unlimited Cost Reduction</span>
                                    </div>
                                </div>
                                {testResults['gpt4free'] && (
                                    <div className={`text-[10px] font-bold px-3 py-1 rounded-lg ${testResults['gpt4free'].type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {testResults['gpt4free'].message}
                                    </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-xs font-bold opacity-70">Modelo de g4f</label>
                                        <Input
                                            value={gpt4freeModel}
                                            onChange={(e: any) => setGpt4freeModel(e.target.value)}
                                            placeholder="gpt-4o, gpt-4, claude-3-opus..."
                                            className="h-10 bg-background"
                                        />
                                        <p className="text-[9px] text-muted-foreground italic">Nota: GPT4Free utiliza proveedores web automáticos. La disponibilidad del modelo depende del proveedor activo en g4f.</p>
                                    </div>
                                </div>
                            </div>

                            {/* P1: Google Gemini */}
                            <div className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-primary/10 relative">
                                <div className="absolute -top-3 -left-2 bg-primary text-[10px] font-black px-2 py-0.5 rounded text-primary-foreground shadow-sm">
                                    PRIORIDAD 1
                                </div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        Google Gemini
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTestConnection('google', googleApiKey)}
                                            disabled={testingProvider === 'google'}
                                            className="text-[10px] font-bold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            {testingProvider === 'google' ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                            VALIDAR
                                        </button>
                                        <span className="text-[10px] font-mono opacity-50">Free Tier Friendly</span>
                                    </div>
                                </div>
                                {testResults['google'] && (
                                    <div className={`text-[10px] font-bold px-3 py-1 rounded-lg ${testResults['google'].type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {testResults['google'].message}
                                    </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">API Key</label>
                                        <div className="relative">
                                            <Input
                                                type={showGoogleKey ? "text" : "password"}
                                                placeholder={settings?.pipeline?.google_api_key ? "••••••••••••••••" : "AIzaSy..."}
                                                value={googleApiKey}
                                                onChange={(e: any) => setGoogleApiKey(e.target.value)}
                                                className="h-10 bg-background"
                                            />
                                            <button
                                                onClick={() => setShowGoogleKey(!showGoogleKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            >
                                                {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">Modelo</label>
                                        <Input
                                            value={googleModel}
                                            onChange={(e: any) => setGoogleModel(e.target.value)}
                                            placeholder="gemini-1.5-flash"
                                            className="h-10 bg-background"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* P2: Groq */}
                            <div className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-orange-500/10 relative">
                                <div className="absolute -top-3 -left-2 bg-orange-600 text-[10px] font-black px-2 py-0.5 rounded text-white shadow-sm">
                                    PRIORIDAD 2
                                </div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                                        Groq Cloud
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTestConnection('groq', groqApiKey)}
                                            disabled={testingProvider === 'groq'}
                                            className="text-[10px] font-bold bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            {testingProvider === 'groq' ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                            VALIDAR
                                        </button>
                                        <span className="text-[10px] font-mono opacity-50">Ultra Fast Inference</span>
                                    </div>
                                </div>
                                {testResults['groq'] && (
                                    <div className={`text-[10px] font-bold px-3 py-1 rounded-lg ${testResults['groq'].type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {testResults['groq'].message}
                                    </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">API Key</label>
                                        <div className="relative">
                                            <Input
                                                type={showGroqKey ? "text" : "password"}
                                                placeholder={settings?.pipeline?.groq_api_key ? "••••••••••••••••" : "gsk_..."}
                                                value={groqApiKey}
                                                onChange={(e: any) => setGroqApiKey(e.target.value)}
                                                className="h-10 bg-background"
                                            />
                                            <button
                                                onClick={() => setShowGroqKey(!showGroqKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            >
                                                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">Modelo</label>
                                        <Input
                                            value={groqModel}
                                            onChange={(e: any) => setGroqModel(e.target.value)}
                                            placeholder="llama-3.3-70b-versatile"
                                            className="h-10 bg-background"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* P3: OpenRouter */}
                            <div className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-purple-500/10 relative">
                                <div className="absolute -top-3 -left-2 bg-purple-600 text-[10px] font-black px-2 py-0.5 rounded text-white shadow-sm">
                                    FALLBACK FINAL
                                </div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                        OpenRouter
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTestConnection('openrouter', orApiKey)}
                                            disabled={testingProvider === 'openrouter'}
                                            className="text-[10px] font-bold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            {testingProvider === 'openrouter' ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                            VALIDAR
                                        </button>
                                        <span className="text-[10px] font-mono opacity-50">Global Model Access</span>
                                    </div>
                                </div>
                                {testResults['openrouter'] && (
                                    <div className={`text-[10px] font-bold px-3 py-1 rounded-lg ${testResults['openrouter'].type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {testResults['openrouter'].message}
                                    </div>
                                )}

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">API Key</label>
                                        <div className="relative">
                                            <Input
                                                type={showOrKey ? "text" : "password"}
                                                placeholder={settings?.pipeline?.openrouter_api_key ? "••••••••••••••••" : "sk-or-v1-..."}
                                                value={orApiKey}
                                                onChange={(e) => setOrApiKey(e.target.value)}
                                                className="h-10 bg-background"
                                            />
                                            <button
                                                onClick={() => setShowOrKey(!showOrKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            >
                                                {showOrKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold opacity-70">Modelo Seleccionado</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar un modelo..."
                                                value={modelSearch}
                                                onChange={(e) => setModelSearch(e.target.value)}
                                                className="pl-10 pr-12 h-10 bg-background"
                                            />
                                            <button
                                                onClick={fetchModels}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary"
                                                disabled={loadingModels}
                                            >
                                                <RefreshCcw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>

                                        <div className="border rounded-xl max-h-40 overflow-y-auto bg-background grid grid-cols-1 divide-y shadow-inner scrollbar-hide">
                                            {filteredModels.length > 0 ? (
                                                filteredModels.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setOrModel(m.id)}
                                                        className={`flex flex-col p-3 text-left transition-all hover:bg-primary/5 ${orModel === m.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                                                    >
                                                        <span className="font-bold text-xs">{m.name}</span>
                                                        <span className="text-[9px] font-mono text-muted-foreground">{m.id}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    No se encontraron modelos.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {status.message && (
                                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in zoom-in duration-300 ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-600' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
                                    {status.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                    <span className="text-sm font-bold">{status.message}</span>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="h-12 px-10 gap-2 rounded-xl shadow-lg hover:shadow-primary/20 transition-all font-black"
                                >
                                    {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    SINCRONIZAR ROUTER
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Prompts Configuration Section */}
                    <Card className="shadow-xl border-t-4 border-t-primary/50 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <FileText className="w-32 h-32" />
                        </div>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">Prompts del Sistema</CardTitle>
                                    <CardDescription>Edita los prompts que utiliza el motor de inteligencia (AI Engine)</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {loadingPrompts ? (
                                <div className="flex justify-center py-10">
                                    <RefreshCcw className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold flex items-center gap-2">
                                            Prompt de Análisis de Noticias
                                        </label>
                                        <textarea
                                            value={analysisPrompt}
                                            onChange={(e) => setAnalysisPrompt(e.target.value)}
                                            placeholder="Escribe el system prompt principal de la plataforma..."
                                            className="w-full min-h-[300px] p-4 rounded-xl border border-input bg-muted/30 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-inner resize-y transition-all"
                                        />
                                        <p className="text-[10px] text-muted-foreground px-1">
                                            Este texto sustituye al `ANALYSIS_SYSTEM_PROMPT` por defecto en el pipeline AI. Déjalo en blanco para usar el prompt integrado.
                                        </p>
                                    </div>

                                    <div className="space-y-3 mt-8">
                                        <label className="text-sm font-bold flex items-center gap-2">
                                            Prompt de Comparador CrossMedia
                                        </label>
                                        <textarea
                                            value={crossmediaPrompt}
                                            onChange={(e) => setCrossmediaPrompt(e.target.value)}
                                            placeholder="Escribe el prompt para la comparación inter-medios..."
                                            className="w-full min-h-[150px] p-4 rounded-xl border border-input bg-muted/30 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-inner resize-y transition-all"
                                        />
                                        <p className="text-[10px] text-muted-foreground px-1">
                                            Este texto sustituye al `CROSSMEDIA_COMPARISON_PROMPT` por defecto. Déjalo en blanco para usar el prompt integrado.
                                        </p>
                                    </div>

                                    {promptStatus.message && (
                                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in zoom-in duration-300 ${promptStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-600' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
                                            {promptStatus.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                            <span className="text-sm font-bold">{promptStatus.message}</span>
                                        </div>
                                    )}

                                    <div className="pt-4 flex justify-end">
                                        <Button
                                            onClick={handleSavePrompts}
                                            disabled={savingPrompts}
                                            className="h-12 px-10 gap-2 rounded-xl shadow-lg hover:shadow-primary/20 transition-all font-black"
                                        >
                                            {savingPrompts ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            GUARDAR PROMPTS
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Operations Log Section */}
                    <Card className="shadow-xl border-t-4 border-t-blue-500/50 overflow-hidden relative group">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <Activity className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl">Operations Log</CardTitle>
                                        <CardDescription>Seguimiento de las últimas 30 peticiones del LLM Router</CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={fetchLogs} className="gap-2">
                                    <RefreshCcw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                                    Refrescar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-border/50 overflow-hidden bg-muted/5">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-muted/30 border-b border-border/50">
                                            <tr>
                                                <th className="px-4 py-2 font-black uppercase tracking-tighter">Tiempo</th>
                                                <th className="px-4 py-2 font-black uppercase tracking-tighter">Proveedor</th>
                                                <th className="px-4 py-2 font-black uppercase tracking-tighter">Modelo</th>
                                                <th className="px-4 py-2 font-black uppercase tracking-tighter">Estado</th>
                                                <th className="px-4 py-2 font-black uppercase tracking-tighter text-right">Latencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {llmLogs.length > 0 ? (
                                                llmLogs.map((log) => (
                                                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                                            {new Date(log.createdAt).toLocaleTimeString()}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.provider === 'gpt4free' ? 'bg-emerald-500/10 text-emerald-600' :
                                                                log.provider === 'gemini' ? 'bg-blue-500/10 text-blue-600' :
                                                                    log.provider === 'groq' ? 'bg-orange-500/10 text-orange-600' :
                                                                        'bg-purple-500/10 text-purple-600'
                                                                }`}>
                                                                {log.provider}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 font-bold truncate max-w-[120px]">{log.model}</td>
                                                        <td className="px-4 py-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-destructive'}`} />
                                                                <span className={log.status === 'success' ? 'text-green-600 font-bold' : 'text-destructive font-bold'}>
                                                                    {log.status === 'success' ? 'OK' : 'FAIL'}
                                                                </span>
                                                                {log.errorMessage && (
                                                                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]" title={log.errorMessage}>
                                                                        - {log.errorMessage}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono font-bold text-muted-foreground">
                                                            {log.latencyMs}ms
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                                                        No se registran operaciones recientes.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Status Column */}
                <div className="md:col-span-4 space-y-8">
                    {/* Platform Stats */}
                    <Card className="shadow-lg border-none bg-gradient-to-br from-muted/50 to-background hover:shadow-xl transition-all duration-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Terminal className="w-4 h-4" /> Plataforma
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
                                <span className="block text-[10px] uppercase tracking-tighter text-muted-foreground font-bold mb-1">APP URL</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono text-blue-500 font-bold truncate max-w-[150px]">{settings?.general?.app_url}</span>
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                </div>
                            </div>
                            <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
                                <span className="block text-[10px] uppercase tracking-tighter text-muted-foreground font-bold mb-1">API Port</span>
                                <span className="text-sm font-black tracking-widest">{settings?.general?.port}</span>
                            </div>
                            <div className="pt-2">
                                <div className="flex items-center gap-3 p-4 rounded-3xl bg-green-500/10 border border-green-500/30">
                                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-green-700 uppercase tracking-widest">Backend Status</span>
                                        <span className="text-[10px] font-bold text-green-600/70">CONNECTED & HEALTHY</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pipeline Info */}
                    <Card className="shadow-lg border-none bg-gradient-to-br from-primary/5 to-background border-r-4 border-r-primary/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Rendimiento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-muted-foreground">Ciclo de Ingesta (min)</label>
                                        <span className="text-[10px] font-mono opacity-50">Intervalo de refresco</span>
                                    </div>
                                    <Input
                                        type="number"
                                        value={ingestionCycle}
                                        onChange={(e) => setIngestionCycle(e.target.value)}
                                        className="h-8 bg-background/50 font-black text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-muted-foreground">Capacidad Máx (art/ciclo)</label>
                                        <span className="text-[10px] font-mono opacity-50">Límite por fuente</span>
                                    </div>
                                    <Input
                                        type="number"
                                        value={maxArticles}
                                        onChange={(e) => setMaxArticles(e.target.value)}
                                        className="h-8 bg-background/50 font-black text-sm"
                                    />
                                </div>

                                {pipelineStatus.message && (
                                    <div className={`text-[10px] font-bold p-2 rounded ${pipelineStatus.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {pipelineStatus.message}
                                    </div>
                                )}

                                <Button
                                    onClick={handleSavePipeline}
                                    disabled={savingPipeline}
                                    size="sm"
                                    className="w-full h-8 gap-2 font-black text-[10px] uppercase tracking-wider"
                                >
                                    {savingPipeline ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    ACTUALIZAR PIPELINE
                                </Button>
                            </div>

                            <div className="flex flex-col gap-1 py-3 border-t border-muted/50 mt-2">
                                <span className="text-xs font-bold text-muted-foreground italic">Router Cascade</span>
                                <div className="mt-1 space-y-1">
                                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-[9px] font-black text-emerald-600">P0</span>
                                        <span className="text-[10px] font-mono text-emerald-700 truncate">{settings?.pipeline?.gpt4free_model}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <span className="text-[9px] font-black text-blue-600">P1</span>
                                        <span className="text-[10px] font-mono text-blue-700 truncate">{settings?.pipeline?.google_model}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                        <span className="text-[9px] font-black text-orange-600">P2</span>
                                        <span className="text-[10px] font-mono text-orange-700 truncate">{settings?.pipeline?.groq_model}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        <span className="text-[9px] font-black text-purple-600">P3</span>
                                        <span className="text-[10px] font-mono text-purple-700 truncate">{settings?.pipeline?.openrouter_model}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Removed Ingestion Modules Toggle section */}
            </div>

            <div className="pt-8 border-t border-muted/50 flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted/50">
                        <SettingsIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-widest uppercase opacity-40">System Core</span>
                        <span className="text-xs font-bold">Newsyx v2.1.0-DYNAMIC | Build 2026-03-01</span>
                    </div>
                </div>
                <div className="flex gap-6">
                    <a href="#" className="text-xs font-bold flex items-center gap-1.5 hover:text-primary transition-all">
                        API Docs <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href="#" className="text-xs font-bold flex items-center gap-1.5 hover:text-primary transition-all">
                        Support <AlertCircle className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </div>
    );
};

