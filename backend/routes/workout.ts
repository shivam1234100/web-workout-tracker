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

        const workout = await prisma.workout.create({
            data: {
                userId: req.user.id,
                name,
                date: new Date(),
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                exercises: {
                    create: exercises.map((e: any) => ({
                        name: e.name,
                        sets: JSON.stringify(e.sets)
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
        res.status(500).json({ error: 'Error saving workout', details: error });
    }
});

// Delete workout
router.delete('/:id', authenticateToken, async (req: any, res) => {
    try {
        await prisma.workout.delete({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ message: 'Workout deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting workout' });
    }
});

export default router;
