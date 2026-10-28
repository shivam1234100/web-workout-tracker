import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { aiEnabled, streamChat, ChatTurn } from '../lib/llm';

const router = express.Router();
const prisma = new PrismaClient();

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_MESSAGES = 30;   // messages from the current conversation sent to the model
const PAST_CHAT_NOTES = 15;    // user messages from earlier conversations, used as long-term memory
const WORKOUTS_IN_CONTEXT = 40;

const isObjectId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

const parseSets = (sets: unknown): any[] => {
    if (Array.isArray(sets)) return sets;
    if (typeof sets === 'string') { try { return JSON.parse(sets); } catch { return []; } }
    return [];
};

const formatSet = (set: any) => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) || 0;
    return weight > 0 ? `${weight}kg×${reps}` : `${reps} reps`;
};

// ─────────────────────────────────────────────
// Dates in the user's timezone. tzOffset is the browser's Date#getTimezoneOffset() (e.g. -330 for IST).
// ─────────────────────────────────────────────
const toLocal = (date: Date, tzOffset: number) => new Date(date.getTime() - tzOffset * 60000);
const localDayNumber = (date: Date, tzOffset: number) => Math.floor(toLocal(date, tzOffset).getTime() / 86400000);
const formatLocalDate = (date: Date, tzOffset: number, withYear = false) =>
    toLocal(date, tzOffset).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
    });
