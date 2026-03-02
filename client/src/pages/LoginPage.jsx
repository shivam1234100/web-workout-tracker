import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell } from 'lucide-react';

export default function LoginPage() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Please fill in all fields'); return; }
        setLoading(true);
        setError('');
        try {
            await signIn(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">🏋️</div>
                    <h2>AI Workout</h2>
                </div>
                <h1>Welcome Back</h1>
                <p className="auth-subtitle">Sign in to continue your fitness journey</p>
                {error && <div className="alert alert-error mb-16">{error}</div>}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Email</label>
                        <input className="input" type="email" placeholder="Enter email..." value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input className="input" type="password" placeholder="Enter password..." value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                        <Link to="/forgot-password" style={{ color: 'var(--accent-blue)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>Forgot Password?</Link>
                    </div>
                    <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Log In'}
                    </button>
                </form>
                <div className="auth-link">
                    Don't have an account? <Link to="/signup">Sign up</Link>
                </div>
            </div>
        </div>
    );
}
