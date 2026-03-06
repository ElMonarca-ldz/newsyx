import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Globe, Radio, Save, Search, Compass, AlertCircle, Loader2 } from 'lucide-react';

interface Source {
    id: string;
    feedId: string;
    url: string;
    nombre: string;
    dominio: string;
    pais: string;
    idioma: string;
    categoria: string;
    activo: boolean;
    ultimaIngesta: string | null;
    // A1 · Tier fields
    tier: number;
    propagandaRisk: number;
    stateAffiliated: boolean;
    politicalLean: string | null;
    countryOrigin: string;
    reachScope: string;
}

interface DiscoveredFeed {
    title: string;
    url: string;
    type: string;
}

const TierBadge = ({ tier, stateAffiliated, propagandaRisk }: { tier: number, stateAffiliated: boolean, propagandaRisk: number }) => {
    const configs: Record<number, { label: string, color: string, border: string }> = {
        1: { label: 'T1: Agencia', color: 'bg-blue-500/10 text-blue-400', border: 'border-blue-500/20' },
        2: { label: 'T2: Nacional', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20' },
        3: { label: 'T3: Especializado', color: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/20' },
        4: { label: 'T4: Agregador', color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/20' },
    };

    const config = configs[tier] || configs[3];

    return (
        <div className="flex flex-col gap-1 items-center">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.color} ${config.border} whitespace-nowrap`}>
                {config.label}
            </span>
            {stateAffiliated && (
                <span className="text-[8px] font-black uppercase tracking-tighter text-blue-500 bg-blue-500/5 px-1 border border-blue-500/10 rounded">
                    Estatal
                </span>
            )}
            {propagandaRisk > 0.6 && (
                <span className="text-[8px] font-black uppercase tracking-tighter text-rose-500 bg-rose-500/5 px-1 border border-rose-500/10 rounded">
                    Riesgo Alto
                </span>
            )}
        </div>
    );
};

export const Sources = () => {
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'discover'>('list');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        feedId: '',
        url: '',
        dominio: '',
        pais: 'AR',
        idioma: 'es',
        categoria: 'General',
        tier: 3,
        propagandaRisk: 0.3,
        stateAffiliated: false,
        politicalLean: '',
        countryOrigin: 'AR',
        reachScope: 'nacional'
    });

    // Discovery State
    const [discoveryQuery, setDiscoveryQuery] = useState('');
    const [discoveryType, setDiscoveryType] = useState<'domain' | 'topic'>('domain');
    const [discoveryCountry, setDiscoveryCountry] = useState('es-ES');
    const [discovering, setDiscovering] = useState(false);
    const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
    const [discoveryError, setDiscoveryError] = useState('');

    const fetchSources = () => {
        setLoading(true);
        fetch('http://localhost:4000/api/sources')
            .then(res => res.json())
            .then(data => {
                setSources(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching sources:', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchSources();
    }, []);

    const handleToggle = (id: string, currentStatus: boolean) => {
        const nextStatus = !currentStatus;
        setSources(prev => prev.map(s => s.id === id ? { ...s, activo: nextStatus } : s));

        fetch(`http://localhost:4000/api/sources/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nextStatus })
        }).then(res => {
            if (!res.ok) throw new Error('ServerError');
            return res.json();
        }).then(updated => {
            setSources(prev => prev.map(s => s.id === id ? updated : s));
        }).catch(err => {
            setSources(prev => prev.map(s => s.id === id ? { ...s, activo: currentStatus } : s));
            alert('No se pudo actualizar el estado de la fuente.');
        });
    };

    const handleDelete = (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta fuente?')) return;
        fetch(`http://localhost:4000/api/sources/${id}`, { method: 'DELETE' })
            .then(() => setSources(prev => prev.filter(s => s.id !== id)))
            .catch(err => console.error('Error deleting source:', err));
    };

    const handleEdit = (source: Source) => {
        setFormData({
            nombre: source.nombre,
            feedId: source.feedId,
            url: source.url,
            dominio: source.dominio,
            pais: source.pais,
            idioma: source.idioma,
            categoria: source.categoria,
            tier: source.tier || 3,
            propagandaRisk: source.propagandaRisk || 0.3,
            stateAffiliated: source.stateAffiliated || false,
            politicalLean: source.politicalLean || '',
            countryOrigin: source.countryOrigin || source.pais || 'AR',
            reachScope: source.reachScope || 'nacional'
        });
        setEditingId(source.id);
        setIsAdding(true);
        setActiveTab('list');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const method = editingId ? 'PUT' : 'POST';
        const url = editingId
            ? `http://localhost:4000/api/sources/${editingId}`
            : 'http://localhost:4000/api/sources';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => res.json())
            .then(data => {
                if (editingId) {
                    setSources(prev => prev.map(s => s.id === editingId ? data : s));
                } else {
                    setSources(prev => [...prev, data]);
                }
                setIsAdding(false);
                setEditingId(null);
                setFormData({
                    nombre: '', feedId: '', url: '', dominio: '', pais: 'AR', idioma: 'es', categoria: 'General',
                    tier: 3, propagandaRisk: 0.3, stateAffiliated: false, politicalLean: '', countryOrigin: 'AR', reachScope: 'nacional'
                });
            })
            .catch(err => console.error('Error saving source:', err));
    };

    const handleDiscover = async (e: React.FormEvent) => {
        e.preventDefault();
        setDiscovering(true);
        setDiscoveryError('');
        setDiscoveredFeeds([]);

        try {
            if (discoveryType === 'domain') {
                const res = await fetch('http://localhost:4000/api/sources/discover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: discoveryQuery })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error discovering feeds');
                setDiscoveredFeeds(data.feeds || []);
                if (data.feeds.length === 0) setDiscoveryError('No se encontraron feeds RSS en este dominio.');
            } else {
                const res = await fetch('http://localhost:4000/api/sources/generate-topic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic: discoveryQuery, country_hl: discoveryCountry })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error generating topic feed');
                setDiscoveredFeeds([data]);
            }
        } catch (err: any) {
            setDiscoveryError(err.message);
        } finally {
            setDiscovering(false);
        }
    };

    const QuickAddFeed = (feed: DiscoveredFeed) => {
        // Prepare pre-filled form and jump to adding
        const isTopic = feed.type === 'google_news_topic';
        let domainStr = 'discovery';
        try {
            domainStr = new URL(feed.url).hostname.replace('www.', '');
        } catch (e) { }

        let paisISO = 'ES';
        let idiomaISO = 'es';
        if (isTopic) {
            const parts = discoveryCountry.split('-');
            if (parts.length === 2) {
                idiomaISO = parts[0];
                paisISO = parts[1];
            }
        }

        setFormData({
            nombre: feed.title || (isTopic ? `Tema: ${discoveryQuery}` : 'Nuevo Medio'),
            feedId: isTopic ? `topic_${discoveryQuery.replace(/\s+/g, '_').toLowerCase()}` : `feed_${domainStr.split('.')[0]}`,
            url: feed.url,
            dominio: isTopic ? 'news.google.com' : domainStr,
            pais: paisISO,
            idioma: idiomaISO,
            categoria: isTopic ? discoveryQuery : 'General',
            tier: isTopic ? 4 : 3,
            propagandaRisk: 0.3,
            stateAffiliated: false,
            politicalLean: '',
            countryOrigin: paisISO,
            reachScope: isTopic ? 'global' : 'nacional'
        });
        setEditingId(null);
        setActiveTab('list');
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Gestión de Fuentes</h2>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">Administra y descubre canales de noticias automatizados.</p>
                </div>
                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 shadow-sm">
                    <button
                        onClick={() => { setActiveTab('list'); setIsAdding(false); }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${activeTab === 'list' && !isAdding ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Radio className="w-4 h-4" /> Mis Fuentes
                    </button>
                    <button
                        onClick={() => { setActiveTab('discover'); setIsAdding(false); }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${activeTab === 'discover' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Compass className="w-4 h-4" /> Explorador RSS
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('list');
                            setIsAdding(true);
                            setEditingId(null);
                            setFormData({
                                nombre: '', feedId: '', url: '', dominio: '', pais: 'AR', idioma: 'es', categoria: 'General',
                                tier: 3, propagandaRisk: 0.3, stateAffiliated: false, politicalLean: '', countryOrigin: 'AR', reachScope: 'nacional'
                            });
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ml-2 ${isAdding && !editingId ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background hover:bg-muted text-foreground border shadow-sm'}`}
                    >
                        {isAdding && !editingId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isAdding && !editingId ? 'Cancelar' : 'Añadir Manual'}
                    </button>
                </div>
            </div>

            {/* Discovery Tab */}
            {activeTab === 'discover' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                    <div className="bg-gradient-to-br from-primary/10 via-background to-muted/20 border-2 border-primary/20 rounded-2xl p-6 md:p-8 shadow-xl">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="text-center space-y-2 mb-8">
                                <h3 className="text-2xl font-black flex items-center justify-center gap-3">
                                    <Search className="w-6 h-6 text-primary" /> Descubrimiento Inteligente
                                </h3>
                                <p className="text-muted-foreground text-sm">Encuentra los canales RSS oficiales de cualquier medio o crea canales infinitos basados en temáticas globales.</p>
                            </div>

                            <form onSubmit={handleDiscover} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Término de Búsqueda</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                            <input
                                                required
                                                type="text"
                                                value={discoveryQuery}
                                                onChange={e => setDiscoveryQuery(e.target.value)}
                                                placeholder={discoveryType === 'domain' ? "ej. elpais.com, clarin.com..." : "ej. Inteligencia Artificial, Bitcoin..."}
                                                className="w-full bg-background border-2 border-muted pl-11 pr-4 py-3 rounded-xl text-sm font-medium focus:border-primary focus:ring-0 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Tipo de Búsqueda</label>
                                        <div className="flex bg-muted/40 p-1 rounded-xl border-2 border-muted">
                                            <button
                                                type="button"
                                                onClick={() => setDiscoveryType('domain')}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${discoveryType === 'domain' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                                            >
                                                Dominio HTTP
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDiscoveryType('topic')}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${discoveryType === 'topic' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                                            >
                                                Tema / Keyword
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {discoveryType === 'topic' && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Región e Idioma</label>
                                        <select
                                            value={discoveryCountry}
                                            onChange={e => setDiscoveryCountry(e.target.value)}
                                            className="w-full bg-background border-2 border-muted px-4 py-3 rounded-xl text-sm font-medium focus:border-primary focus:ring-0 outline-none transition-all"
                                        >
                                            <option value="es-ES">España (Español)</option>
                                            <option value="es-AR">Argentina (Español)</option>
                                            <option value="es-MX">México (Español)</option>
                                            <option value="es-CO">Colombia (Español)</option>
                                            <option value="en-US">Estados Unidos (Inglés)</option>
                                            <option value="en-GB">Reino Unido (Inglés)</option>
                                        </select>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={discovering || !discoveryQuery}
                                    className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl shadow-lg hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    {discovering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Compass className="w-5 h-5" />}
                                    {discovering ? 'Buscando Canales...' : 'INICIAR DESCUBRIMIENTO'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Discovery Results */}
                    {discoveryError && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{discoveryError}</p>
                        </div>
                    )}

                    {discoveredFeeds.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h4 className="text-lg font-bold flex items-center gap-2">
                                <span className="bg-green-500/20 text-green-600 px-2 py-0.5 rounded-md text-sm">{discoveredFeeds.length}</span>
                                Canales Encontrados
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {discoveredFeeds.map((feed, idx) => (
                                    <div key={idx} className="bg-card border-border border rounded-2xl p-5 hover:border-primary/50 transition-all hover:shadow-lg flex flex-col justify-between group">
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between items-start gap-2">
                                                <h5 className="font-bold text-foreground line-clamp-2 leading-tight">{feed.title}</h5>
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-muted px-2 py-1 rounded-sm text-primary flex-shrink-0">
                                                    {feed.type}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-mono break-all line-clamp-3 bg-muted/40 p-2 rounded-lg">
                                                {feed.url}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => QuickAddFeed(feed)}
                                            className="w-full py-2.5 bg-primary/10 text-primary font-bold text-sm rounded-xl opacity-80 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-all flex justify-center items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Agregar a mis Fuentes
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List Tab (Includes add/edit form) */}
            {activeTab === 'list' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-300">
                    {isAdding && (
                        <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                {editingId ? 'Editando Fuente' : 'Configuración de Nueva Fuente'}
                            </h3>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre del Medio / Tema</label>
                                    <input required className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" placeholder="Ej: El País" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID del Feed (slug)</label>
                                    <input required className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-mono focus:border-primary outline-none transition-all" placeholder="ej: elpais-espana" value={formData.feedId} onChange={e => setFormData({ ...formData, feedId: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dominio Base</label>
                                    <input required className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" placeholder="elpais.com" value={formData.dominio} onChange={e => setFormData({ ...formData, dominio: e.target.value })} />
                                </div>
                                <div className="space-y-2 lg:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL Absoluta del RSS</label>
                                    <input required className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-mono focus:border-primary outline-none transition-all" placeholder="https://elpais.com/rss/..." value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categoría Principal</label>
                                    <input className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" placeholder="General, Economía, etc." value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">País (ISO Code)</label>
                                    <input className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-bold uppercase focus:border-primary outline-none transition-all" placeholder="ES, AR, MX..." value={formData.pais} onChange={e => setFormData({ ...formData, pais: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Idioma (ISO Code)</label>
                                    <input className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-bold lowercase focus:border-primary outline-none transition-all" placeholder="es, en, pt..." value={formData.idioma} onChange={e => setFormData({ ...formData, idioma: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tier (1-4)</label>
                                    <select className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" value={formData.tier} onChange={e => setFormData({ ...formData, tier: parseInt(e.target.value) })}>
                                        <option value={1}>Tier 1: Agencia / Verificado</option>
                                        <option value={2}>Tier 2: Nacional Consolidado</option>
                                        <option value={3}>Tier 3: Especializado / Digital</option>
                                        <option value={4}>Tier 4: Agregador / Poca confianza</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Riesgo Propaganda (0-1)</label>
                                    <input type="number" step="0.1" min="0" max="1" className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" value={formData.propagandaRisk} onChange={e => setFormData({ ...formData, propagandaRisk: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alcance</label>
                                    <select className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" value={formData.reachScope} onChange={e => setFormData({ ...formData, reachScope: e.target.value })}>
                                        <option value="local">Local</option>
                                        <option value="provincial">Provincial</option>
                                        <option value="nacional">Nacional</option>
                                        <option value="regional">Regional</option>
                                        <option value="global">Global</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Orientación Política</label>
                                    <input className="w-full bg-background border-2 border-muted rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-all" placeholder="izq, centro, der..." value={formData.politicalLean} onChange={e => setFormData({ ...formData, politicalLean: e.target.value })} />
                                </div>
                                <div className="space-y-2 flex items-center gap-2 pt-6">
                                    <input type="checkbox" id="stateAffiliated" checked={formData.stateAffiliated} onChange={e => setFormData({ ...formData, stateAffiliated: e.target.checked })} className="w-4 h-4 rounded border-muted text-primary focus:ring-primary" />
                                    <label htmlFor="stateAffiliated" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">Afiliado al Estado</label>
                                </div>
                                <div className="space-y-2 flex items-end">
                                    <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-3 text-sm rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/30 transition-all">
                                        <Save className="w-4 h-4" /> {editingId ? 'ACTUALIZAR GUARDADO' : 'CONFIRMAR FUENTE'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b">
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Medio Configurado</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Detalles Técnicos</th>
                                    <th className="px-4 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Tier</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Estado de Ingesta</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Actividad</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-right">Opciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {sources.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-16 text-center text-muted-foreground font-medium">
                                            <Compass className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                            No tienes fuentes manuales o descubiertas.<br />¡Ve al Explorador RSS para empezar!
                                        </td>
                                    </tr>
                                ) : (
                                    sources.map(source => (
                                        <tr key={source.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-black text-xl border border-primary/20 shadow-sm">
                                                        {source.nombre.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-base">{source.nombre}</div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                            <Globe className="w-3 h-3" /> <span className="font-medium">{source.dominio}</span>
                                                            <span className="mx-1 opacity-50">•</span>
                                                            <span className="font-black text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase">{source.pais}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-[10px] font-bold font-mono bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/50 w-fit">{source.feedId}</div>
                                                    <div className="text-[10px] text-muted-foreground/80 truncate max-w-[280px] font-mono hover:text-foreground transition-colors cursor-help" title={source.url}>{source.url}</div>
                                                </div>
                                            </td>
                                            {/* A1 · Tier badge */}
                                            <td className="px-4 py-5">
                                                <TierBadge tier={source.tier ?? 3} stateAffiliated={source.stateAffiliated} propagandaRisk={source.propagandaRisk} />
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggle(source.id, source.activo)}
                                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${source.activo ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-muted border border-border/50'} hover:scale-105 active:scale-95`}
                                                    >
                                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${source.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <Radio className={`w-3.5 h-3.5 ${source.activo ? 'text-green-500 animate-pulse' : 'text-muted-foreground/50'}`} />
                                                    <span className={source.activo ? 'text-foreground' : 'text-muted-foreground/50'}>
                                                        {source.ultimaIngesta ? new Date(source.ultimaIngesta).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pendiente'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-20 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(source)} className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="Editar Fuente">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(source.id)} className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all" title="Eliminar Fuente permanentemente">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
