import { Router } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';

const router = Router();

// Middleware to ensure user is ADMIN
const isAdmin = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Administrador' });
    }
};

// Get all users
router.get('/', authenticate, isAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Create user
router.post('/', authenticate, isAdmin, async (req, res) => {
    const { email, password, name, role } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
                role: role || 'USER'
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Delete user
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

export default router;
