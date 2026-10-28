import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all workouts for user
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const workouts = await prisma.workout.findMany({
            where: { userId: req.user.id },
            include: { exercises: true },
            orderBy: { date: 'desc' }
        });

        // Parse sets JSON back to object
        const formattedWorkouts = workouts.map(w => ({
            ...w,
            exercises: w.exercises.map(e => ({
                ...e,
                sets: JSON.parse(e.sets)
            }))
        }));

        res.json(formattedWorkouts);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching workouts' });
    }
});

// Save a workout
router.post('/', authenticateToken, async (req: any, res) => {
    try {
        const { name, startTime, endTime, exercises } = req.body;

        if (!Array.isArray(exercises) || exercises.length === 0) {
            return res.status(400).json({ error: 'A workout needs at least one exercise' });
        }

        const workout = await prisma.workout.create({
            data: {
                userId: req.user.id,
                name: typeof name === 'string' && name.trim() ? name.trim() : `Workout ${new Date().toLocaleDateString()}`,
                date: new Date(),
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                exercises: {
                    create: exercises.map((e: any) => ({
                        name: String(e.name),
                        sets: JSON.stringify(Array.isArray(e.sets) ? e.sets : [])
                    }))
                }
            },
            include: { exercises: true }
        });

        // Parse sets JSON before sending response
        const formattedWorkout = {
            ...workout,
            exercises: workout.exercises.map(e => ({
                ...e,
                sets: JSON.parse(e.sets)
            }))
        };

        res.json(formattedWorkout);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving workout' });
    }
});

// Delete workout
router.delete('/:id', authenticateToken, async (req: any, res) => {
    try {
        // deleteMany scoped to the user: a user can never delete someone else's workout
        const { count } = await prisma.workout.deleteMany({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (count === 0) return res.status(404).json({ error: 'Workout not found' });
        res.json({ message: 'Workout deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting workout' });
    }
});

export default router;
