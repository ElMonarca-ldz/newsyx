import React, { useEffect, useState } from 'react';
import {
    Plus, Trash2, Edit2, Check, X, Radio, Loader2,
    Play, Pause, RefreshCcw, AlertCircle, Twitter,
    TrendingUp, Users, Clock, Zap, ChevronDown, ChevronUp,
    Search, Filter
} from 'lucide-react';

import {
    TwitterProfile,
    TwitterStats,
    ScraperAccount,
    getTwitterProfiles,
    createTwitterProfile,
    updateTwitterProfile,
    toggleTwitterProfile,
    deleteTwitterProfile,
    scrapeNow,
    getTwitterStats,
    getScraperAccounts,
    createScraperAccount,
    updateScraperAccount,
    deleteScraperAccount,
} from '@/api/twitter';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

// ─── Constants ──────────────────────────────────────────────────────────
const TIERS = [
    { value: 'S', label: 'S — Organismo Oficial', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    { value: 'A', label: 'A — Político / Funcionario', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
    { value: 'B', label: 'B — Periodista / Medio', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { value: 'C', label: 'C — Analista / Economista', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40' },
];

const CATEGORIES = [
    { value: 'organismo', label: 'Organismo Oficial' },
    { value: 'politico', label: 'Político' },
    { value: 'funcionario', label: 'Funcionario' },
    { value: 'periodista', label: 'Periodista' },
    { value: 'medio', label: 'Medio' },
    { value: 'economista', label: 'Economista' },
    { value: 'analista', label: 'Analista' },
];

const POLITICAL_LEANS = [
    { value: '', label: 'No determinada' },
    { value: 'izquierda', label: 'Izquierda' },
    { value: 'centroizquierda', label: 'Centroizquierda' },
    { value: 'centro', label: 'Centro' },
    { value: 'centroderecha', label: 'Centroderecha' },
    { value: 'derecha', label: 'Derecha' },
];

const TIER_INTERVALS: Record<string, number> = { S: 5, A: 10, B: 15, C: 30 };

// ─── Tier Badge ─────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
    const cfg = TIERS.find(t => t.value === tier) || TIERS[3];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.color}`}>
            {cfg.value}
        </span>
    );
}

// ─── Stats Card ─────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = 'text-zinc-100' }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: string;
}) {
    return (
        <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-zinc-800/80 text-zinc-400">{icon}</div>
            <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
        </div>
    );
}

// ─── Profile Form (Add / Edit Modal) ────────────────────────────────────
interface ProfileFormData {
    username: string;
    tier: string;
    category: string;
    country: string;
    politicalLean: string;
    isStateAffiliated: boolean;
    scrapeEnabled: boolean;
    scrapeInterval: number;
    scrapeRTs: boolean;
    scrapeReplies: boolean;
    minTweetLength: number;
    actorNetworkSlug: string;
    notes: string;
}

const DEFAULT_FORM: ProfileFormData = {
    username: '',
    tier: 'C',
    category: 'analista',
    country: 'AR',
    politicalLean: '',
    isStateAffiliated: false,
    scrapeEnabled: true,
    scrapeInterval: 15,
    scrapeRTs: false,
    scrapeReplies: false,
    minTweetLength: 20,
    actorNetworkSlug: '',
    notes: '',
};

function ProfileModal({
    isOpen,
    onClose,
    onSubmit,
    editProfile,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ProfileFormData) => void;
    editProfile: TwitterProfile | null;
    loading: boolean;
}) {
    const [form, setForm] = useState<ProfileFormData>(DEFAULT_FORM);

    useEffect(() => {
        if (editProfile) {
            setForm({
                username: editProfile.username,
                tier: editProfile.tier,
                category: editProfile.category,
                country: editProfile.country,
                politicalLean: editProfile.politicalLean || '',
                isStateAffiliated: editProfile.isStateAffiliated,
                scrapeEnabled: editProfile.scrapeEnabled,
                scrapeInterval: editProfile.scrapeInterval,
                scrapeRTs: editProfile.scrapeRTs,
                scrapeReplies: editProfile.scrapeReplies,
                minTweetLength: editProfile.minTweetLength,
                actorNetworkSlug: editProfile.actorNetworkSlug || '',
                notes: editProfile.notes || '',
            });
        } else {
            setForm(DEFAULT_FORM);
        }
    }, [editProfile, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field: keyof ProfileFormData, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
        // Auto-set interval when tier changes
        if (field === 'tier' && !editProfile) {
            setForm(prev => ({ ...prev, [field]: value, scrapeInterval: TIER_INTERVALS[value] || 30 }));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-700">
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Twitter className="w-5 h-5 text-sky-400" />
                        {editProfile ? 'Editar Perfil' : 'Agregar Perfil'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
                    className="p-5 space-y-5"
                >
                    {/* Username */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username de X (sin @)</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => handleChange('username', e.target.value)}
                            placeholder="BancoCentral_AR"
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                       placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                            required
                            disabled={!!editProfile}
                        />
                    </div>

                    {/* Tier + Category row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tier de Prioridad</label>
                            <select
                                value={form.tier}
                                onChange={(e) => handleChange('tier', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                           focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                            >
                                {TIERS.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Categoría</label>
                            <select
                                value={form.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                           focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Country + Political Lean */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">País</label>
                            <input
                                type="text"
                                value={form.country}
                                onChange={(e) => handleChange('country', e.target.value)}
                                placeholder="AR"
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                           placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Orientación Política</label>
                            <select
                                value={form.politicalLean}
                                onChange={(e) => handleChange('politicalLean', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                           focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                            >
                                {POLITICAL_LEANS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Divider: Scraping Config */}
                    <div className="border-t border-zinc-700 pt-4">
                        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            Configuración de Scraping
                        </h3>

                        {/* Interval */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Intervalo (minutos)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={form.scrapeInterval}
                                    onChange={(e) => handleChange('scrapeInterval', parseInt(e.target.value) || 15)}
                                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                               focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                                />
                                <p className="text-xs text-zinc-600 mt-1">
                                    Default tier {form.tier}: cada {TIER_INTERVALS[form.tier] || 30} min
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Longitud Mínima Tweet
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="280"
                                    value={form.minTweetLength}
                                    onChange={(e) => handleChange('minTweetLength', parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                               focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="flex flex-wrap gap-4">
                            {([
                                { field: 'scrapeEnabled' as const, label: 'Scraping Activo' },
                                { field: 'scrapeRTs' as const, label: 'Incluir Retweets' },
                                { field: 'scrapeReplies' as const, label: 'Incluir Replies' },
                                { field: 'isStateAffiliated' as const, label: 'Afiliado Estatal' },
                            ]).map(({ field, label }) => (
                                <label key={field} className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => handleChange(field, !form[field])}
                                        className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer
                                                    ${form[field] ? 'bg-sky-500' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200
                                                         ${form[field] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                        {label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notas</label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Notas internas sobre este perfil..."
                            rows={2}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                       placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Actor Network Slug */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Actor Network Slug (opcional)</label>
                        <input
                            type="text"
                            value={form.actorNetworkSlug}
                            onChange={(e) => handleChange('actorNetworkSlug', e.target.value)}
                            placeholder="milei-javier"
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100
                                       placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded-lg
                                       hover:bg-zinc-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !form.username.trim()}
                            className="px-5 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg
                                       disabled:opacity-50 disabled:cursor-not-allowed transition-all
                                       flex items-center gap-2 shadow-lg shadow-sky-600/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {editProfile ? 'Guardar Cambios' : 'Agregar Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Account Form (Add / Edit Modal) ────────────────────────────────────
interface AccountFormData {
    username: string;
    password?: string;
    email?: string;
    emailPassword?: string;
    proxyUrl?: string;
    cookies?: string;
    tier: string;
    isActive: boolean;
}

const DEFAULT_ACCOUNT_FORM: AccountFormData = {
    username: '',
    password: '',
    email: '',
    emailPassword: '',
    proxyUrl: '',
    cookies: '',
    tier: 'standard',
    isActive: true,
};

function AccountModal({
    isOpen,
    onClose,
    onSubmit,
    editAccount,
    loading,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AccountFormData) => void;
    editAccount: ScraperAccount | null;
    loading: boolean;
}) {
    const [form, setForm] = useState<AccountFormData>(DEFAULT_ACCOUNT_FORM);

    useEffect(() => {
        if (editAccount) {
            setForm({
                username: editAccount.username,
                tier: editAccount.tier,
                isActive: editAccount.isActive,
                // Do not populate sensitive fields in UI if they aren't returned by safe endpoints.
                // The backend API handles partial updates.
                password: '',
                email: editAccount.email || '',
                emailPassword: '',
                proxyUrl: editAccount.proxyUrl || '',
                cookies: '',
            });
        } else {
            setForm(DEFAULT_ACCOUNT_FORM);
        }
    }, [editAccount, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field: keyof AccountFormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-zinc-700">
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        {editAccount ? 'Editar Cuenta Scraper' : 'Agregar Cuenta Scraper'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username (Requerido)</label>
                            <input
                                type="text"
                                value={form.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none"
                                required
                                disabled={!!editAccount}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tier (Pool)</label>
                            <select
                                value={form.tier}
                                onChange={(e) => handleChange('tier', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-sky-500 outline-none"
                            >
                                <option value="standard">Standard</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                placeholder={editAccount ? "(Sin cambios)" : ""}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none"
                                required={!editAccount}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Proxy URL (Opcional)</label>
                            <input
                                type="text"
                                value={form.proxyUrl}
                                onChange={(e) => handleChange('proxyUrl', e.target.value)}
                                placeholder="http://user:pass@img.com:8080"
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email (Opcional)</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Password (Opcional)</label>
                            <input
                                type="password"
                                value={form.emailPassword}
                                onChange={(e) => handleChange('emailPassword', e.target.value)}
                                placeholder={editAccount ? "(Sin cambios)" : ""}
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Cookies Netscape (Opcional)</label>
                        <textarea
                            value={form.cookies}
                            onChange={(e) => handleChange('cookies', e.target.value)}
                            placeholder={editAccount ? "(Dejar en blanco para no modificar)" : "Pega las cookies en formato Netscape..."}
                            rows={4}
                            className="w-full font-mono text-xs bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 outline-none resize-none"
                        />
                    </div>

                    {editAccount && (
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div
                                onClick={() => handleChange('isActive', !form.isActive)}
                                className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${form.isActive ? 'bg-sky-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-sm text-zinc-300">Cuenta Activa (Habilitada en Pool)</span>
                        </label>
                    )}

                    <div className="flex justify-end gap-3 pt-2 border-t border-zinc-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading || !form.username.trim()} className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {editAccount ? 'Guardar Cambios' : 'Agregar Cuenta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────
export function TwitterSources() {
    // Tabs state
    const [activeTab, setActiveTab] = useState<'profiles' | 'accounts'>('profiles');

    // Profiles state
    const [profiles, setProfiles] = useState<TwitterProfile[]>([]);
    const [stats, setStats] = useState<TwitterStats | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editProfile, setEditProfile] = useState<TwitterProfile | null>(null);

    // Accounts state
    const [accounts, setAccounts] = useState<ScraperAccount[]>([]);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [editAccount, setEditAccount] = useState<ScraperAccount | null>(null);

    // Shared state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Profiles filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTier, setFilterTier] = useState<string>('');
    const [scrapeLoading, setScrapeLoading] = useState<string | null>(null);

    // Fetch data
    const fetchData = async () => {
        try {
            setLoading(true);
            const [profs, st, accs] = await Promise.all([
                getTwitterProfiles(),
                getTwitterStats(),
                getScraperAccounts(),
            ]);
            setProfiles(profs);
            setStats(st);
            setAccounts(accs);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Handlers
    const handleSubmit = async (data: ProfileFormData) => {
        setSubmitting(true);
        try {
            if (editProfile) {
                await updateTwitterProfile(editProfile.id, data as any);
            } else {
                await createTwitterProfile(data as any);
            }
            setModalOpen(false);
            setEditProfile(null);
            await fetchData();
        } catch (e: any) {
            alert(e.message || 'Error guardando perfil');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, username: string) => {
        if (!confirm(`¿Eliminar perfil @${username} y todos sus tweets?`)) return;
        try {
            await deleteTwitterProfile(id);
            await fetchData();
        } catch {
            alert('Error eliminando perfil');
        }
    };

    const handleToggle = async (id: string, field: 'scrapeEnabled' | 'isActive', current: boolean) => {
        try {
            await toggleTwitterProfile(id, { [field]: !current });
            await fetchData();
        } catch {
            alert('Error actualizando perfil');
        }
    };

    const handleScrapeNow = async (id: string) => {
        setScrapeLoading(id);
        try {
            const result = await scrapeNow(id);
            alert(result.message || 'Scrape encolado');
        } catch {
            alert('Error al encolar scrape');
        } finally {
            setScrapeLoading(null);
        }
    };

    // Account Handlers
    const handleAccountSubmit = async (data: AccountFormData) => {
        setSubmitting(true);
        try {
            if (editAccount) {
                await updateScraperAccount(editAccount.id, data);
            } else {
                await createScraperAccount(data);
            }
            setAccountModalOpen(false);
            setEditAccount(null);
            await fetchData();
        } catch (e: any) {
            alert(e.message || 'Error guardando cuenta');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAccountDelete = async (id: string, username: string) => {
        if (!confirm(`¿Eliminar cuenta scraper @${username}?`)) return;
        try {
            await deleteScraperAccount(id);
            await fetchData();
        } catch {
            alert('Error eliminando cuenta');
        }
    };

    const handleAccountToggle = async (id: string, isActive: boolean) => {
        try {
            await updateScraperAccount(id, { isActive: !isActive });
            await fetchData();
        } catch {
            alert('Error actualizando cuenta');
        }
    };

    // Filter profiles
    const filtered = profiles.filter(p => {
        if (searchQuery && !p.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(p.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()))
            return false;
        if (filterTier && p.tier !== filterTier) return false;
        return true;
    });

    // Format date
    const timeAgo = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (secs < 60) return `hace ${secs}s`;
        if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
        if (secs < 86400) return `hace ${Math.floor(secs / 3600)}h`;
        return `hace ${Math.floor(secs / 86400)}d`;
    };

    return (
        <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                            <Twitter className="w-6 h-6 text-sky-400" />
                        </div>
                        X / Twitter Intelligence
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Monitoreo de perfiles de X como fuente de inteligencia primaria
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="px-3 py-2 text-sm border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                    {activeTab === 'profiles' ? (
                        <button
                            onClick={() => { setEditProfile(null); setModalOpen(true); }}
                            className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-sky-600/20"
                        >
                            <Plus className="w-4 h-4" /> Agregar Perfil
                        </button>
                    ) : (
                        <button
                            onClick={() => { setEditAccount(null); setAccountModalOpen(true); }}
                            className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                            <Plus className="w-4 h-4" /> Agregar Cuenta
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-zinc-800">
                <button
                    onClick={() => setActiveTab('profiles')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'profiles' ? 'border-sky-500 text-sky-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Twitter className="w-4 h-4" /> Perfiles de Monitoreo
                </button>
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'accounts' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Users className="w-4 h-4" /> Cuentas Scraper (Pool)
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <StatCard icon={<Users className="w-5 h-5" />} label="Perfiles" value={stats.totalProfiles} />
                    <StatCard icon={<Radio className="w-5 h-5" />} label="Activos" value={stats.activeProfiles} color="text-green-400" />
                    <StatCard icon={<Twitter className="w-5 h-5" />} label="Tweets Total" value={stats.totalTweets} />
                    <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Últimas 24h" value={stats.tweetsLast24h} color="text-sky-400" />
                    <StatCard icon={<Clock className="w-5 h-5" />} label="Pendientes" value={stats.pendingAnalysis} color="text-amber-400" />
                    <StatCard icon={<Check className="w-5 h-5" />} label="Analizados" value={stats.completedAnalysis} color="text-emerald-400" />
                </div>
            )}

            {/* Toolbar (Only show in Profiles tab for now) */}
            {activeTab === 'profiles' && (
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Buscar perfiles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100
                                   placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
                        <button
                            onClick={() => setFilterTier('')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${!filterTier ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            Todos
                        </button>
                        {TIERS.map(t => (
                            <button
                                key={t.value}
                                onClick={() => setFilterTier(filterTier === t.value ? '' : t.value)}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${filterTier === t.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {t.value}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-zinc-600">
                        {filtered.length} de {profiles.length} perfiles
                    </span>
                </div>
            )}

            {/* Profile Table */}
            {activeTab === 'profiles' && loading && !profiles.length ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
                </div>
            ) : activeTab === 'profiles' && filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                    <Twitter className="w-12 h-12 mb-3" />
                    <p className="text-lg font-medium">Sin perfiles configurados</p>
                    <p className="text-sm mt-1">Agregá perfiles de X para comenzar el monitoreo</p>
                    <button
                        onClick={() => { setEditProfile(null); setModalOpen(true); }}
                        className="mt-4 px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded-lg
                                   transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Primer Perfil
                    </button>
                </div>
            ) : activeTab === 'profiles' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Perfil</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tier</th>
                                <th className="text-left px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Categoría</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Intervalo</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tweets</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Pendientes</th>
                                <th className="text-left px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Último Scrape</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Estado</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                                >
                                    {/* Profile */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                <Twitter className="w-4 h-4 text-zinc-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-zinc-100">
                                                    {p.displayName || p.username}
                                                </p>
                                                <p className="text-xs text-zinc-500">@{p.username}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Tier */}
                                    <td className="text-center px-3 py-3">
                                        <TierBadge tier={p.tier} />
                                    </td>

                                    {/* Category */}
                                    <td className="px-3 py-3">
                                        <span className="text-xs text-zinc-400 capitalize">{p.category}</span>
                                    </td>

                                    {/* Interval */}
                                    <td className="text-center px-3 py-3">
                                        <span className="text-xs text-zinc-400">{p.scrapeInterval}m</span>
                                    </td>

                                    {/* Tweet Count */}
                                    <td className="text-center px-3 py-3">
                                        <span className="text-sm font-medium text-zinc-200">{p.tweetCount ?? 0}</span>
                                    </td>

                                    {/* Pending */}
                                    <td className="text-center px-3 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(p.pendingAnalysis ?? 0) > 0
                                            ? 'bg-amber-500/10 text-amber-400'
                                            : 'text-zinc-600'
                                            }`}>
                                            {p.pendingAnalysis ?? 0}
                                        </span>
                                    </td>

                                    {/* Last Scraped */}
                                    <td className="px-3 py-3">
                                        <span className="text-xs text-zinc-500">{timeAgo(p.lastScrapedAt)}</span>
                                        {p.consecutiveFails > 0 && (
                                            <span className="ml-1.5 text-xs text-red-400" title={`${p.consecutiveFails} fallos consecutivos`}>
                                                ⚠ {p.consecutiveFails}
                                            </span>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="text-center px-3 py-3">
                                        <button
                                            onClick={() => handleToggle(p.id, 'scrapeEnabled', p.scrapeEnabled)}
                                            className="group"
                                            title={p.scrapeEnabled ? 'Desactivar scraping' : 'Activar scraping'}
                                        >
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${p.scrapeEnabled
                                                ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'
                                                : 'bg-zinc-800 text-zinc-600 group-hover:bg-zinc-700'
                                                }`}>
                                                {p.scrapeEnabled
                                                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Activo</>
                                                    : <><Pause className="w-3 h-3" /> Pausado</>
                                                }
                                            </span>
                                        </button>
                                    </td>

                                    {/* Actions */}
                                    <td className="text-right px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleScrapeNow(p.id)}
                                                disabled={scrapeLoading === p.id}
                                                className="p-1.5 rounded-md text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10
                                                           transition-colors disabled:opacity-50"
                                                title="Scrape ahora"
                                            >
                                                {scrapeLoading === p.id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Zap className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                            <button
                                                onClick={() => { setEditProfile(p); setModalOpen(true); }}
                                                className="p-1.5 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10
                                                           transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id, p.username)}
                                                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10
                                                           transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB ACCOUNTS - TABLE */}
            {activeTab === 'accounts' && !loading && accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                    <Users className="w-12 h-12 mb-3" />
                    <p className="text-lg font-medium">Sin cuentas scraper</p>
                    <p className="text-sm mt-1">Agregá cuentas de X para alimentar el motor de scrapers</p>
                    <button
                        onClick={() => { setEditAccount(null); setAccountModalOpen(true); }}
                        className="mt-4 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Primer Cuenta
                    </button>
                </div>
            ) : activeTab === 'accounts' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Username</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tier</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Estado Login</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Requests</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Fallos</th>
                                <th className="text-left px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Último Uso</th>
                                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Health</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((a) => (
                                <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-zinc-200">@{a.username}</td>
                                    <td className="text-center px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{a.tier}</span></td>
                                    <td className="text-center px-3 py-3">
                                        <span className={`text-xs ${a.isLoggedIn ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {a.isLoggedIn ? 'Ok' : 'Sin Sesión'}
                                        </span>
                                    </td>
                                    <td className="text-center px-3 py-3 text-sm text-zinc-300">{a.totalRequests}</td>
                                    <td className="text-center px-3 py-3 text-sm">
                                        <span className={a.consecutiveFails > 0 ? 'text-red-400' : 'text-zinc-500'}>{a.consecutiveFails}</span>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-zinc-500">{timeAgo(a.lastUsedAt)}</td>
                                    <td className="text-center px-3 py-3">
                                        {a.circuitOpen ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-red-500 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20" title={`Bloqueado hasta ${a.circuitRetryAt}`}>
                                                <AlertCircle className="w-3 h-3" /> Circuito Abierto
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleAccountToggle(a.id, a.isActive)}
                                                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${a.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'}`}
                                            >
                                                {a.isActive ? 'Activa' : 'Pausada'}
                                            </button>
                                        )}
                                    </td>
                                    <td className="text-right px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => { setEditAccount(a); setAccountModalOpen(true); }} className="p-1.5 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Editar">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleAccountDelete(a.id, a.username)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            <ProfileModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditProfile(null); }}
                onSubmit={handleSubmit}
                editProfile={editProfile}
                loading={submitting}
            />

            <AccountModal
                isOpen={accountModalOpen}
                onClose={() => { setAccountModalOpen(false); setEditAccount(null); }}
                onSubmit={handleAccountSubmit}
                editAccount={editAccount}
                loading={submitting}
            />
        </div>
    );
}
