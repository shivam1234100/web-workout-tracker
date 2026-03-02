import { useState, useEffect } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { Calendar, ChevronRight, Trash2, X, ArrowLeft, Dumbbell, Clock } from 'lucide-react';

export default function HistoryPage() {
    const { history, fetchHistory, deleteWorkout } = useWorkout();
    const [selectedWorkout, setSelectedWorkout] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const getSets = (sets) => {
        if (!sets) return [];
        if (Array.isArray(sets)) return sets;
        if (typeof sets === 'string') { try { return JSON.parse(sets); } catch { return []; } }
        return [];
    };

    const handleDelete = (id) => {
        deleteWorkout(id);
        setDeleteConfirm(null);
        if (selectedWorkout?.id === id) setSelectedWorkout(null);
    };

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Detail View
    if (selectedWorkout) {
        const w = selectedWorkout;
        const durationMin = w.startTime && w.endTime ? Math.round((new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000) : null;
        return (
            <div className="page-container">
                <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => setSelectedWorkout(null)}>
                    <ArrowLeft size={18} /> Back to History
                </button>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{w.name || 'Workout Details'}</h1>
                <p className="text-muted text-sm" style={{ marginBottom: 24 }}>{formatDate(w.endTime || w.date)}</p>

                <div className="stats-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--accent-blue-glow)' }}><Dumbbell size={20} color="var(--accent-blue)" /></div>
                        <div className="stat-value">{w.exercises?.length || 0}</div>
                        <div className="stat-label">Exercises</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--accent-green-glow)' }}><Clock size={20} color="var(--accent-green)" /></div>
                        <div className="stat-value">{durationMin ? `${durationMin}m` : '—'}</div>
                        <div className="stat-label">Duration</div>
                    </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Exercises Performed</h3>
                {w.exercises?.map((ex, i) => (
                    <div key={ex.id || i} className="detail-exercise">
                        <h4>{ex.name}</h4>
                        <div className="detail-set-header"><span>Set</span><span>KG</span><span>Reps</span></div>
                        {getSets(ex.sets).map((set, si) => (
                            <div key={set.id || si} className="detail-set-row">
                                <div><div className="set-num">{si + 1}</div></div>
                                <span style={{ fontWeight: 600 }}>{set.weight || 0}</span>
                                <span style={{ fontWeight: 600 }}>{set.reps || 0}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Workout History</h1>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-value">{history.length}</div>
                    <div className="stat-label">Total Workouts</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{new Set(history.map(w => w.name)).size}</div>
                    <div className="stat-label">Unique Types</div>
                </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Past Workouts</h3>
            <div className="workout-grid">
                {history.map(workout => (
                    <div key={workout.id} className="history-item">
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => setSelectedWorkout(workout)}>
                            <div className="history-icon" style={{ background: 'var(--accent-purple-glow)' }}>
                                <Calendar size={22} color="var(--accent-purple)" />
                            </div>
                            <div className="history-info">
                                <h4>{workout.name || 'Workout'}</h4>
                                <p>{formatDate(workout.endTime || workout.date)}</p>
                            </div>
                            <div style={{ textAlign: 'right', marginRight: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{workout.exercises?.length || 0} Exercises</span>
                                <div className="flex items-center gap-4" style={{ marginTop: 4, justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>View</span>
                                    <ChevronRight size={12} color="var(--accent-blue)" />
                                </div>
                            </div>
                        </div>
                        <button className="btn-icon" style={{ borderColor: 'transparent', color: 'var(--accent-red)' }} onClick={() => setDeleteConfirm(workout.id)}>
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {history.length === 0 && (
                    <div className="empty-state">
                        <p className="text-muted">No workouts completed yet. Start your first workout today!</p>
                    </div>
                )}
            </div>

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Delete Workout</h2><button className="btn-icon" onClick={() => setDeleteConfirm(null)}><X size={18} /></button></div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Are you sure you want to delete this workout? This action cannot be undone.</p>
                        <div className="confirm-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
