import { createContext, useContext, useState, useCallback } from 'react';
import { API_URL } from '../constants/api';
import { useAuth } from './AuthContext';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
    const { token } = useAuth();
    const [activeWorkout, setActiveWorkout] = useState(null);
    const [history, setHistory] = useState([]);

    const fetchHistory = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/workouts`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    }, [token]);

    const startWorkout = () => {
        setActiveWorkout({ startTime: Date.now(), exercises: [] });
    };

    const addExercise = (exercise) => {
        if (!activeWorkout) return;
        setActiveWorkout(prev => ({
            ...prev,
            exercises: [
                ...prev.exercises,
                {
                    id: Math.random().toString(),
                    exerciseId: exercise._id,
                    name: exercise.name,
                    sets: [{ id: Math.random().toString(), reps: 0, weight: 0, completed: false }],
                },
            ],
        }));
    };

    const addSet = (exerciseIndex) => {
        setActiveWorkout(prev => {
            const exercises = [...prev.exercises];
            const prevSet = exercises[exerciseIndex].sets[exercises[exerciseIndex].sets.length - 1];
            exercises[exerciseIndex] = {
                ...exercises[exerciseIndex],
                sets: [
                    ...exercises[exerciseIndex].sets,
                    {
                        id: Math.random().toString(),
                        reps: prevSet ? prevSet.reps : 0,
                        weight: prevSet ? prevSet.weight : 0,
                        completed: false,
                    },
                ],
            };
            return { ...prev, exercises };
        });
    };

    const updateSet = (exerciseIndex, setIndex, field, value) => {
        setActiveWorkout(prev => {
            const exercises = [...prev.exercises];
            const sets = [...exercises[exerciseIndex].sets];
            sets[setIndex] = { ...sets[setIndex], [field]: value };
            exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
            return { ...prev, exercises };
        });
    };

    const removeSet = (exerciseIndex, setIndex) => {
        setActiveWorkout(prev => {
            const exercises = [...prev.exercises];
            const sets = exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex);
            exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
            return { ...prev, exercises };
        });
    };

    const finishWorkout = async (name) => {
        if (!activeWorkout || !token) return;
        const workoutData = {
            name: name || `Workout ${new Date().toLocaleDateString()}`,
            startTime: activeWorkout.startTime,
            endTime: Date.now(),
            exercises: activeWorkout.exercises,
        };
        try {
            const res = await fetch(`${API_URL}/workouts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(workoutData),
            });
            if (res.ok) {
                const saved = await res.json();
                setHistory(prev => [saved, ...prev]);
                setActiveWorkout(null);
            }
        } catch (err) {
            console.error('Error saving workout:', err);
        }
    };

    const deleteWorkout = async (id) => {
        if (token) {
            try {
                await fetch(`${API_URL}/workouts/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (err) {
                console.error('Error deleting workout:', err);
            }
        }
        setHistory(prev => prev.filter(w => w.id !== id));
    };

    return (
        <WorkoutContext.Provider value={{
            activeWorkout, history, startWorkout, addExercise,
            addSet, updateSet, removeSet, finishWorkout,
            fetchHistory, deleteWorkout,
        }}>
            {children}
        </WorkoutContext.Provider>
    );
}

export const useWorkout = () => useContext(WorkoutContext);
