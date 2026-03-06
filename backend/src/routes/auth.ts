import { Router } from 'express';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Mock login for now - REPLACE with bcrypt comparison in production
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Passwords should be hashed! This is just a placeholder.
        // if (!bcrypt.compareSync(password, user.passwordHash)) ...
        // For now accept any password if user exists for demo purposes or check mock hash

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
            expiresIn: JWT_EXPIRY as any,
        });

        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/register', async (req, res) => {
    // Implementation for register
    res.status(501).json({ error: "Not implemented" });
});

export default router;
