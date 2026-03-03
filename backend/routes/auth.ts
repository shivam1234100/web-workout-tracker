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

// DEV ONLY: Delete all users (remove this in production!)
router.delete('/delete-all-users', async (req, res) => {
    try {
        // First delete all workouts and exercises (due to relations)
        await prisma.exercise.deleteMany({});
        await prisma.workout.deleteMany({});
        await prisma.user.deleteMany({});
        res.json({ message: 'All users deleted successfully' });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: 'Error deleting users' });
    }
});


// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
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
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(401).json({ error: 'Wrong password' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, height: user.height, weight: user.weight, gender: user.gender } });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Forgot Password - Generate and send reset code
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        // Generate a simple 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save code to database
        await prisma.user.update({
            where: { email },
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

        // Return response - include code for demo if email not configured
        res.json({
            message: emailSent
                ? 'Password reset code sent to your email'
                : 'Password reset code generated',
            resetCode: emailSent ? undefined : resetCode, // Only show code if email wasn't sent
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
        const { token, newPassword } = req.body;

        // Find user with valid reset code
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
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
