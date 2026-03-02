import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../constants/api';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState('email');

    const onSendCode = async (e) => {
        e.preventDefault();
        if (!email) { setError('Please enter your email'); return; }
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.resetCode) setResetCode(data.resetCode);
            setSuccess(data.emailSent ? 'Reset code sent to your email!' : `Reset code: ${data.resetCode}`);
            setStep('reset');
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const onReset = async (e) => {
        e.preventDefault();
        if (!resetCode || !newPassword || !confirmPassword) { setError('Please fill all fields'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
        if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetCode, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess('Password reset successful! Redirecting...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">🏋️</div>
                    <h2>AI Workout</h2>
                </div>
                <h1>{step === 'email' ? 'Forgot Password' : 'Reset Password'}</h1>
                <p className="auth-subtitle">{step === 'email' ? 'Enter your email to receive a reset code' : 'Enter the code and your new password'}</p>
                {error && <div className="alert alert-error mb-16">{error}</div>}
                {success && <div className="alert alert-success mb-16">{success}</div>}

                {step === 'email' ? (
                    <form className="auth-form" onSubmit={onSendCode}>
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" placeholder="Enter your email..." value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Send Reset Code'}
                        </button>
                    </form>
                ) : (
                    <form className="auth-form" onSubmit={onReset}>
                        <div className="input-group">
                            <label>Reset Code</label>
                            <input className="input" type="text" placeholder="Enter reset code..." value={resetCode} onChange={e => setResetCode(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>New Password</label>
                            <input className="input" type="password" placeholder="Enter new password..." value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <input className="input" type="password" placeholder="Confirm new password..." value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                        <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Reset Password'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-full" onClick={() => { setStep('email'); setError(''); setSuccess(''); }}>
                            ← Back to Email
                        </button>
                    </form>
                )}
                <div className="auth-link">
                    Remember your password? <Link to="/login">Log in</Link>
                </div>
            </div>
        </div>
    );
}
