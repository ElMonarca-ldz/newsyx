import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    BarChart2,
    Globe,
    LayoutDashboard,
    Settings,
    Radio,
    Radar,
    Twitter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { config } from '@/config/variants';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/explorer', icon: Globe, label: 'Explorador', feature: 'advancedAnalysis' },
    { to: '/crossmedia', icon: BarChart2, label: 'Cross-Media', feature: 'advancedAnalysis' },
    { to: '/situation-monitor', icon: Radar, label: 'Situation Monitor', feature: 'situationMonitor' },
    { to: '/sources', icon: Radio, label: 'Fuentes', feature: 'sourceManagement' },
    { to: '/twitter-sources', icon: Twitter, label: 'X / Twitter', feature: 'sourceManagement' },
    { to: '/settings', icon: Settings, label: 'Configuración' },
];

export const Sidebar = () => {
    return (
        <div className="w-64 border-r bg-card h-full flex flex-col">
            <div className="p-6 h-16 flex items-center border-b">
                <h1 className="text-xl font-bold tracking-tight text-primary">Newsyx</h1>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {navItems.filter(item => !item.feature || (config.features as any)[item.feature]).map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t">
                <div className="text-xs text-muted-foreground">
                    v2.0.0 | <span className="text-green-500">Online</span>
                </div>
            </div>
        </div>
    );
};
