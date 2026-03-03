import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../constants/api';
import { Mail, LogOut, User, Save, Ruler, Weight, Users } from 'lucide-react';

export default function ProfilePage() {
    const { user, token, signOut, updateUser } = useAuth();
    const navigate = useNavigate();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        name: user?.name || '',
        height: user?.height || '',
        weight: user?.weight || '',
        gender: user?.gender || '',
    });

    // Load profile from server on mount
    useEffect(() => {
        if (!token) return;
        fetch(`${API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setForm({
                        name: data.name || '',
                        height: data.height || '',
                        weight: data.weight || '',
                        gender: data.gender || '',
                    });
                    if (updateUser) updateUser(data);
                }
            })
            .catch(() => { });
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: form.name,
                    height: form.height,
                    weight: form.weight,
                    gender: form.gender,
                }),
            });
            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            if (updateUser) updateUser(data);
            setSuccess('Profile updated successfully!');
            setEditing(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch {
            setError('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => { signOut(); navigate('/login'); };

    return (
        <div className="page-container" style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="page-header">
                <h1>Profile</h1>
                <p>Manage your account details</p>
            </div>

            {success && <div className="alert alert-success mb-16">{success}</div>}
            {error && <div className="alert alert-error mb-16">{error}</div>}

            <div className="profile-card" style={{ marginBottom: 20 }}>
                <div className="profile-avatar">
                    {(user?.name || user?.email || 'A')[0].toUpperCase()}
                </div>
                {!editing ? (
                    <>
                        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{form.name || 'User'}</h2>
                        <div className="flex items-center justify-center gap-8" style={{ color: 'var(--text-muted)' }}>
                            <Mail size={14} />
                            <span style={{ fontSize: 14 }}>{user?.email}</span>
                        </div>
                    </>
                ) : (
                    <div className="input-group" style={{ marginTop: 12, textAlign: 'left' }}>
                        <label>Name</label>
                        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" />
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color="var(--accent-purple)" /> Body Stats
                </h3>

                {!editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-8">
                                <Ruler size={16} color="var(--accent-blue)" />
                                <span className="text-secondary">Height</span>
                            </div>
                            <span style={{ fontWeight: 600 }}>{form.height ? `${form.height} cm` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-8">
                                <Weight size={16} color="var(--accent-green)" />
                                <span className="text-secondary">Weight</span>
                            </div>
                            <span style={{ fontWeight: 600 }}>{form.weight ? `${form.weight} kg` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between" style={{ padding: '10px 0' }}>
                            <div className="flex items-center gap-8">
                                <User size={16} color="var(--accent-pink)" />
                                <span className="text-secondary">Gender</span>
                            </div>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{form.gender || '—'}</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="input-group">
                            <label><Ruler size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />Height (cm)</label>
                            <input className="input" type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} placeholder="e.g. 175" />
                        </div>
                        <div className="input-group">
                            <label><Weight size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />Weight (kg)</label>
                            <input className="input" type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="e.g. 70" />
                        </div>
                        <div className="input-group">
                            <label><User size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />Gender</label>
                            <div className="filter-pills" style={{ flexWrap: 'wrap' }}>
                                {['male', 'female', 'other'].map(g => (
                                    <button key={g} className={`filter-pill ${form.gender === g ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, gender: g }))} style={{ textTransform: 'capitalize' }}>{g}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!editing ? (
                    <button className="btn btn-primary btn-lg btn-full" onClick={() => setEditing(true)}>
                        Edit Profile
                    </button>
                ) : (
                    <div className="flex gap-12">
                        <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
                        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                            {saving ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Save size={16} /> Save</>}
                        </button>
                    </div>
                )}
                <button className="btn btn-danger btn-lg btn-full" onClick={handleLogout}>
                    <LogOut size={18} /> Log Out
                </button>
            </div>
        </div>
    );
}
