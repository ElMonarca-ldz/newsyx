import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, TrendingUp, AlertTriangle, FileText, Power, PowerOff } from 'lucide-react';
import { Button } from "@/components/ui/button"

const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="pt-2">
            <div className="text-2xl font-bold">{value}</div>
            <p className={`text-xs ${trend === 'up' ? 'text-green-500' : 'text-red-500'} flex items-center mt-1`}>
                {change}
                <span className="text-muted-foreground ml-1">vs anterior</span>
            </p>
        </div>
    </div>
);

export const Dashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [isIngestionEnabled, setIsIngestionEnabled] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('http://localhost:4000/api/dashboard/stats').then(res => res.json()),
            fetch('http://localhost:4000/api/settings').then(res => res.json())
        ])
            .then(([statsData, settingsData]) => {
                setStats(statsData);
                setIsIngestionEnabled(settingsData.pipeline?.global_ingestion_enabled !== false);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching dashboard data:', err);
                setLoading(false);
            });
    }, []);

    const toggleIngestion = async () => {
        const newState = !isIngestionEnabled;
        setIsIngestionEnabled(newState); // Optimistic UI update
        try {
            await fetch('http://localhost:4000/api/settings/ingestion/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
        } catch (error) {
            console.error('Error saving ingestion state:', error);
            setIsIngestionEnabled(!newState); // Revert on failure
        }
    };

    if (loading) return <div className="p-8">Cargando dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Resumen de actividad y métricas de análisis en tiempo real.</p>
                </div>
                <div className="flex items-center gap-3 bg-card border shadow-sm p-3 rounded-xl">
                    <div className="flex flex-col text-right">
                        <span className="text-sm font-bold leading-none">News Engine</span>
                        <span className="text-xs text-muted-foreground mt-1">{isIngestionEnabled ? "Recolectando" : "Pausado"}</span>
                    </div>
                    <Button
                        variant={isIngestionEnabled ? "default" : "secondary"}
                        size="icon"
                        onClick={toggleIngestion}
                        className={`rounded-full h-10 w-10 transition-all ${isIngestionEnabled ? "bg-green-500 hover:bg-green-600 shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}
                        title={isIngestionEnabled ? "Detener recolección global" : "Iniciar recolección global"}
                    >
                        {isIngestionEnabled ? <Power className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Noticias Analizadas"
                    value={stats?.total || 0}
                    change="+5%"
                    icon={FileText}
                    trend="up"
                />
                <StatCard
                    title="Completadas"
                    value={stats?.completed || 0}
                    change="+2%"
                    icon={Activity}
                    trend="up"
                />
                <StatCard
                    title="Pendientes"
                    value={stats?.pending || 0}
                    change="-1"
                    icon={TrendingUp}
                    trend="up"
                />
                <StatCard
                    title="Fallidas"
                    value={stats?.failed || 0}
                    change="+2%"
                    icon={AlertTriangle}
                    trend="down"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm h-[400px] p-6">
                    <h3 className="font-semibold text-lg mb-4">Volumen de Ingesta (Últimos 7 días)</h3>
                    <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-lg border border-dashed">
                        <span className="text-muted-foreground">Gráfico de barras aquí (Recharts)</span>
                    </div>
                </div>
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm h-[400px] p-6">
                    <h3 className="font-semibold text-lg mb-4">Alertas Recientes</h3>
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                                <div className="w-2 h-2 mt-2 rounded-full bg-red-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium leading-none">Posible desinformación detectada</p>
                                    <p className="text-xs text-muted-foreground mt-1">Fuente: El Blog Dato • hace 2h</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

