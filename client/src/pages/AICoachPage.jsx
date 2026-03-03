import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkout } from '../context/WorkoutContext';
import { API_URL } from '../constants/api';
import { Send, Bot, User, Plus, Trash2, MessageSquare } from 'lucide-react';

function generateOfflineResponse(query, workoutHistory) {
    const lq = query.toLowerCase().trim();
    let ctx = '';
    if (workoutHistory.length > 0) {
        const last = workoutHistory[0];
        const names = last.exercises?.map(e => e.name).join(', ') || 'exercises';
        const days = Math.floor((Date.now() - new Date(last.endTime || last.date).getTime()) / 86400000);
        ctx = ` Your last workout was ${days}d ago (${names}).`;
    }
    // Conversational
    if (/^(thanks|thank you|thx|ty|appreciate|cheers)/i.test(lq)) return `You're welcome! 💪 Keep pushing and let me know if you need anything else!`;
    if (/^(hi|hey|hello|sup|yo|what's up|howdy|good morning|good evening)/i.test(lq)) return `Hey there! 👋 Ready to crush it? Ask me about workouts, nutrition, or your progress!${ctx}`;
    if (/^(bye|goodbye|see you|later|cya)/i.test(lq)) return `See you next time! 🏋️ Stay consistent and keep logging your workouts!`;
    if (/^(ok|okay|got it|cool|nice|great|awesome|perfect|alright)/i.test(lq)) return `Glad to help! Feel free to ask anything else about fitness. 💪`;
    if (/^(how are you|how're you)/i.test(lq)) return `I'm great, thanks! 😊 What can I help you with today?`;
    // Fitness
    if (lq.includes('chest') || lq.includes('bench')) return `Bench Press, Incline DB Press, Flyes — 3-4×8-12.${ctx}`;
    if (lq.includes('back') || lq.includes('pull')) return `Pull-ups, Rows, Lat Pulldowns. Squeeze shoulder blades!${ctx}`;
    if (lq.includes('leg') || lq.includes('squat')) return `Squats, Lunges, RDLs. Drive through heels.${ctx}`;
    if (lq.includes('shoulder')) return `OHP for mass, Lateral Raises for width, Face Pulls for rear.${ctx}`;
    if (lq.includes('arm') || lq.includes('bicep')) return `Superset Curls with Tricep Extensions.${ctx}`;
    if (lq.includes('today') || lq.includes('what should')) return `Try adding 2.5kg or 1-2 extra reps to your main lifts.${ctx}`;
    if (lq.includes('protein') || lq.includes('diet') || lq.includes('eat')) return `Aim for 1.6-2.2g protein per kg body weight daily. Balanced meals with lean proteins, complex carbs, and healthy fats.${ctx}`;
    if (lq.includes('rest') || lq.includes('sleep') || lq.includes('recover')) return `Muscles grow while you rest. Aim for 7-9 hours of sleep and 1-2 rest days per week.${ctx}`;
    return `I can help with workout plans, nutrition, and tracking your progress. Try asking about a specific muscle group or fitness goal!${ctx}`;
}

function groupIntoConversations(messages) {
    if (messages.length === 0) return [];
    const convos = [];
    let cur = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
        const prevT = messages[i - 1].createdAt ? new Date(messages[i - 1].createdAt).getTime() : 0;
        const curT = messages[i].createdAt ? new Date(messages[i].createdAt).getTime() : 0;
        if (curT - prevT > 30 * 60 * 1000) { convos.push(buildConvo(cur)); cur = [messages[i]]; }
        else cur.push(messages[i]);
    }
    if (cur.length > 0) convos.push(buildConvo(cur));
    return convos.reverse();
}

function buildConvo(msgs) {
    const firstUser = msgs.find(m => m.role === 'user');
    const title = firstUser ? (firstUser.content.length > 40 ? firstUser.content.substring(0, 40) + '...' : firstUser.content) : 'New conversation';
    const last = msgs[msgs.length - 1];
    const preview = last.role === 'assistant' ? (last.content.length > 60 ? last.content.substring(0, 60) + '...' : last.content) : '';
    const diff = msgs[0].createdAt ? Math.floor((Date.now() - new Date(msgs[0].createdAt).getTime()) / 86400000) : 0;
    const date = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : new Date(msgs[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { id: msgs[0].id, title, preview, date, messages: msgs };
}

export default function AICoachPage() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [allMessages, setAllMessages] = useState([]);
    const [activeMessages, setActiveMessages] = useState([]);
    const [activeConvoId, setActiveConvoId] = useState(null);
    const [activeConvoTitle, setActiveConvoTitle] = useState('New Chat');
    const scrollRef = useRef(null);
    const { token } = useAuth();
    const { history: workoutHistory } = useWorkout();

    useEffect(() => { loadHistory(); }, []);
    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [activeMessages]);

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        if (!token) { setIsLoadingHistory(false); return; }
        try {
            const res = await fetch(`${API_URL}/ai/history`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setAllMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
            }
        } catch { }
        finally { setIsLoadingHistory(false); }
    };

    const conversations = groupIntoConversations(allMessages);

    const openConvo = (convo) => { setActiveMessages(convo.messages); setActiveConvoId(convo.id); setActiveConvoTitle(convo.title); };

    const newChat = () => {
        const welcome = { id: 'welcome', role: 'assistant', content: "👋 Hey! I'm your AI Coach. Ask me anything about training, nutrition, or your progress!", createdAt: new Date().toISOString() };
        setActiveMessages([welcome]); setActiveConvoId(null); setActiveConvoTitle('New Chat');
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;
        if (activeMessages.length === 0) newChat();
        const userMsg = { id: Date.now().toString(), role: 'user', content: input.trim(), createdAt: new Date().toISOString() };
        if (!activeMessages.some(m => m.role === 'user')) setActiveConvoTitle(userMsg.content.length > 40 ? userMsg.content.substring(0, 40) + '...' : userMsg.content);
        setActiveMessages(p => [...p, userMsg]); setAllMessages(p => [...p, userMsg]); setInput(''); setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: userMsg.content }) });
            if (res.ok) {
                const data = await res.json();
                const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, createdAt: new Date().toISOString() };
                setActiveMessages(p => [...p, aiMsg]); setAllMessages(p => [...p, aiMsg]);
            } else throw new Error();
        } catch {
            setTimeout(() => {
                const fb = { id: (Date.now() + 1).toString(), role: 'assistant', content: generateOfflineResponse(userMsg.content, workoutHistory), createdAt: new Date().toISOString() };
                setActiveMessages(p => [...p, fb]); setAllMessages(p => [...p, fb]);
            }, 800);
        } finally { setIsLoading(false); }
    };

    const clearAll = async () => {
        try { await fetch(`${API_URL}/ai/history`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch { }
        setAllMessages([]); setActiveMessages([]); setActiveConvoId(null);
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

    return (
        <div className="chat-layout">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Chats</h3>
                    <div className="flex gap-8">
                        <button className="btn-icon" onClick={newChat} title="New Chat"><Plus size={18} /></button>
                        <button className="btn-icon" onClick={clearAll} title="Clear All" style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                    </div>
                </div>
                <div className="chat-sidebar-list">
                    {isLoadingHistory ? (
                        <div style={{ padding: 30, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
                    ) : conversations.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center' }}>
                            <MessageSquare size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                            <p className="text-muted text-sm">No conversations yet</p>
                        </div>
                    ) : (
                        conversations.map(c => (
                            <div key={c.id} className={`chat-convo-item ${activeConvoId === c.id ? 'active' : ''}`} onClick={() => openConvo(c)}>
                                <div className="convo-title">{c.title}</div>
                                {c.preview && <div className="convo-preview">{c.preview}</div>}
                                <div className="convo-date">{c.date}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Main */}
            <div className="chat-main">
                <div className="chat-header"><h3>{activeConvoTitle}</h3></div>

                {activeMessages.length === 0 ? (
                    <div className="chat-empty-state">
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-blue-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bot size={32} color="var(--accent-blue)" />
                        </div>
                        <h3>What can I help with?</h3>
                        <p>Ask about workouts, nutrition, or your progress</p>
                        <div className="quick-prompts">
                            {['What should I train today?', 'How do I improve my bench press?', 'Give me a push/pull/legs split'].map((p, i) => (
                                <button key={i} className="quick-prompt" onClick={() => setInput(p)}>{p}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="chat-messages" ref={scrollRef}>
                        {activeMessages.map(msg => (
                            <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                                <div className="avatar">
                                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                                </div>
                                <div>
                                    <div className="message-content">{msg.content}</div>
                                    {msg.createdAt && msg.id !== 'welcome' && (
                                        <div className="message-time">{new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="chat-bubble assistant">
                                <div className="avatar"><Bot size={16} /></div>
                                <div className="message-content"><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /></div>
                            </div>
                        )}
                    </div>
                )}

                {/* Input */}
                <div className="chat-input-area">
                    <input placeholder="Message AI Coach..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} />
                    <button className={`chat-send-btn ${input.trim() ? 'active' : 'inactive'}`} onClick={sendMessage} disabled={!input.trim() || isLoading}>
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
