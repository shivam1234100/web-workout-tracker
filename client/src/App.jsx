import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { Home, Dumbbell, History, Bot, TrendingUp, User, LogOut, Library } from 'lucide-react';

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

function Sidebar() {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const handleLogout = () => { signOut(); navigate('/login'); };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">🏋️</div>
                <h1>AI Workout</h1>
            </div>
            <nav className="sidebar-nav">
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Home size={20} /> Dashboard
                </NavLink>
                <NavLink to="/workout" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Dumbbell size={20} /> Workout
                </NavLink>
                <NavLink to="/exercises" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Library size={20} /> Exercises
                </NavLink>
                <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <History size={20} /> History
                </NavLink>
                <NavLink to="/ai-coach" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Bot size={20} /> AI Coach
                </NavLink>
                <NavLink to="/weekly-summary" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <TrendingUp size={20} /> Weekly Insights
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <User size={20} /> Profile
                </NavLink>
            </nav>
            <div className="sidebar-footer">
                <button className="nav-link" onClick={handleLogout} style={{ color: 'var(--accent-red)' }}>
                    <LogOut size={20} /> Log Out
                </button>
            </div>
        </aside>
    );
}

function AppLayout() {
    return (
        <WorkoutProvider>
            <div className="app-layout">
                <Sidebar />
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
