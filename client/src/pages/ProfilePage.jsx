import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, LogOut, User } from 'lucide-react';

export default function ProfilePage() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        signOut();
        navigate('/login');
    };

    return (
        <div className="page-container" style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="page-header">
                <h1>Profile</h1>
            </div>

            <div className="profile-card" style={{ marginBottom: 24 }}>
                <div className="profile-avatar">
                    {(user?.name || user?.email || 'A')[0].toUpperCase()}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user?.name || 'User'}</h2>
                <div className="flex items-center justify-center gap-8" style={{ color: 'var(--text-muted)' }}>
                    <Mail size={14} />
                    <span style={{ fontSize: 14 }}>{user?.email}</span>
                </div>
                <p className="text-muted text-sm" style={{ marginTop: 8 }}>Local Account</p>
            </div>

            <button className="btn btn-danger btn-lg btn-full" onClick={handleLogout}>
                <LogOut size={18} /> Log Out
            </button>
        </div>
    );
}
