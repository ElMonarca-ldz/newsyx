import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Users,
    UserPlus,
    Trash2,
    Shield,
    Mail,
    User as UserIcon,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const UserManagement = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('USER');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { token } = useAuth();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                throw new Error('Error al cargar usuarios');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, name, password, role })
            });

            if (res.ok) {
                setSuccess('Usuario creado con éxito');
                setEmail('');
                setName('');
                setPassword('');
                fetchUsers();
            } else {
                const data = await res.json();
                setError(data.error || 'Error al crear usuario');
            }
        } catch (err) {
            setError('Error de comunicación');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (id: string, userEmail: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${userEmail}?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setSuccess('Usuario eliminado');
                fetchUsers();
            } else {
                throw new Error('Error al eliminar');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Gestión de Accesos
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg font-medium">Control de usuarios y permisos del sistema.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create User Form */}
                <Card className="shadow-2xl border-none bg-muted/30 h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-black italic tracking-widest text-primary">
                            <UserPlus className="w-5 h-5" />
                            NUEVO ACCESO
                        </CardTitle>
                        <CardDescription>Crea un nuevo usuario en la plataforma.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <Input
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-background border-none shadow-sm h-11"
                            />
                            <Input
                                placeholder="Nombre Completo"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="bg-background border-none shadow-sm h-11"
                            />
                            <Input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-background border-none shadow-sm h-11"
                            />
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full h-11 rounded-md border-none bg-background px-3 text-sm shadow-sm"
                            >
                                <option value="USER">Usuario (Lectura)</option>
                                <option value="ADMIN">Administrador (Total)</option>
                            </select>
                            <Button
                                type="submit"
                                className="w-full h-11 font-black uppercase tracking-widest"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Usuario"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Users List */}
                <div className="lg:col-span-2 space-y-4">
                    {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center gap-3 animate-in fade-in">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center gap-3 animate-in fade-in">
                            <CheckCircle2 className="w-5 h-5" />
                            <p className="text-sm font-bold">{success}</p>
                        </div>
                    )}

                    <Card className="shadow-xl border-none overflow-hidden">
                        <CardContent className="p-0">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border/50">
                                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Rol</th>
                                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground border-slate-50 border-y">Usuario</th>
                                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground border-slate-50 border-y">Email</th>
                                        <th className="px-6 py-4 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground border-slate-50 border-y">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="py-20 text-center">
                                                <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/50" />
                                            </td>
                                        </tr>
                                    ) : users.map((u) => (
                                        <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${u.role === 'ADMIN' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                                                    }`}>
                                                    {u.role === 'ADMIN' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{u.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-muted-foreground font-mono text-xs">{u.email}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                                    className="text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg p-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
