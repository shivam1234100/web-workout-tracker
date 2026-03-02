import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkout } from '../context/WorkoutContext';
import { MOCK_EXERCISES } from '../constants/mockData';
import { Search, ChevronRight, X, PlayCircle, ExternalLink } from 'lucide-react';

export default function ExercisesPage() {
    const navigate = useNavigate();
    const { activeWorkout, startWorkout, addExercise } = useWorkout();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState('All');
    const [selectedDifficulty, setSelectedDifficulty] = useState('All');
    const [selectedExercise, setSelectedExercise] = useState(null);

    const bodyParts = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
    const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    const getDifficultyBadge = (d) => {
        if (d === 'Beginner') return 'badge-green';
        if (d === 'Intermediate') return 'badge-orange';
        return 'badge-red';
    };

    const filteredExercises = MOCK_EXERCISES.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBody = selectedBodyPart === 'All' || ex.muscleGroup === selectedBodyPart;
        const matchesDiff = selectedDifficulty === 'All' || ex.difficulty === selectedDifficulty;
        return matchesSearch && matchesBody && matchesDiff;
    });

    const handleAddToWorkout = (exercise) => {
        if (!activeWorkout) {
            startWorkout();
        }
        addExercise(exercise);
        setSelectedExercise(null);
        navigate('/workout');
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Exercise Library</h1>
                <p>{MOCK_EXERCISES.length} exercises available</p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 40 }} placeholder="Search exercises..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {/* Filters */}
            <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Body Part</p>
                <div className="filter-pills">
                    {bodyParts.map(bp => (
                        <button key={bp} className={`filter-pill ${selectedBodyPart === bp ? 'active' : ''}`} onClick={() => setSelectedBodyPart(bp)}>{bp}</button>
                    ))}
                </div>
            </div>
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Difficulty</p>
                <div className="filter-pills">
                    {difficulties.map(d => (
                        <button key={d} className={`filter-pill ${selectedDifficulty === d ? 'active' : ''}`} onClick={() => setSelectedDifficulty(d)}>{d}</button>
                    ))}
                </div>
            </div>

            {/* Exercise List */}
            <div className="workout-grid">
                {filteredExercises.map(ex => (
                    <div key={ex._id} className="exercise-card" onClick={() => setSelectedExercise(ex)}>
                        <img src={ex.image} alt={ex.name} loading="lazy" />
                        <div className="exercise-info">
                            <h4>{ex.name}</h4>
                            <span>{ex.muscleGroup} · <span className={`badge ${getDifficultyBadge(ex.difficulty)}`} style={{ marginLeft: 4 }}>{ex.difficulty}</span></span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                ))}
                {filteredExercises.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                        <p className="text-muted">No exercises match your filters.</p>
                    </div>
                )}
            </div>

            {/* Exercise Detail Modal */}
            {selectedExercise && (
                <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedExercise.name}</h2>
                            <button className="btn-icon" onClick={() => setSelectedExercise(null)}><X size={18} /></button>
                        </div>
                        <img src={selectedExercise.image} alt={selectedExercise.name} style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 20 }} />
                        <div className="flex items-center gap-12" style={{ marginBottom: 16 }}>
                            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{selectedExercise.muscleGroup}</span>
                            <span className="text-muted">·</span>
                            <span className="text-muted">{selectedExercise.equipment}</span>
                            <span className={`badge ${getDifficultyBadge(selectedExercise.difficulty)}`}>{selectedExercise.difficulty}</span>
                        </div>
                        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(selectedExercise.name + ' exercise form tutorial')}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--accent-red-glow)', color: 'var(--accent-red)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
                            <ExternalLink size={16} /> Watch Tutorial
                        </a>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Instructions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                            {selectedExercise.instructions.map((step, i) => (
                                <div key={i} className="flex gap-12">
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-blue-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>{i + 1}</span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, paddingTop: 4 }}>{step}</p>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-primary btn-lg btn-full" onClick={() => handleAddToWorkout(selectedExercise)}>
                            <PlayCircle size={20} /> Add to Workout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
