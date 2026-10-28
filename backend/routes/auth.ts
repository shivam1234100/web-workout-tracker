import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Resend email client (free tier: 100 emails/day)
// Only initialize if API key is available to avoid crash on startup
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Without a working email provider, the reset code is returned in the API response so the
// flow can be tested locally. Never do this in production: it would let anyone reset any account.
const exposeResetCode = process.env.NODE_ENV !== 'production';

const normalizeEmail = (email: unknown) => typeof email === 'string' ? email.trim().toLowerCase() : '';
// Case-insensitive match so accounts created before emails were normalized still work
const emailWhere = (email: string) => ({ email: { equals: email, mode: 'insensitive' as const } });


// Register
router.post('/register', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

        if (!email || !name || typeof password !== 'string') {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existingUser = await prisma.user.findFirst({ where: emailWhere(email) });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name }
        });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, height: user.height, weight: user.weight, gender: user.gender } });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ error: 'Error registering user' });
    }
});


// Login
router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!email || typeof password !== 'string') {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await prisma.user.findFirst({ where: emailWhere(email) });

        // Same message for unknown email and wrong password, so accounts can't be enumerated
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, height: user.height, weight: user.weight, gender: user.gender } });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Forgot Password - Generate and send reset code
router.post('/forgot-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await prisma.user.findFirst({ where: emailWhere(email) });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        // Generate a simple 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save code to database
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: resetCode,
                resetTokenExpiry
            }
        });

        let emailSent = false;

        // Send email via Resend if API key is configured
        if (process.env.RESEND_API_KEY && resend) {
            try {
                await resend.emails.send({
                    from: 'AI Workout Tracker <onboarding@resend.dev>',
                    to: email,
                    subject: 'Password Reset Code - AI Workout Tracker',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                            <h2 style="color: #2563eb;">Password Reset Request</h2>
                            <p>You requested a password reset for your AI Workout Tracker account.</p>
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                                <p style="margin: 0; color: #666;">Your reset code is:</p>
                                <h1 style="margin: 10px 0; color: #2563eb; letter-spacing: 5px;">${resetCode}</h1>
                            </div>
                            <p style="color: #666;">This code will expire in 1 hour.</p>
                            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                        </div>
                    `
                });
                emailSent = true;
                console.log("Reset email sent successfully to:", email);
            } catch (emailError) {
                console.log("Email sending failed:", emailError);
            }
        }

        if (!emailSent && !exposeResetCode) {
            return res.status(503).json({ error: 'Password reset email could not be sent. Please try again later.' });
        }

        res.json({
            message: emailSent
                ? 'Password reset code sent to your email'
                : 'Password reset code generated',
            resetCode: emailSent ? undefined : resetCode, // dev only: shown when no email was sent
            emailSent
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ error: 'Error generating reset code' });
    }
});

// Reset Password - Verify code and update password
router.post('/reset-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { token, newPassword } = req.body;

        if (!email || typeof token !== 'string' || !token || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Email, reset code and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Find user with valid reset code (scoped to the email so codes can't be guessed across accounts)
        const user = await prisma.user.findFirst({
            where: {
                ...emailWhere(email),
                resetToken: token.trim(),
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        // Hash new password and update user
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ error: 'Error resetting password' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req: any, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, height: true, weight: true, gender: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: any, res) => {
    try {
        const { name, height, weight, gender } = req.body;
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (height !== undefined) data.height = height ? parseFloat(height) : null;
        if (weight !== undefined) data.weight = weight ? parseFloat(weight) : null;
        if (gender !== undefined) data.gender = gender || null;

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data,
            select: { id: true, name: true, email: true, height: true, weight: true, gender: true }
        });
        res.json(user);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

export default router;
