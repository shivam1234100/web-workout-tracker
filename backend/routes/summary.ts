import express from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ─────────────────────────────────────────────
// HELPER: Compute weekly stats from workouts
// ─────────────────────────────────────────────
function computeWeeklyStats(workouts: any[]) {
    let totalSets = 0;
    let totalVolume = 0;
    let totalReps = 0;
    const exerciseMap: Record<string, { count: number; maxWeight: number }> = {};

    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            const sets = typeof exercise.sets === 'string' ? JSON.parse(exercise.sets) : exercise.sets;

            if (!exerciseMap[exercise.name]) {
                exerciseMap[exercise.name] = { count: 0, maxWeight: 0 };
            }
            exerciseMap[exercise.name].count += 1;

            for (const set of sets) {
                totalSets++;
                const weight = Number(set.weight) || 0;
                const reps = Number(set.reps) || 0;
                totalVolume += weight * reps;
                totalReps += reps;

                if (weight > exerciseMap[exercise.name].maxWeight) {
                    exerciseMap[exercise.name].maxWeight = weight;
                }
            }
        }
    }

    // Calculate total workout duration
    let totalDurationMin = 0;
    for (const workout of workouts) {
        if (workout.startTime && workout.endTime) {
            totalDurationMin += Math.round(
                (new Date(workout.endTime).getTime() - new Date(workout.startTime).getTime()) / 60000
            );
        }
    }

    return {
        totalWorkouts: workouts.length,
        totalSets,
        totalReps,
        totalVolume,
        totalDurationMin,
        exercises: exerciseMap,
    };
}

// ─────────────────────────────────────────────
// HELPER: Generate offline summary when OpenAI unavailable
// ─────────────────────────────────────────────
function generateOfflineSummary(stats: any): string {
    if (stats.totalWorkouts === 0) {
        return "📊 **Weekly Summary**\n\nNo workouts logged this week. Time to get back on track! Start with a light session and build momentum. Consistency beats intensity every time. 💪";
    }

    const topExercises = Object.entries(stats.exercises as Record<string, { count: number; maxWeight: number }>)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 3)
        .map(([name, data]) => `${name} (${data.count}x, max ${data.maxWeight}kg)`)
        .join(', ');

    return `📊 **Weekly Training Summary**

🏋️ **${stats.totalWorkouts} workout${stats.totalWorkouts === 1 ? '' : 's'}** completed this week
⏱️ Total training time: ${stats.totalDurationMin} minutes
📈 Total volume: ${stats.totalVolume.toLocaleString()} kg
💪 Total sets: ${stats.totalSets} | Total reps: ${stats.totalReps}

**Top exercises:** ${topExercises}

Keep up the great work! Focus on progressive overload next week — try adding 2.5kg to your main lifts or squeezing out 1-2 extra reps. 🔥`;
}

// ═════════════════════════════════════════════
// POST /summary/weekly — Generate weekly training summary
// ═════════════════════════════════════════════
router.post('/weekly', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        // Calculate week boundaries (Monday to Sunday) in the user's timezone.
        // tzOffset is the client's Date#getTimezoneOffset() in minutes (e.g. -330 for IST).
        const tzOffset = Number(req.body?.tzOffset) || 0;
        const local = new Date(Date.now() - tzOffset * 60000); // UTC fields now read as local time
        const dayOfWeek = local.getUTCDay(); // 0=Sun, 1=Mon...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        local.setUTCDate(local.getUTCDate() + mondayOffset);
        local.setUTCHours(0, 0, 0, 0);

        const weekStart = new Date(local.getTime() + tzOffset * 60000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

        // Check if a summary already exists for this week
        const existingSummary = await prisma.weeklySummary.findFirst({
            where: {
                userId,
                weekStart: { gte: weekStart },
                weekEnd: { lte: new Date(weekEnd.getTime() + 1000) },
            },
        });

        // Fetch this week's workouts
        const workouts = await prisma.workout.findMany({
            where: {
                userId,
                date: { gte: weekStart, lte: weekEnd },
            },
            include: { exercises: true },
            orderBy: { date: 'desc' },
        });

        // Compute stats
        const stats = computeWeeklyStats(workouts);

        // Reuse the saved summary unless the week's workouts changed since it was generated
        if (existingSummary && existingSummary.stats === JSON.stringify(stats)) {
            res.json(existingSummary);
            return;
        }

        let summaryText: string;

        try {
            if (!openai) throw new Error('OPENAI_API_KEY not configured');

            // Generate AI summary
            const statsText = JSON.stringify(stats, null, 2);
            const workoutDetails = workouts.map(w => {
                const exercises = w.exercises.map(e => {
                    const sets = typeof e.sets === 'string' ? JSON.parse(e.sets) : e.sets;
                    return `${e.name}: ${sets.map((s: any) => `${s.weight}kg×${s.reps}`).join(', ')}`;
                }).join('\n  ');
                return `${new Date(w.date).toLocaleDateString()} — ${w.name}\n  ${exercises}`;
            }).join('\n\n');

            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional fitness coach writing a concise weekly training summary for your client. Be encouraging, specific, and data-driven. Use emojis for visual appeal. Format with markdown. Keep it to 3-5 short paragraphs.`,
                    },
                    {
                        role: 'user',
                        content: `Generate a weekly training summary based on this data:

STATS:
${statsText}

WORKOUT DETAILS:
${workoutDetails || 'No workouts this week.'}

Include:
1. A performance overview (workouts, volume, time)
2. Highlights (best exercises, heaviest lifts)
3. Areas for improvement or focus next week
4. A motivational closing line`,
                    },
                ],
                max_tokens: 500,
                temperature: 0.7,
            });

            summaryText = completion.choices[0].message.content || generateOfflineSummary(stats);
        } catch (aiError: any) {
            console.log('OpenAI API error for summary, using offline fallback:', aiError.message);
            summaryText = generateOfflineSummary(stats);
        }

        // Save to DB (update this week's summary if one exists)
        const summary = existingSummary
            ? await prisma.weeklySummary.update({
                where: { id: existingSummary.id },
                data: { summary: summaryText, stats: JSON.stringify(stats) },
            })
            : await prisma.weeklySummary.create({
                data: {
                    userId,
                    weekStart,
                    weekEnd,
                    summary: summaryText,
                    stats: JSON.stringify(stats),
                },
            });

        res.json(summary);
    } catch (error: any) {
        console.error('Weekly summary error:', error);
        res.status(500).json({ error: 'Failed to generate weekly summary' });
    }
});

// ═════════════════════════════════════════════
// GET /summary/weekly — Fetch all past weekly summaries
// ═════════════════════════════════════════════
router.get('/weekly', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const summaries = await prisma.weeklySummary.findMany({
            where: { userId },
            orderBy: { weekStart: 'desc' },
        });

        res.json(summaries);
    } catch (error: any) {
        console.error('Summary fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch summaries' });
    }
});

export default router;
