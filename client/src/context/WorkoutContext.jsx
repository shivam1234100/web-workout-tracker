import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API_URL } from '../constants/api';
import { useAuth } from './AuthContext';

const WorkoutContext = createContext(null);

// The in-progress workout is kept in localStorage (per user) so a page refresh doesn't lose it
const loadActiveWorkout = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
};

export function WorkoutProvider({ children }) {
    const { token, user } = useAuth();
    const storageKey = `active_workout_${user?.id || 'guest'}`;
    const [activeWorkout, setActiveWorkout] = useState(() => loadActiveWorkout(storageKey));
    const [history, setHistory] = useState([]);

    useEffect(() => {
        try {
            if (activeWorkout) localStorage.setItem(storageKey, JSON.stringify(activeWorkout));
            else localStorage.removeItem(storageKey);
        } catch { }
    }, [activeWorkout, storageKey]);

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

    // Starts a workout if none is active, so it can be called right after startWorkout()
    const addExercise = (exercise) => {
        setActiveWorkout(prev => ({
            ...(prev || { startTime: Date.now(), exercises: [] }),
            exercises: [
                ...(prev?.exercises || []),
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

    const removeExercise = (exerciseIndex) => {
        setActiveWorkout(prev => ({
            ...prev,
            exercises: prev.exercises.filter((_, i) => i !== exerciseIndex),
        }));
    };

    const discardWorkout = () => setActiveWorkout(null);

    const removeSet = (exerciseIndex, setIndex) => {
        setActiveWorkout(prev => {
            const exercises = [...prev.exercises];
            const sets = exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex);
            exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
            return { ...prev, exercises };
        });
    };

    // Returns null on success, or an error message to show the user
    const finishWorkout = async (name) => {
        if (!activeWorkout || !token) return 'No active workout';
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
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return data.error || 'Could not save workout. Please try again.';
            setHistory(prev => [data, ...prev]);
            setActiveWorkout(null);
            return null;
        } catch (err) {
            console.error('Error saving workout:', err);
            return 'Could not reach the server. Your workout is still here — try again.';
        }
    };

    // Only removes the workout locally once the server confirms the delete
    const deleteWorkout = async (id) => {
        if (!token) return false;
        try {
            const res = await fetch(`${API_URL}/workouts/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok && res.status !== 404) return false;
            setHistory(prev => prev.filter(w => w.id !== id));
            return true;
        } catch (err) {
            console.error('Error deleting workout:', err);
            return false;
        }
    };

    return (
        <WorkoutContext.Provider value={{
            activeWorkout, history, startWorkout, addExercise,
            addSet, updateSet, removeSet, removeExercise, discardWorkout,
            finishWorkout, fetchHistory, deleteWorkout,
        }}>
            {children}
        </WorkoutContext.Provider>
    );
}

export const useWorkout = () => useContext(WorkoutContext);
