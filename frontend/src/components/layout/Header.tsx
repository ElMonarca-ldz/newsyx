import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export const Header = () => {
    return (
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
            <div className="w-96 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Buscar noticias, análisis..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border-none rounded-md focus:ring-1 focus:ring-primary outline-none"
                />
            </div>
            <div className="flex items-center gap-4">
                <button className="p-2 text-muted-foreground hover:text-foreground relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium">
                    <User className="w-4 h-4" />
                </div>
            </div>
        </header>
    );
};
