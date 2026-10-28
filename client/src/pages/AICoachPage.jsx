import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../constants/api';
import FormattedText from '../components/FormattedText';
import { Send, Bot, User, Plus, Trash2, MessageSquare, Square, X, PanelLeft } from 'lucide-react';

const QUICK_PROMPTS = [
    'What should I train today?',
    'How do I improve my bench press?',
    'Build me a 4-day upper/lower split',
    'My knee hurts on leg day. What can I do instead?',
];

// Reads the Server-Sent Events stream from POST /ai/chat and calls onEvent(event, data) for each one
async function streamCoachReply({ token, body, signal, onEvent }) {
    const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'The coach is unavailable right now. Please try again.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const raw = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            let event = 'message';
            let data = '';
            for (const line of raw.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (data) onEvent(event, JSON.parse(data));
        }
    }
}

const formatConvoDate = (iso) => {
    const date = new Date(iso);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function AICoachPage() {
    const { token } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [activeId, setActiveId] = useState(null);
    const [activeTitle, setActiveTitle] = useState('New Chat');
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState('');
    const [showList, setShowList] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const abortRef = useRef(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    const authHeaders = { Authorization: `Bearer ${token}` };

    const loadConversations = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/ai/conversations`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setConversations(await res.json());
        } catch { }
        finally { setLoadingList(false); }
    }, [token]);

    useEffect(() => { loadConversations(); }, [loadConversations]);
    useEffect(() => () => abortRef.current?.abort(), []);
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
    }, [messages, streaming]);

    // Grow the textarea with its content, up to a limit
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const border = el.offsetHeight - el.clientHeight;
        const full = el.scrollHeight + border;
        el.style.height = `${Math.min(full, 160)}px`;
        el.style.overflowY = full > 160 ? 'auto' : 'hidden';
    }, [input]);

    const openConversation = async (convo) => {
        if (streaming) return;
        setShowList(false);
        setError('');
        setActiveId(convo.id);
        setActiveTitle(convo.title);
        setMessages([]);
        setLoadingMessages(true);
        try {
            const res = await fetch(`${API_URL}/ai/conversations/${convo.id}/messages`, { headers: authHeaders });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setMessages(data.messages);
        } catch {
            setError('Could not load this chat. Please try again.');
        } finally {
            setLoadingMessages(false);
        }
    };

    const newChat = () => {
        if (streaming) return;
        setShowList(false);
        setError('');
        setActiveId(null);
        setActiveTitle('New Chat');
        setMessages([]);
        inputRef.current?.focus();
    };

    const sendMessage = async (text) => {
        const content = (text ?? input).trim();
        if (!content || streaming) return;

        const userMsg = { id: `local-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() };
        const replyId = `reply-${Date.now()}`;
        setMessages(prev => [...prev, userMsg, { id: replyId, role: 'assistant', content: '', pending: true }]);
        setInput('');
        setError('');
        setStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;
        let saved = false; // true once the server has stored the user's message
        const updateReply = (fn) => setMessages(prev => prev.map(m => (m.id === replyId ? fn(m) : m)));

        try {
            await streamCoachReply({
                token,
                body: { message: content, conversationId: activeId || undefined, tzOffset: new Date().getTimezoneOffset() },
                signal: controller.signal,
                onEvent: (event, data) => {
                    if (event === 'meta') {
                        saved = true;
                        setActiveId(data.conversationId);
                        if (!activeId) setActiveTitle(data.title);
                    } else if (event === 'delta') {
                        updateReply(m => ({ ...m, content: m.content + data.text }));
                    } else if (event === 'done') {
                        updateReply(m => ({ ...m, id: data.messageId, pending: false, offline: data.offline, createdAt: new Date().toISOString() }));
                    } else if (event === 'error') {
                        throw new Error(data.error);
                    }
                },
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                updateReply(m => ({ ...m, pending: false, stopped: true }));
            } else if (!saved) {
                // Nothing reached the server: put the text back so it can be resent
                setMessages(prev => prev.filter(m => m.id !== replyId && m.id !== userMsg.id));
                setInput(content);
                setError(err.message || 'Could not reach the coach. Please try again.');
            } else {
                updateReply(m => ({ ...m, pending: false }));
                setError('The reply was interrupted. Please try again.');
            }
        } finally {
            setMessages(prev => prev.filter(m => !(m.id === replyId && !m.content)));
            setStreaming(false);
            abortRef.current = null;
            loadConversations();
        }
    };

    const stopReply = () => abortRef.current?.abort();

    const deleteConversation = async (e, convo) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${API_URL}/ai/conversations/${convo.id}`, { method: 'DELETE', headers: authHeaders });
            if (!res.ok && res.status !== 404) throw new Error();
            setConversations(prev => prev.filter(c => c.id !== convo.id));
            if (convo.id === activeId) newChat();
        } catch {
            setError('Could not delete that chat. Please try again.');
        }
    };

    const clearAll = async () => {
        setConfirmClear(false);
        try {
            const res = await fetch(`${API_URL}/ai/history`, { method: 'DELETE', headers: authHeaders });
            if (!res.ok) throw new Error();
            setConversations([]);
            newChat();
        } catch {
            setError('Could not clear your chats. Please try again.');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="chat-layout">
            {/* Conversation list (an overlay on phones) */}
            <div className={`chat-sidebar ${showList ? 'open' : ''}`}>
                <div className="chat-sidebar-header">
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Chats</h3>
                    <div className="flex gap-8">
                        <button className="btn-icon" onClick={newChat} title="New chat" aria-label="New chat" disabled={streaming}><Plus size={18} /></button>
                        <button className="btn-icon" onClick={() => setConfirmClear(true)} title="Delete all chats" aria-label="Delete all chats" style={{ color: 'var(--accent-red)' }} disabled={conversations.length === 0}><Trash2 size={16} /></button>
                        <button className="btn-icon chat-list-close" onClick={() => setShowList(false)} aria-label="Close chats"><X size={18} /></button>
                    </div>
                </div>
                <div className="chat-sidebar-list">
                    {loadingList ? (
                        <div style={{ padding: 30, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
                    ) : conversations.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center' }}>
                            <MessageSquare size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                            <p className="text-muted text-sm">No conversations yet</p>
                        </div>
                    ) : (
                        conversations.map(c => (
                            <div key={c.id} className={`chat-convo-item ${activeId === c.id ? 'active' : ''}`} onClick={() => openConversation(c)}>
                                <div className="convo-title">{c.title}</div>
                                {c.preview && <div className="convo-preview">{c.preview}</div>}
                                <div className="convo-date">{formatConvoDate(c.updatedAt)}</div>
                                <button className="convo-delete" onClick={(e) => deleteConversation(e, c)} title="Delete chat" aria-label={`Delete chat ${c.title}`}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat */}
            <div className="chat-main">
                <div className="chat-header">
                    <button className="btn-icon chat-list-toggle" onClick={() => setShowList(true)} aria-label="Show chats"><PanelLeft size={18} /></button>
                    <h3>{activeTitle}</h3>
                    <button className="btn-icon chat-list-toggle" onClick={newChat} aria-label="New chat" disabled={streaming}><Plus size={18} /></button>
                </div>

                {loadingMessages ? (
                    <div className="chat-empty-state"><div className="spinner" /></div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-blue-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bot size={32} color="var(--accent-blue)" />
                        </div>
                        <h3>What can I help with?</h3>
                        <p>I know your workouts, your stats and our past chats.</p>
                        <div className="quick-prompts">
                            {QUICK_PROMPTS.map(p => (
                                <button key={p} className="quick-prompt" onClick={() => sendMessage(p)}>{p}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="chat-messages" ref={scrollRef}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                                <div className="avatar">
                                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div className="message-content">
                                        {msg.pending && !msg.content ? (
                                            <span className="typing-dots" aria-label="Coach is typing"><span /><span /><span /></span>
                                        ) : msg.role === 'assistant' ? (
                                            <>
                                                <FormattedText text={msg.content} />
                                                {msg.pending && <span className="stream-cursor" />}
                                            </>
                                        ) : msg.content}
                                    </div>
                                    {msg.offline && <div className="message-note">Offline coach: the AI service wasn't available for this reply.</div>}
                                    {msg.stopped && <div className="message-note">Stopped</div>}
                                    {msg.createdAt && !msg.pending && (
                                        <div className="message-time">{new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && <div className="alert alert-error chat-error">{error}</div>}

                {/* Input */}
                <div className="chat-input-area">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        placeholder="Message AI Coach..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={4000}
                    />
                    {streaming ? (
                        <button className="chat-send-btn active" onClick={stopReply} title="Stop" aria-label="Stop generating">
                            <Square size={16} fill="currentColor" />
                        </button>
                    ) : (
                        <button className={`chat-send-btn ${input.trim() ? 'active' : 'inactive'}`} onClick={() => sendMessage()} disabled={!input.trim()} aria-label="Send message">
                            <Send size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Delete-all confirmation */}
            {confirmClear && (
                <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Delete all chats?</h2><button className="btn-icon" onClick={() => setConfirmClear(false)}><X size={18} /></button></div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Every conversation with the coach will be deleted, and it will forget what you told it. This can't be undone.</p>
                        <div className="confirm-actions">
                            <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={clearAll}>Delete All</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
