import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkout } from '../context/WorkoutContext';
import { MOCK_EXERCISES } from '../constants/mockData';
import { Plus, Check, Clock, PlayCircle, X, Search } from 'lucide-react';

export default function WorkoutPage() {
    const { activeWorkout, startWorkout, addExercise, addSet, updateSet, finishWorkout } = useWorkout();
    const navigate = useNavigate();
    const [duration, setDuration] = useState(0);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [workoutName, setWorkoutName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState('All');

    useEffect(() => {
        let interval;
        if (activeWorkout) {
            interval = setInterval(() => {
                setDuration(Math.floor((Date.now() - (activeWorkout.startTime || Date.now())) / 1000));
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [activeWorkout]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleFinish = async () => {
        await finishWorkout(workoutName.trim() || undefined);
        setShowFinishModal(false);
        navigate('/history');
    };

    const bodyParts = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
    const filteredExercises = MOCK_EXERCISES.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBody = selectedBodyPart === 'All' || ex.muscleGroup === selectedBodyPart;
        return matchesSearch && matchesBody;
    });

    const handleAddExercise = (exercise) => {
        addExercise(exercise);
        setShowExerciseModal(false);
        setSearchQuery('');
    };

    // Empty state
    if (!activeWorkout) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="empty-state">
                    <div className="empty-icon" style={{ background: 'var(--accent-blue-glow)' }}>
                        <PlayCircle size={40} color="var(--accent-blue)" />
                    </div>
                    <h3>No Active Workout</h3>
                    <p>Ready to hit the gym? Start a new workout to track your sets and reps.</p>
                    <button className="btn btn-primary btn-lg" onClick={startWorkout}>
                        <PlayCircle size={20} /> Start Empty Workout
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: '16px 32px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Current Session</h2>
                    <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
                        <Clock size={14} color="var(--accent-blue)" />
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: 14 }}>{formatTime(duration)}</span>
                    </div>
                </div>
                <button className="btn" style={{ background: 'var(--accent-green)', color: '#fff' }} onClick={() => { setWorkoutName(''); setShowFinishModal(true); }}>
                    Finish Workout
                </button>
            </div>

            {/* Exercises */}
            <div className="page-container" style={{ flex: 1, overflow: 'auto' }}>
                {activeWorkout.exercises.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-muted">No exercises added yet.</p>
                        <button className="btn btn-ghost" style={{ color: 'var(--accent-blue)' }} onClick={() => setShowExerciseModal(true)}>Browse Library</button>
                    </div>
                ) : (
                    <div className="flex-col gap-16">
                        {activeWorkout.exercises.map((exercise, exIdx) => (
                            <div key={exercise.id} className="workout-exercise-card">
                                <h4>{exercise.name}</h4>
                                <div className="set-row-header">
                                    <span>Set</span><span>KG</span><span>Reps</span><span>Done</span>
                                </div>
                                {exercise.sets.map((set, setIdx) => (
                                    <div key={set.id} className={`set-row ${set.completed ? 'completed' : ''}`}>
                                        <span className="set-number">{setIdx + 1}</span>
                                        <input className="input input-sm" type="number" placeholder="0" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))} />
                                        <input className="input input-sm" type="number" placeholder="0" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))} />
                                        <button className={`set-done-btn ${set.completed ? 'done' : 'not-done'}`} onClick={() => updateSet(exIdx, setIdx, 'completed', !set.completed)}>
                                            <Check size={16} />
                                        </button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                    <button className="btn btn-ghost" style={{ color: 'var(--accent-blue)', fontSize: 13 }} onClick={() => addSet(exIdx)}>
                                        <Plus size={16} /> Add Set
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Exercise Button */}
                <button
                    onClick={() => setShowExerciseModal(true)}
                    style={{ width: '100%', marginTop: 16, padding: '16px', background: 'transparent', border: '1px dashed var(--accent-blue)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'all 150ms' }}
                >
                    <Plus size={20} /> Add Exercise
                </button>
            </div>

            {/* Finish Modal */}
            {showFinishModal && (
                <div className="modal-overlay" onClick={() => setShowFinishModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Save Workout</h2>
                            <button className="btn-icon" onClick={() => setShowFinishModal(false)}><X size={18} /></button>
                        </div>
                        <div className="input-group" style={{ marginBottom: 24 }}>
                            <label>Workout Name (Optional)</label>
                            <input className="input" placeholder="e.g. Leg Day Destruction" value={workoutName} onChange={e => setWorkoutName(e.target.value)} autoFocus />
                        </div>
                        <button className="btn btn-primary btn-lg btn-full" onClick={handleFinish}>Save & Finish</button>
                    </div>
                </div>
            )}

            {/* Exercise Picker Modal */}
            {showExerciseModal && (
                <div className="modal-overlay" onClick={() => setShowExerciseModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh' }}>
                        <div className="modal-header">
                            <h2>Add Exercise</h2>
                            <button className="btn-icon" onClick={() => setShowExerciseModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ position: 'relative', marginBottom: 16 }}>
                            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="input" style={{ paddingLeft: 40 }} placeholder="Search exercises..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="filter-pills" style={{ marginBottom: 16 }}>
                            {bodyParts.map(bp => (
                                <button key={bp} className={`filter-pill ${selectedBodyPart === bp ? 'active' : ''}`} onClick={() => setSelectedBodyPart(bp)}>{bp}</button>
                            ))}
                        </div>
                        <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {filteredExercises.map(ex => (
                                <div key={ex._id} className="exercise-card" onClick={() => handleAddExercise(ex)}>
                                    <img src={ex.image} alt={ex.name} loading="lazy" />
                                    <div className="exercise-info">
                                        <h4>{ex.name}</h4>
                                        <span>{ex.muscleGroup} · {ex.equipment}</span>
                                    </div>
                                    <Plus size={18} color="var(--accent-blue)" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
