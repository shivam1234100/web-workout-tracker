import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkout } from '../context/WorkoutContext';
import { MOCK_QUOTES } from '../constants/mockData';
import { Dumbbell, Activity, Calendar, TrendingUp, ChevronRight, PlayCircle, Quote } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const { history, fetchHistory } = useWorkout();
    const navigate = useNavigate();
    const [dailyQuote, setDailyQuote] = useState(null);

    useEffect(() => {
        fetchHistory();
        setDailyQuote(MOCK_QUOTES[Math.floor(Math.random() * MOCK_QUOTES.length)]);
    }, [fetchHistory]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const lastWorkoutDate = history.length > 0 ? history[0].endTime || history[0].date : null;
    const totalExercises = history.reduce((acc, w) => acc + (w.exercises?.length || 0), 0);

    return (
        <div className="page-container">
            {/* Header */}
            <div className="flex justify-between items-center mb-24" style={{ marginBottom: 32 }}>
                <div>
                    <p className="text-secondary text-sm" style={{ marginBottom: 4 }}>{getGreeting()},</p>
                    <h1 style={{ fontSize: 28, fontWeight: 800 }}>{user?.name || user?.email?.split('@')[0] || 'Athlete'}</h1>
                </div>
                <button className="btn-icon" onClick={() => navigate('/profile')}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                        {(user?.name || user?.email || 'A')[0].toUpperCase()}
                    </div>
                </button>
            </div>

            {/* Daily Quote */}
            {dailyQuote && (
                <div className="gradient-banner gradient-banner-blue" style={{ marginBottom: 32, cursor: 'default' }}>
                    <div className="flex items-center gap-8" style={{ marginBottom: 8, position: 'relative', zIndex: 1 }}>
                        <Quote size={18} color="rgba(255,255,255,0.7)" />
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Motivation</span>
                    </div>
                    <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.5, position: 'relative', zIndex: 1 }}>"{dailyQuote.text}"</p>
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 32 }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--accent-blue-glow)' }}><Dumbbell size={22} color="var(--accent-blue)" /></div>
                    <div className="stat-value">{history.length}</div>
                    <div className="stat-label">Workouts</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--accent-pink-glow)' }}><Activity size={22} color="var(--accent-pink)" /></div>
                    <div className="stat-value">{totalExercises}</div>
                    <div className="stat-label">Exercises</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--accent-purple-glow)' }}><Calendar size={22} color="var(--accent-purple)" /></div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{lastWorkoutDate ? new Date(lastWorkoutDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</div>
                    <div className="stat-label">Last Active</div>
                </div>
            </div>

            {/* Weekly Insights Banner */}
            <div className="gradient-banner gradient-banner-emerald" onClick={() => navigate('/weekly-summary')} style={{ marginBottom: 32 }}>
                <div className="flex justify-between items-center" style={{ position: 'relative', zIndex: 1 }}>
                    <div>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Weekly Insights</span>
                        <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 4 }}>View Your Training Summary</h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>AI-powered analysis of your week</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: 14, borderRadius: 'var(--radius-lg)' }}>
                        <TrendingUp size={24} color="#fff" />
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Recent Activity</h2>
            <div className="workout-grid">
                {history.slice(0, 3).map(workout => (
                    <div key={workout.id} className="history-item card-clickable" onClick={() => navigate('/history', { state: { viewWorkout: workout } })}>
                        <div className="history-icon" style={{ background: 'var(--accent-blue-glow)' }}>
                            <PlayCircle size={22} color="var(--accent-blue)" />
                        </div>
                        <div className="history-info" style={{ flex: 1 }}>
                            <h4>{workout.name || 'Workout'}</h4>
                            <p>{new Date(workout.endTime || workout.date).toLocaleDateString()} · {workout.exercises?.length || 0} Exercises</p>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                ))}
                {history.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-light)' }}>
                        <p className="text-muted">No recent activity. Start your first workout today!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