const daysAgoLabel = (date: Date, tzOffset: number) => {
    const days = localDayNumber(new Date(), tzOffset) - localDayNumber(date, tzOffset);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

// ─────────────────────────────────────────────
// Turns the user's profile and workout log into a compact brief the model can reason about
// ─────────────────────────────────────────────
function buildTrainingBrief(user: any, workouts: any[], tzOffset: number): string {
    const sections: string[] = [];
    const now = new Date();

    sections.push(`## Today\n${formatLocalDate(now, tzOffset, true)}`);

    const profile: string[] = [`- Name: ${user?.name || 'unknown'}`];
    if (user?.gender) profile.push(`- Gender: ${user.gender}`);
    if (user?.height) profile.push(`- Height: ${user.height} cm`);
    if (user?.weight) profile.push(`- Body weight: ${user.weight} kg`);
    if (user?.height && user?.weight) profile.push(`- BMI: ${(user.weight / (user.height / 100) ** 2).toFixed(1)}`);
    sections.push(`## Profile\n${profile.join('\n')}`);

    if (workouts.length === 0) {
        sections.push('## Training log\nNo workouts logged yet. Treat them as a beginner unless they say otherwise, and encourage them to log their first workout in the app.');
        return sections.join('\n\n');
    }

    const today = localDayNumber(now, tzOffset);
    const inLastDays = (n: number) => workouts.filter(w => today - localDayNumber(new Date(w.date), tzOffset) < n).length;
    sections.push(`## Training summary
- Workouts logged (most recent ${workouts.length} shown): last 7 days ${inLastDays(7)}, last 30 days ${inLastDays(30)}
- Last workout: ${daysAgoLabel(new Date(workouts[0].date), tzOffset)}`);

    // Per-exercise history. Workouts arrive newest first, so the first time we see an exercise is its latest session.
    type ExerciseStats = { sessions: number; lastDate: Date; lastSets: string; best: { weight: number; reps: number }; oldestTop: number; latestTop: number };
    const stats = new Map<string, ExerciseStats>();
    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            const sets = parseSets(exercise.sets).filter(s => (Number(s.reps) || 0) > 0);
            if (sets.length === 0) continue;
            const top = Math.max(...sets.map(s => Number(s.weight) || 0));
            const bestSet = sets.reduce((a, b) => ((Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a));
            const entry = stats.get(exercise.name);
            if (!entry) {
                stats.set(exercise.name, {
                    sessions: 1, lastDate: new Date(workout.date), lastSets: sets.map(formatSet).join(', '),
                    best: { weight: Number(bestSet.weight) || 0, reps: Number(bestSet.reps) || 0 }, oldestTop: top, latestTop: top,
                });
            } else {
                entry.sessions++;
                entry.oldestTop = top;
                if ((Number(bestSet.weight) || 0) > entry.best.weight) entry.best = { weight: Number(bestSet.weight) || 0, reps: Number(bestSet.reps) || 0 };
            }
        }
    }
    const exerciseLines = [...stats.entries()].slice(0, 15).map(([name, s]) => {
        const trend = s.sessions < 2 || s.latestTop === 0 ? ''
            : s.latestTop > s.oldestTop ? `, trend ↑ ${s.oldestTop}→${s.latestTop}kg`
                : s.latestTop < s.oldestTop ? `, trend ↓ ${s.oldestTop}→${s.latestTop}kg` : ', trend flat';
        const best = s.best.weight > 0 ? `, best ${s.best.weight}kg×${s.best.reps}` : '';
        return `- ${name}: ${s.sessions} session${s.sessions === 1 ? '' : 's'}, last ${daysAgoLabel(s.lastDate, tzOffset)} (${s.lastSets})${best}${trend}`;
    });
    sections.push(`## Exercises (most recently trained first)\n${exerciseLines.join('\n')}`);

    const recent = workouts.slice(0, 8).map(w => {
        const minutes = w.startTime && w.endTime ? Math.round((new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000) : null;
        const exercises = w.exercises
            .map((e: any) => `${e.name} ${parseSets(e.sets).filter(s => (Number(s.reps) || 0) > 0).map(formatSet).join(', ') || '(no sets logged)'}`)
            .join('; ');
        return `- ${formatLocalDate(new Date(w.date), tzOffset)} (${daysAgoLabel(new Date(w.date), tzOffset)}) "${w.name}"${minutes ? `, ${minutes} min` : ''}: ${exercises}`;
    });
    sections.push(`## Recent workouts\n${recent.join('\n')}`);

    return sections.join('\n\n');
}

function buildSystemPrompt(user: any, workouts: any[], pastNotes: any[], tzOffset: number): string {
    const memory = pastNotes.length > 0
        ? pastNotes.map(m => `- ${formatLocalDate(new Date(m.createdAt), tzOffset)}: "${m.content.slice(0, 300)}"`).join('\n')
        : 'No earlier conversations.';

    return `You are "AI Coach", the personal strength and fitness coach inside the AI Workout Tracker app. You are talking with ${user?.name || 'the user'}, and you have their real profile and training log below.

How to coach:
- Answer the question they actually asked, first and directly, then add the most useful supporting detail.
- Be specific: name exercises, sets × reps, loads in kg, rest times and progressions. Base loads on their logged numbers when you have them (e.g. "you did 60kg×10 last time, so try 62.5kg for 8–10").
- Use their data: notice trends, stalls, muscle groups they haven't trained recently, and how long since their last session. Never invent numbers they haven't logged; if something you need is missing, say so or ask.
- Remember what they told you in earlier chats (injuries, goals, schedule, equipment) and take it into account without making them repeat it.
- Pain and injuries: never tell them to push through pain. Offer pain-free alternatives and modifications (range of motion, load, tempo, exercise swaps). Recommend a doctor or physiotherapist for sharp, worsening or persistent pain, swelling, or numbness. You are a coach, not a medical professional, so don't diagnose.
- Nutrition: practical, evidence-based guidance (protein, calories, hydration, sleep); no extreme diets.
- If the answer depends on something ambiguous, ask one short clarifying question.
- Tone: warm, encouraging and direct, like a knowledgeable coach messaging a client. No filler and don't repeat their question back.
- Format with Markdown: short paragraphs, bullet lists for plans, **bold** for key numbers. Don't use tables or code blocks. A workout plan lists each exercise with sets × reps (and load when you can). Keep casual replies short; go into detail when they ask for a plan or an explanation.
- Stay on fitness, training, recovery, nutrition and using this app; politely steer unrelated requests back.

${buildTrainingBrief(user, workouts, tzOffset)}

## Things they said in earlier chats (most recent last)
${memory}`;
}

// ─────────────────────────────────────────────
// Offline fallback, used when no Gemini key is configured or the API is unreachable.
// Checks are ordered so the most important topic in a message wins (pain before greetings).
// ─────────────────────────────────────────────
function generateOfflineResponse(query: string, workouts: any[]): string {
    const q = query.toLowerCase().trim();
    // Matches at the start of a word, so "eat" doesn't fire on "great" and "rest" not on "interest"
    const has = (...words: string[]) => words.some(w => new RegExp(`\\b${w}`).test(q));

    let personalContext = '';
    if (workouts.length > 0) {
        const last = workouts[0];
        const names = last.exercises?.map((e: any) => e.name).join(', ') || 'various exercises';
        const days = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000);
        const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
        personalContext = `\n\nFrom your log: your last workout was ${when} (${names}).`;
    }

    // ── Pain & injuries ──
    if (has('pain', 'hurt', 'injur', 'ache', 'aching', 'sore', 'tweak', 'strain', 'sprain')) {
        if (has('knee')) {
            return `Don't train through knee pain. You can still have a productive leg day by shifting to **hip-dominant, knee-friendly** work:

- **Hip thrusts or glute bridges**: 3 × 10–12
- **Romanian deadlifts** (light to moderate): 3 × 8–10
- **Lying or seated hamstring curls**: 3 × 10–12
- **Box squats to a pain-free depth** (only if they don't hurt): 3 × 8
- **Calf raises**: 3 × 15

Skip deep squats, lunges, jumping and leg extensions for today. Use the 0–10 pain rule: stay at **3/10 or below**, and stop any exercise that makes it worse.

If the pain is sharp, comes with swelling or clicking, or lasts more than a week or two, get it checked by a doctor or physiotherapist.${personalContext}`;
        }
        if (has('back')) {
            return `Take back pain seriously. Skip heavy deadlifts, bent-over rows and loaded spinal flexion for now. Gentle movement usually helps more than complete rest:

- **Walking**: 15–20 minutes
- **Bird dogs**: 3 × 8 per side
- **Dead bugs**: 3 × 8 per side
- **Glute bridges**: 3 × 12
- **Machine or chest-supported work** for upper body

Keep everything pain-free. See a doctor promptly if the pain spreads down a leg, or comes with numbness or weakness.${personalContext}`;
        }
        if (has('shoulder')) {
            return `For shoulder pain, avoid overhead pressing, dips and wide-grip bench for now. Instead:

- **Neutral-grip dumbbell press** in a pain-free range: 3 × 10
- **Face pulls**: 3 × 15
- **Band external rotations**: 3 × 15
- **Chest-supported rows**: 3 × 10

Lighter weights and slower reps are your friend. If it hurts at rest or at night, or you've lost strength, see a physiotherapist.${personalContext}`;
        }
        return `Don't train through pain. Work around it: pick exercises that don't aggravate the area, lower the weight, and shorten the range of motion. Keep discomfort at **3/10 or below**.

If the pain is sharp, comes with swelling or numbness, or doesn't improve within a week or two, see a doctor or physiotherapist. Tell me which body part it is and I'll suggest specific swaps.${personalContext}`;
    }

    // ── Nutrition ──
    if (has('protein', 'diet', 'nutrition', 'eat', 'food', 'meal'))
        return `For muscle growth, aim for **1.6–2.2 g of protein per kg** of body weight daily, spread over 3–5 meals. Build meals around lean protein, complex carbs, fruit and vegetables, and healthy fats.${personalContext}`;
    if (has('water', 'hydrat'))
        return `Aim for **2–3 litres of water** a day, more on training days and in hot weather. Even mild dehydration lowers strength and endurance. 💧`;
    if (has('supplement', 'creatine', 'whey'))
        return `The supplements with the best evidence are **creatine monohydrate (3–5 g/day)**, **whey protein** for convenience, and **vitamin D** if you're deficient. Get the basics right first: food, sleep and consistent training.`;

    // ── Training goals ──
    if (has('weight loss', 'lose weight', 'fat loss', 'lose fat', 'cut'))
        return `Fat loss comes down to a **300–500 kcal daily deficit**, high protein (~2 g/kg), and continuing to lift heavy so you keep your muscle. Add daily steps (8–10k) before adding lots of cardio.${personalContext}`;
    if (has('bulk', 'gain muscle', 'build muscle', 'grow'))
        return `To build muscle: a small surplus (**+200–300 kcal**), **1.8–2.2 g/kg protein**, progressive overload on compound lifts, and **7–9 hours of sleep**.${personalContext}`;
    if (has('split', 'routine', 'program', 'plan'))
        return `Popular splits:
- **Full body, 3 days**: best for beginners
- **Upper/Lower, 4 days**: a good balance of frequency and recovery
- **Push/Pull/Legs, 6 days**: for intermediate lifters with time to train

Choose the one you can stick to consistently.${personalContext}`;

    // ── Muscle groups ──
    if (has('leg', 'squat', 'lunge', 'quad', 'hamstring', 'glute'))
        return `A solid leg day:
- **Squats**: 4 × 6–8
- **Romanian deadlifts**: 3 × 8–10
- **Walking lunges**: 3 × 10 per leg
- **Leg curls**: 3 × 12
- **Calf raises**: 3 × 15

Rest 2–3 minutes on the big lifts.${personalContext}`;
    if (has('chest', 'bench', 'push up', 'push-up'))
        return `For chest: **bench press 4 × 6–8**, **incline dumbbell press 3 × 8–10**, **cable or dumbbell flyes 3 × 12**. Add a little weight or a rep each week.${personalContext}`;
    if (has('back', 'pull', 'row', 'lat'))
        return `For back: **pull-ups or lat pulldowns 4 × 8**, **barbell or dumbbell rows 3 × 8–10**, **face pulls 3 × 15**. Lead with your elbows and squeeze your shoulder blades.${personalContext}`;
    if (has('shoulder', 'delt'))
        return `For shoulders: **overhead press 4 × 6–8** for strength, **lateral raises 3 × 12–15** for width, **face pulls 3 × 15** for rear delts and shoulder health.${personalContext}`;
    if (has('arm', 'bicep', 'tricep'))
        return `For arms, superset **curls 3 × 10–12** with **tricep pushdowns or extensions 3 × 10–12**. Control the lowering phase for a better pump.${personalContext}`;
    if (has('core', 'abs', 'plank'))
        return `For core: **planks 3 × 45 s**, **hanging leg raises 3 × 10**, **cable crunches 3 × 12**. Train it 2–3 times a week.${personalContext}`;
    if (has('cardio', 'run', 'hiit'))
        return `Mix easy cardio (walking, cycling) with 1–2 short HIIT sessions a week. Do cardio after lifting or on separate days so it doesn't hurt your strength work.${personalContext}`;
    if (has('rest', 'recover', 'sleep'))
        return `Muscles grow while you recover: aim for **7–9 hours of sleep** and **1–2 rest days a week**. Light walking on rest days helps.${personalContext}`;
    if (has('warm up', 'warm-up', 'stretch'))
        return `Warm up with 5 minutes of light cardio, then dynamic stretches and 2–3 lighter ramp-up sets of your first lift. Save static stretching for after training.`;
    if (has('today', 'what should', 'what to train'))
        return `Train the muscle group you've rested the longest, and aim to beat last time by **one rep or 2.5 kg** on your main lift.${personalContext}`;

    // ── Social ── (only when the whole message is small talk, so "hey, my knee hurts" isn't treated as a greeting)
    if (/^(hi|hey|hello|yo|sup|hiya|howdy|good (morning|afternoon|evening))\b[\s\w!.,]{0,12}$/i.test(q))
        return `Hey! 👋 What are we working on today: a workout plan, a specific lift, nutrition, or your progress?${personalContext}`;
    const short = q.split(/\s+/).length <= 6;
    if (short && /\b(thanks|thank you|thx|ty|cheers|appreciate it)\b/i.test(q))
        return `You're welcome! 💪 Let me know if there's anything else.`;
    if (short && /\b(bye|goodbye|see you|cya)\b/i.test(q))
        return `See you next time. Stay consistent and keep logging your workouts! 🏋️`;

    return `I can help with workout plans, specific exercises, pain-free alternatives, nutrition and your progress. Tell me a bit more about what you need.${personalContext}`;
}

