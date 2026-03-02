import express from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize OpenAI — uses OPENAI_API_KEY from .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock_key',
});

// ─────────────────────────────────────────────
// HELPER: Build a user training profile from workout data
// This is the "secret sauce" — converts raw DB data into
// a structured text block that the LLM can reason about.
// ─────────────────────────────────────────────
function buildUserProfile(workouts: any[]): string {
    if (workouts.length === 0) {
        return "This is a new user with no workout history yet. Give general beginner-friendly advice.";
    }

    const totalWorkouts = workouts.length;
    const exerciseFrequency: Record<string, number> = {};
    const exercisePRs: Record<string, { weight: number; reps: number }> = {};
    const exerciseHistory: Record<string, { date: string; weight: number; reps: number }[]> = {};
    const recentWorkouts: string[] = [];
    let totalVolume = 0;

    for (const workout of workouts) {
        const workoutDate = new Date(workout.date).toLocaleDateString();
        const exerciseNames: string[] = [];

        for (const exercise of workout.exercises) {
            const sets = typeof exercise.sets === 'string' ? JSON.parse(exercise.sets) : exercise.sets;
            exerciseNames.push(exercise.name);

            // Track frequency
            exerciseFrequency[exercise.name] = (exerciseFrequency[exercise.name] || 0) + 1;

            for (const set of sets) {
                const weight = Number(set.weight) || 0;
                const reps = Number(set.reps) || 0;
                totalVolume += weight * reps;

                // Track PRs (max weight)
                if (!exercisePRs[exercise.name] || weight > exercisePRs[exercise.name].weight) {
                    exercisePRs[exercise.name] = { weight, reps };
                }

                // Track progression history
                if (!exerciseHistory[exercise.name]) exerciseHistory[exercise.name] = [];
                exerciseHistory[exercise.name].push({ date: workoutDate, weight, reps });
            }
        }

        // Summarize recent workouts (top 5)
        if (recentWorkouts.length < 5) {
            const duration = workout.startTime && workout.endTime
                ? `${Math.round((new Date(workout.endTime).getTime() - new Date(workout.startTime).getTime()) / 60000)} min`
                : 'N/A';
            recentWorkouts.push(`${workoutDate} — ${workout.name || 'Workout'} (${exerciseNames.join(', ')}) [${duration}]`);
        }
    }

    // Days since last workout
    const lastWorkoutDate = new Date(workouts[0].date);
    const daysSinceLastWorkout = Math.floor((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));

    // Top 5 exercises by frequency
    const topExercises = Object.entries(exerciseFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => `${name} (${count}x)`)
        .join(', ');

    // PRs formatted
    const prs = Object.entries(exercisePRs)
        .filter(([, pr]) => pr.weight > 0)
        .slice(0, 8)
        .map(([name, pr]) => `${name}: ${pr.weight}kg × ${pr.reps} reps`)
        .join('\n  ');

    // Detect progression trends for top exercises
    const trends: string[] = [];
    for (const [name, history] of Object.entries(exerciseHistory).slice(0, 3)) {
        if (history.length >= 2) {
            const recent = history[0].weight;
            const older = history[history.length - 1].weight;
            if (recent > older) trends.push(`${name}: ↑ improving (${older}kg → ${recent}kg)`);
            else if (recent < older) trends.push(`${name}: ↓ declining (${older}kg → ${recent}kg)`);
            else trends.push(`${name}: → consistent at ${recent}kg`);
        }
    }

    return `
- Total workouts logged: ${totalWorkouts}
- Days since last workout: ${daysSinceLastWorkout}
- Total volume lifted: ${totalVolume.toLocaleString()} kg
- Most trained exercises: ${topExercises}
- Personal Records:
  ${prs || 'No weight data recorded yet'}
- Progression Trends:
  ${trends.length > 0 ? trends.join('\n  ') : 'Not enough data yet'}
- Last 5 workouts:
  ${recentWorkouts.map(w => `• ${w}`).join('\n  ')}
`.trim();
}

