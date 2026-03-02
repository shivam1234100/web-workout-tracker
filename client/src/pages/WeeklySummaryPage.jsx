import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../constants/api';
import { Dumbbell, Clock, Flame, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

export default function WeeklySummaryPage() {
    const { token } = useAuth();
    const [currentSummary, setCurrentSummary] = useState(null);
    const [pastSummaries, setPastSummaries] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedPast, setExpandedPast] = useState(null);

    useEffect(() => {
        generateCurrentWeekSummary();
        fetchPastSummaries();
    }, []);

    const generateCurrentWeekSummary = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_URL}/summary/weekly`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
            if (res.ok) setCurrentSummary(await res.json());
        } catch (err) { console.error(err); }
        finally { setIsGenerating(false); }
    };

    const fetchPastSummaries = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/summary/weekly`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const dow = now.getDay();
                const monOff = dow === 0 ? -6 : 1 - dow;
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() + monOff);
                weekStart.setHours(0, 0, 0, 0);
                setPastSummaries(data.filter(s => new Date(s.weekStart).getTime() < weekStart.getTime()));
            }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const parseStats = (str) => { try { return JSON.parse(str); } catch { return null; } };
    const formatWeekRange = (s, e) => {
        const sd = new Date(s); const ed = new Date(e);
        return `${sd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${ed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    };

    const stats = currentSummary ? parseStats(currentSummary.stats) : null;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Weekly Insights</h1>
                {currentSummary && <p>{formatWeekRange(currentSummary.weekStart, currentSummary.weekEnd)}</p>}
            </div>

            {/* Stats Cards */}
            {isGenerating && !stats ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 12 }}>
                    <div className="spinner" />
                    <p className="text-muted text-sm">Analyzing your workouts...</p>
                </div>
            ) : stats ? (
                <>
                    <div className="stats-grid" style={{ marginBottom: 12 }}>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-blue-glow)' }}><Dumbbell size={22} color="var(--accent-blue)" /></div>
                            <div className="stat-value">{stats.totalWorkouts}</div>
                            <div className="stat-label">Workouts</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-red-glow)' }}><Flame size={22} color="var(--accent-red)" /></div>
                            <div className="stat-value">{stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}k` : stats.totalVolume}</div>
                            <div className="stat-label">Volume (kg)</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-purple-glow)' }}><Clock size={22} color="var(--accent-purple)" /></div>
                            <div className="stat-value">{stats.totalDurationMin}</div>
                            <div className="stat-label">Minutes</div>
                        </div>
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 32, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-green-glow)' }}><TrendingUp size={22} color="var(--accent-green)" /></div>
                            <div className="stat-value">{stats.totalSets}</div>
                            <div className="stat-label">Total Sets</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-orange-glow)' }}><Calendar size={22} color="var(--accent-orange)" /></div>
                            <div className="stat-value">{stats.totalReps}</div>
                            <div className="stat-label">Total Reps</div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-light)', marginBottom: 32 }}>
                    <p className="text-muted">No workouts this week yet. Start training to see your insights!</p>
                </div>
            )}

            {/* AI Summary */}
            {currentSummary && (
                <div className="summary-ai-card" style={{ marginBottom: 32 }}>
                    <h3>🤖 AI Coach Analysis</h3>
                    <div className="summary-text">{currentSummary.summary}</div>
                </div>
            )}

            {/* Past Summaries */}
            {pastSummaries.length > 0 && (
                <>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Past Weeks</h2>
                    <div className="flex-col gap-12">
                        {pastSummaries.map(summary => {
                            const ps = parseStats(summary.stats);
                            const isExpanded = expandedPast === summary.id;
                            return (
                                <div key={summary.id} className="past-week-item" onClick={() => setExpandedPast(isExpanded ? null : summary.id)}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 style={{ fontWeight: 700 }}>{formatWeekRange(summary.weekStart, summary.weekEnd)}</h4>
                                            {ps && <p className="text-muted text-sm" style={{ marginTop: 4 }}>{ps.totalWorkouts} workouts · {ps.totalVolume.toLocaleString()}kg volume</p>}
                                        </div>
                                        {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                                    </div>
                                    {isExpanded && <div className="week-expanded">{summary.summary}</div>}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
            )}
        </div>
    );
}