const makeTitle = (message: string) => {
    const firstLine = message.split('\n')[0].trim();
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
};

// ═════════════════════════════════════════════
// GET /ai/conversations — list the user's chats, newest first
// ═════════════════════════════════════════════
router.get('/conversations', authenticateToken, async (req: any, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' },
            take: 100,
            include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        res.json(conversations.map(c => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            // plain-text preview: drop Markdown symbols and line breaks
            preview: (c.messages[0]?.content || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
        })));
    } catch (error) {
        console.error('Conversations fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// ═════════════════════════════════════════════
// GET /ai/conversations/:id/messages — one chat's messages
// ═════════════════════════════════════════════
router.get('/conversations/:id/messages', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;
        if (!isObjectId(id)) return res.status(404).json({ error: 'Conversation not found' });
        const conversation = await prisma.conversation.findFirst({ where: { id, userId: req.user.id } });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const messages = await prisma.chatMessage.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
        });
        res.json({
            conversation: { id: conversation.id, title: conversation.title },
            messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
        });
    } catch (error) {
        console.error('Messages fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// ═════════════════════════════════════════════
// DELETE /ai/conversations/:id — delete one chat
// ═════════════════════════════════════════════
router.delete('/conversations/:id', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        if (!isObjectId(id)) return res.status(404).json({ error: 'Conversation not found' });
        await prisma.chatMessage.deleteMany({ where: { conversationId: id, userId } });
        const { count } = await prisma.conversation.deleteMany({ where: { id, userId } });
        if (count === 0) return res.status(404).json({ error: 'Conversation not found' });
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        console.error('Conversation delete error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ═════════════════════════════════════════════
// DELETE /ai/history — delete all chats
// ═════════════════════════════════════════════
router.delete('/history', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        await prisma.chatMessage.deleteMany({ where: { userId } });
        await prisma.conversation.deleteMany({ where: { userId } });
        res.json({ message: 'Chat history cleared' });
    } catch (error) {
        console.error('History clear error:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

// ═════════════════════════════════════════════
// POST /ai/chat — send a message; the reply is streamed back as Server-Sent Events:
//   event: meta   { conversationId, title }
//   event: delta  { text }            (repeated)
//   event: done   { messageId, offline }
//   event: error  { error }
// ═════════════════════════════════════════════
router.post('/chat', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const tzOffset = Number(req.body?.tzOffset) || 0;
    const requestedId = req.body?.conversationId;

    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });

    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
        let conversation = null;
        if (requestedId) {
            conversation = isObjectId(requestedId)
                ? await prisma.conversation.findFirst({ where: { id: requestedId, userId } })
                : null;
            if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
        }

        // Gather context before saving the new message
        const [user, workouts, history, pastNotes] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { name: true, height: true, weight: true, gender: true } }),
            prisma.workout.findMany({ where: { userId }, include: { exercises: true }, orderBy: { date: 'desc' }, take: WORKOUTS_IN_CONTEXT }),
            conversation
                ? prisma.chatMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: HISTORY_MESSAGES })
                : Promise.resolve([]),
            prisma.chatMessage.findMany({
                where: { userId, role: 'user', ...(conversation ? { NOT: { conversationId: conversation.id } } : {}) },
                orderBy: { createdAt: 'desc' },
                take: PAST_CHAT_NOTES,
            }),
        ]);

        if (!conversation) conversation = await prisma.conversation.create({ data: { userId, title: makeTitle(message) } });
        await prisma.chatMessage.create({ data: { role: 'user', content: message, userId, conversationId: conversation.id } });

        const system = buildSystemPrompt(user, workouts, pastNotes.reverse(), tzOffset);
        const turns: ChatTurn[] = [
            ...history.reverse().map(m => ({ role: m.role as ChatTurn['role'], content: m.content })),
            { role: 'user', content: message },
        ];

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        send('meta', { conversationId: conversation.id, title: conversation.title });

        // Stop generating if the user presses Stop or leaves the page
        const abort = new AbortController();
        let clientGone = false;
        res.on('close', () => {
            if (!res.writableEnded) { clientGone = true; abort.abort(); }
        });

        let reply = '';
        let offline = false;
        try {
            if (!aiEnabled()) throw new Error('GEMINI_API_KEY is not configured');
            for await (const chunk of streamChat(system, turns, abort.signal)) {
                reply += chunk;
                send('delta', { text: chunk });
            }
            if (!reply.trim()) throw new Error('empty reply');
        } catch (aiError: any) {
            if (clientGone) {
                // keep whatever was generated before the user stopped it
            } else if (!reply) {
                console.log('AI unavailable, using offline coach:', aiError.message);
                offline = true;
                reply = generateOfflineResponse(message, workouts);
                send('delta', { text: reply });
            } else {
                console.error('AI reply interrupted:', aiError.message);
                const note = '\n\n_(The reply was interrupted. Please ask again.)_';
                reply += note;
                send('delta', { text: note });
            }
        }

        if (reply.trim()) {
            const saved = await prisma.chatMessage.create({
                data: { role: 'assistant', content: reply, userId, conversationId: conversation.id },
            });
            await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
            if (!clientGone) send('done', { messageId: saved.id, offline });
        }
        if (!clientGone) res.end();
    } catch (error: any) {
        console.error('Chat error:', error);
        if (res.headersSent) {
            send('error', { error: 'Failed to process chat message' });
            res.end();
        } else {
            res.status(500).json({ error: 'Failed to process chat message' });
        }
    }
});

export default router;
