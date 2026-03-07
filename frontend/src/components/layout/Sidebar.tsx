import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Globe,
    BarChart2,
    Radio,
    Settings,
    Radar,
    Twitter,
    Newspaper,
    Shield,
    LogOut,
    User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
    to: string;
    icon: any;
    label: string;
    feature?: string;
    adminOnly?: boolean;
}

const navItems: NavItem[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/explorer', icon: Globe, label: 'Explorador' },
    { to: '/crossmedia', icon: BarChart2, label: 'Cross-Media' },
    { to: '/situation-monitor', icon: Radar, label: 'Situation Monitor' },
    { to: '/sources', icon: Radio, label: 'Fuentes' },
    { to: '/twitter-sources', icon: Twitter, label: 'X / Twitter' },
    { to: '/articles-management', icon: Newspaper, label: 'Artículos' },
    { to: '/user-management', icon: Shield, label: 'Accesos', adminOnly: true },
    { to: '/settings', icon: Settings, label: 'Configuración' },
];

export const Sidebar = () => {
    const { logout, isAdmin, user } = useAuth();
    const location = useLocation();

    const filteredNavItems = navItems.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        return true;
    });

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col z-50">
            <div className="p-6">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]">
                        <Radar className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <span className="text-xl font-black tracking-tighter text-white italic">NEWSYX</span>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.to ||
                        (item.to !== '/' && location.pathname.startsWith(item.to));

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden text-sm",
                                isActive
                                    ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
                            )}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                                isActive ? "text-primary" : "text-zinc-500"
                            )} />
                            <span className="font-bold tracking-tight uppercase italic">{item.label}</span>
                            {isActive && (
                                <div className="absolute left-0 top-0 w-1 h-full bg-primary" />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto border-t border-zinc-900 space-y-4">
                <div className="px-4 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Usuario</p>
                    <p className="text-xs font-bold text-zinc-200 truncate">{user?.name || 'Administrador'}</p>
                    <p className="text-[10px] text-zinc-600 font-mono truncate">{user?.email}</p>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors text-sm"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-bold tracking-tight uppercase">Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
};
