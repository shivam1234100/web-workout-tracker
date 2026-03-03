import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { Home, Dumbbell, History, Bot, TrendingUp, User, LogOut, Library, Menu, X } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import WorkoutPage from './pages/WorkoutPage';
import ExercisesPage from './pages/ExercisesPage';
import HistoryPage from './pages/HistoryPage';
import AICoachPage from './pages/AICoachPage';
import WeeklySummaryPage from './pages/WeeklySummaryPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div className="auth-container"><div className="spinner" /></div>;
    return isAuthenticated ? children : <Navigate to="/login" />;
}

function Sidebar({ mobileOpen, onClose }) {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const handleLogout = () => { signOut(); navigate('/login'); onClose?.(); };
    const handleNavClick = () => { onClose?.(); };

    return (
        <>
            {mobileOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-icon">🏋️</div>
                    <h1>AI Workout</h1>
                    {mobileOpen && (
                        <button className="btn-icon sidebar-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    )}
                </div>
                <nav className="sidebar-nav">
                    <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <Home size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/workout" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <Dumbbell size={20} /> Workout
                    </NavLink>
                    <NavLink to="/exercises" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <Library size={20} /> Exercises
                    </NavLink>
                    <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <History size={20} /> History
                    </NavLink>
                    <NavLink to="/ai-coach" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <Bot size={20} /> AI Coach
                    </NavLink>
                    <NavLink to="/weekly-summary" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <TrendingUp size={20} /> Weekly Insights
                    </NavLink>
                    <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <User size={20} /> Profile
                    </NavLink>
                </nav>
                <div className="sidebar-footer">
                    <button className="nav-link" onClick={handleLogout} style={{ color: 'var(--accent-red)' }}>
                        <LogOut size={20} /> Log Out
                    </button>
                </div>
            </aside>
        </>
    );
}

function MobileBottomNav() {
    const location = useLocation();
    const path = location.pathname;

    const navItems = [
        { to: '/dashboard', icon: Home, label: 'Home' },
        { to: '/workout', icon: Dumbbell, label: 'Workout' },
        { to: '/exercises', icon: Library, label: 'Exercises' },
        { to: '/history', icon: History, label: 'History' },
        { to: '/ai-coach', icon: Bot, label: 'AI' },
        { to: '/profile', icon: User, label: 'Profile' },
    ];

    return (
        <nav className="mobile-bottom-nav">
            {navItems.map(item => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={`mobile-nav-item ${path === item.to ? 'active' : ''}`}
                >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}

function MobileHeader({ onMenuOpen }) {
    return (
        <div className="mobile-header">
            <div className="mobile-header-logo">
                <div className="logo-icon" style={{ width: 32, height: 32, fontSize: 16, borderRadius: 8 }}>🏋️</div>
                <h1>AI Workout</h1>
            </div>
            <button className="btn-icon" onClick={onMenuOpen}>
                <Menu size={20} />
            </button>
        </div>
    );
}

function AppLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <WorkoutProvider>
            <div className="app-layout">
                <MobileHeader onMenuOpen={() => setMobileMenuOpen(true)} />
                <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
                <main className="main-content">
                    <Routes>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/workout" element={<WorkoutPage />} />
                        <Route path="/exercises" element={<ExercisesPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/ai-coach" element={<AICoachPage />} />
                        <Route path="/weekly-summary" element={<WeeklySummaryPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="*" element={<Navigate to="/dashboard" />} />
                    </Routes>
                </main>
                <MobileBottomNav />
            </div>
        </WorkoutProvider>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
