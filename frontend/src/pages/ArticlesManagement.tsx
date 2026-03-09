import React, { useEffect, useState, useMemo } from 'react';
import {
    Trash2,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertCircle,
    Filter,
    CheckSquare,
    Square,
    ExternalLink,
    Newspaper
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const ArticlesManagement = () => {
    const [articles, setArticles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalArticles, setTotalArticles] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const limit = 15;

    const fetchArticles = async () => {
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: searchTerm
            });
            const res = await fetch(`${API_BASE_URL}/analysis?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setArticles(data.data);
                setTotalPages(data.pagination.totalPages);
                setTotalArticles(data.pagination.total);
            } else {
                throw new Error('Error al cargar artículos');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, [page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchArticles();
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === articles.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(articles.map(a => a.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.length} artículos?`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/analysis/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });

            if (res.ok) {
                setSelectedIds([]);
                if (articles.length === selectedIds.length && page > 1) {
                    setPage(prev => prev - 1);
                } else {
                    fetchArticles();
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Error al eliminar');
            }
        } catch (err) {
            alert('Error de red al eliminar');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Gestión de Artículos
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg">Administra, filtra y elimina artículos de la base de datos.</p>
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        variant="destructive"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="gap-2 shadow-lg hover:shadow-destructive/20 transition-all font-black uppercase tracking-tighter"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Eliminar {selectedIds.length} Seleccionados
                    </Button>
                )}
            </div>

            <Card className="shadow-xl overflow-hidden border-t-4 border-t-primary/50">
                <CardHeader className="pb-4">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por título..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 bg-muted/20 border-none focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
                            />
                        </div>
                        <Button type="submit" className="h-11 px-6 font-bold uppercase tracking-widest bg-primary hover:bg-primary/90">
                            Buscar
                        </Button>
                    </form>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="px-6 py-4 w-10">
                                        <button onClick={toggleSelectAll} className="p-1 hover:bg-muted rounded transition-colors">
                                            {selectedIds.length === articles.length && articles.length > 0
                                                ? <CheckSquare className="w-5 h-5 text-primary" />
                                                : <Square className="w-5 h-5 text-muted-foreground" />
                                            }
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Artículo</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Fuente</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground">Fecha</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Calidad</th>
                                    <th className="px-6 py-4 font-black text-xs uppercase tracking-widest text-muted-foreground text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading && articles.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                            <p className="mt-2 text-muted-foreground font-medium">Cargando base de datos...</p>
                                        </td>
                                    </tr>
                                ) : articles.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <Newspaper className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                                            <p className="text-muted-foreground font-medium">No se encontraron artículos.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    articles.map((article) => (
                                        <tr key={article.id} className={`hover:bg-muted/10 transition-colors group ${selectedIds.includes(article.id) ? 'bg-primary/5' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button onClick={() => toggleSelect(article.id)} className="p-1 hover:bg-muted rounded transition-colors">
                                                    {selectedIds.includes(article.id)
                                                        ? <CheckSquare className="w-5 h-5 text-primary" />
                                                        : <Square className="w-5 h-5 text-muted-foreground" />
                                                    }
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1" title={article.titular}>
                                                        {article.titular}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{article.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold uppercase tracking-tighter">
                                                    {article.fuente}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                                {new Date(article.fechaExtraccion).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] text-white ${(article.scoreCalidad || 0) > 0.7 ? 'bg-emerald-500' :
                                                            (article.scoreCalidad || 0) > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                                                        } shadow-sm`}>
                                                        {((article.scoreCalidad || 0) * 10).toFixed(1)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/explorer/${article.fuente}/${article.slug || article.id}`}
                                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all inline-block"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 bg-muted/10 border-t border-border/50 flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Mostrando {articles.length} de {totalArticles} artículos
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="h-8 w-8 p-0 rounded-lg"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-xs font-bold font-mono px-3">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="h-8 w-8 p-0 rounded-lg"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
        </div>
    );
};