// ─────────────────────────────────────────────
// HELPER: Generate offline fallback response
// Used when OpenAI API is unavailable
// ─────────────────────────────────────────────
function generateOfflineResponse(query: string, workouts: any[]): string {
    const lowerQuery = query.toLowerCase();

    // Build basic context from workouts
    let personalContext = '';
    if (workouts.length > 0) {
        const lastWorkout = workouts[0];
        const exerciseNames = lastWorkout.exercises?.map((e: any) => e.name).join(', ') || 'various exercises';
        const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60 * 24));
        personalContext = ` Based on your data, your last workout was ${daysSinceLastWorkout} days ago and included ${exerciseNames}.`;
    }

    // Muscle Groups & Exercises
    if (lowerQuery.includes('chest') || lowerQuery.includes('bench') || lowerQuery.includes('push up'))
        return `For chest development, focus on Bench Press, Incline Dumbbell Press, and Chest Flyes. Aim for 3-4 sets of 8-12 reps.${personalContext}`;
    if (lowerQuery.includes('back') || lowerQuery.includes('pull') || lowerQuery.includes('row'))
        return `Great back exercises include Pull-ups, Barbell Rows, and Lat Pulldowns. Focus on squeezing your shoulder blades together.${personalContext}`;
    if (lowerQuery.includes('leg') || lowerQuery.includes('squat') || lowerQuery.includes('lunge'))
        return `Never skip leg day! Squats, Lunges, and Romanian Deadlifts are foundational. Drive through your heels.${personalContext}`;
    if (lowerQuery.includes('arm') || lowerQuery.includes('bicep') || lowerQuery.includes('tricep'))
        return `For arms, try supersetting Bicep Curls with Tricep Extensions for maximum pump.${personalContext}`;
    if (lowerQuery.includes('shoulder') || lowerQuery.includes('delts'))
        return `Target all three heads: Overhead Press for mass, Lateral Raises for width, Face Pulls for rear delts.${personalContext}`;

    // Training advice
    if (lowerQuery.includes('today') || lowerQuery.includes('what should'))
        return `I'd suggest focusing on progressive overload — try adding 2.5kg or 1-2 extra reps to your main lifts.${personalContext}`;
    if (lowerQuery.includes('rest') || lowerQuery.includes('recover') || lowerQuery.includes('sleep'))
        return `Muscles grow while you rest. Aim for 7-9 hours of sleep and 1-2 rest days per week.${personalContext}`;

    // Fallback
    return `Great question! Focus on the fundamentals: progressive overload, consistency, and proper form. Try asking about a specific muscle group or exercise!${personalContext}`;
}

// ═════════════════════════════════════════════
// POST /ai/chat — Send message, get personalized AI response
// ═════════════════════════════════════════════
router.post('/chat', authenticateToken, async (req: any, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        // 1. Fetch user's workout history (last 20 workouts)
        const workouts = await prisma.workout.findMany({
            where: { userId },
            include: { exercises: true },
            orderBy: { date: 'desc' },
            take: 20,
        });

        // 2. Build the user training profile
        const userProfile = buildUserProfile(workouts);

        // 3. Fetch recent chat history for conversation context (last 20 messages)
        const chatHistory = await prisma.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            take: 20,
        });

        // 4. Save the user's message to DB
        await prisma.chatMessage.create({
            data: { role: 'user', content: message, userId },
        });

        // 5. Build the personalized system prompt
        const systemPrompt = `You are a personalized AI fitness coach named "AI Coach". You have access to this specific user's real workout data. Use it to give specific, data-driven, personalized advice.

USER'S TRAINING PROFILE:
${userProfile}

INSTRUCTIONS:
- Reference their actual exercises, weights, and rep counts when relevant
- Notice and comment on trends (improving/plateauing/declining performance)
- Suggest progressive overload based on their recent numbers (e.g., "try 72.5kg next time")
- Be encouraging, supportive, but data-driven
- If they ask what to train, consider what they trained recently and suggest something different
- Keep responses concise (2-4 paragraphs max) and actionable
- Use emojis sparingly for a friendly tone
- If they have no workout data, give general beginner-friendly advice and encourage them to log their first workout`;

        // 6. Build messages array for OpenAI
        const openaiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
            ...chatHistory.map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
            { role: 'user', content: message },
        ];

        let assistantContent: string;

        try {
            // 7. Call OpenAI
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: openaiMessages,
                max_tokens: 500,
                temperature: 0.7,
            });

            assistantContent = completion.choices[0].message.content || "I couldn't generate a response. Please try again!";
        } catch (aiError: any) {
            console.log('OpenAI API error, using offline fallback:', aiError.message);
            // Fallback to offline response
            assistantContent = generateOfflineResponse(message, workouts);
        }

        // 8. Save the assistant's response to DB
        await prisma.chatMessage.create({
            data: { role: 'assistant', content: assistantContent, userId },
        });

        res.json({ response: assistantContent });
    } catch (error: any) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// ═════════════════════════════════════════════
// GET /ai/history — Fetch chat history
// ═════════════════════════════════════════════
router.get('/history', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const messages = await prisma.chatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });

        res.json(messages);
    } catch (error: any) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// ═════════════════════════════════════════════
// DELETE /ai/history — Clear all chat history
// ═════════════════════════════════════════════
router.delete('/history', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        await prisma.chatMessage.deleteMany({
            where: { userId },
        });

        res.json({ message: 'Chat history cleared' });
    } catch (error: any) {
        console.error('History clear error:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

export default router;
