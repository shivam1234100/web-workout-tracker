import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !email || !password) { setError('Please fill in all fields'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        setLoading(true);
        setError('');
        try {
            await signUp(email, password, name);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Signup failed');
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
                <h1>Create Account</h1>
                <p className="auth-subtitle">Start tracking your fitness journey today</p>
                {error && <div className="alert alert-error mb-16">{error}</div>}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Name</label>
                        <input className="input" type="text" placeholder="Enter your name..." value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label>Email</label>
                        <input className="input" type="email" placeholder="Enter email..." value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input className="input" type="password" placeholder="Min 6 characters..." value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Sign Up'}
                    </button>
                </form>
                <div className="auth-link">
                    Already have an account? <Link to="/login">Log in</Link>
                </div>
            </div>
        </div>
    );
}
