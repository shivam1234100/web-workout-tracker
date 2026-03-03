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
    const lowerQuery = query.toLowerCase().trim();

    // Build basic context from workouts
    let personalContext = '';
    if (workouts.length > 0) {
        const lastWorkout = workouts[0];
        const exerciseNames = lastWorkout.exercises?.map((e: any) => e.name).join(', ') || 'various exercises';
        const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60 * 24));
        personalContext = ` Based on your data, your last workout was ${daysSinceLastWorkout} days ago and included ${exerciseNames}.`;
    }

    // ── Conversational / Social responses ──
    if (/^(thanks|thank you|thx|ty|appreciate|cheers)/i.test(lowerQuery))
        return `You're welcome! 💪 Keep pushing and let me know if you need anything else. I'm here to help with your fitness journey!`;
    if (/^(hi|hey|hello|sup|yo|what's up|howdy|good morning|good evening|good afternoon)/i.test(lowerQuery))
        return `Hey there! 👋 Ready to crush it? Ask me about workout plans, specific exercises, nutrition, or your progress!${personalContext}`;
    if (/^(bye|goodbye|see you|later|gotta go|cya)/i.test(lowerQuery))
        return `See you next time! 🏋️ Stay consistent and keep logging your workouts. You've got this!`;
    if (/^(ok|okay|got it|understood|cool|nice|great|awesome|perfect|alright)/i.test(lowerQuery))
        return `Glad to help! Feel free to ask me anything else — whether it's about exercises, nutrition, recovery, or your workout plan. 💪`;
    if (/^(help|what can you do|how does this work)/i.test(lowerQuery))
        return `I'm your AI fitness coach! You can ask me about:\n• Workout plans for specific muscle groups\n• Exercise form and technique\n• Rest and recovery advice\n• What to train today\n• Nutrition basics\nJust type your question and I'll do my best to help! 🏋️`;
    if (/^(how are you|how're you|how do you do)/i.test(lowerQuery))
        return `I'm great, thanks for asking! 😊 I'm always here and ready to help you with your fitness goals. What can I help you with today?`;
    if (lowerQuery.includes('lol') || lowerQuery.includes('haha') || lowerQuery.includes('😂'))
        return `Haha glad I could make you smile! 😄 Anything else you'd like to know about your workouts or fitness?`;

    // ── Nutrition ──
    if (lowerQuery.includes('protein') || lowerQuery.includes('diet') || lowerQuery.includes('nutrition') || lowerQuery.includes('eat') || lowerQuery.includes('food') || lowerQuery.includes('meal'))
        return `For muscle growth, aim for 1.6-2.2g of protein per kg body weight daily. Eat balanced meals with lean proteins, complex carbs, and healthy fats. Stay hydrated!${personalContext}`;
    if (lowerQuery.includes('water') || lowerQuery.includes('hydrat'))
        return `Stay hydrated! Aim for at least 2-3 liters of water daily, more on workout days. Dehydration can significantly impact your performance. 💧`;
    if (lowerQuery.includes('supplement') || lowerQuery.includes('creatine') || lowerQuery.includes('whey'))
        return `Key evidence-based supplements: Creatine monohydrate (5g/day), whey protein for convenience, and Vitamin D if deficient. Focus on whole foods first!`;

    // ── Muscle Groups & Exercises ──
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
    if (lowerQuery.includes('core') || lowerQuery.includes('abs') || lowerQuery.includes('plank'))
        return `For a strong core, combine Planks, Hanging Leg Raises, and Cable Crunches. Train abs 2-3x per week with progressive overload.${personalContext}`;

    // ── Training advice ──
    if (lowerQuery.includes('today') || lowerQuery.includes('what should'))
        return `I'd suggest focusing on progressive overload — try adding 2.5kg or 1-2 extra reps to your main lifts.${personalContext}`;
    if (lowerQuery.includes('rest') || lowerQuery.includes('recover') || lowerQuery.includes('sleep'))
        return `Muscles grow while you rest. Aim for 7-9 hours of sleep and 1-2 rest days per week.${personalContext}`;
    if (lowerQuery.includes('warm') || lowerQuery.includes('stretch'))
        return `Always warm up! 5-10 min of light cardio, then dynamic stretches. Save static stretching for after your workout. This prevents injuries and improves performance.`;
    if (lowerQuery.includes('beginner') || lowerQuery.includes('start') || lowerQuery.includes('new'))
        return `Welcome! Start with compound movements: Squats, Bench Press, Deadlifts, Rows, and Overhead Press. Begin light, focus on form, and gradually increase weight each week. 3 full-body sessions per week is great for beginners!${personalContext}`;
    if (lowerQuery.includes('split') || lowerQuery.includes('routine') || lowerQuery.includes('program') || lowerQuery.includes('plan'))
        return `Popular splits:\n• Push/Pull/Legs (6 days) — great for intermediate+\n• Upper/Lower (4 days) — good balance\n• Full Body (3 days) — perfect for beginners\nPick one that fits your schedule and stick with it consistently!${personalContext}`;
    if (lowerQuery.includes('cardio') || lowerQuery.includes('running') || lowerQuery.includes('hiit'))
        return `Mix both LISS (walking, light jogging) and HIIT. 2-3 cardio sessions per week won't hurt your gains. Do cardio after lifting or on separate days.${personalContext}`;
    if (lowerQuery.includes('weight loss') || lowerQuery.includes('lose weight') || lowerQuery.includes('fat') || lowerQuery.includes('cut'))
        return `Fat loss = caloric deficit + strength training + adequate protein. Aim for a 300-500 calorie deficit, keep protein high (2g/kg), and lift heavy to preserve muscle.${personalContext}`;
    if (lowerQuery.includes('muscle') || lowerQuery.includes('bulk') || lowerQuery.includes('gain') || lowerQuery.includes('grow'))
        return `For muscle growth: caloric surplus (200-300 cal above maintenance), high protein (1.8-2.2g/kg), progressive overload, and 7-9 hours of sleep. Consistency is king! 👑${personalContext}`;

    // ── Fallback ──
    return `That's a great topic! I can help you with workout plans, exercise form, nutrition advice, and tracking your progress. Try asking about a specific muscle group, workout split, or fitness goal!${personalContext}`;
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
