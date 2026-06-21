import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
    User, Settings, Bookmark, Folder, Moon, Sun,
    ChevronRight, HardDrive, LogOut, CloudUpload, CloudDownload,
    Loader2, Mic, Languages, TrendingUp, CalendarDays, BookOpen, Brain, ChevronDown, Users,
    Clock, Shield
} from 'lucide-react';
import { authService, syncService } from '../services/appwrite';
import { RECITERS } from '../config/reciters';

const TRANSLATIONS = [
    { id: 85, name: 'English - M.A.S. Abdel Haleem' },
    { id: 131, name: 'English - Dr. Mustafa Khattab' },
    { id: 20, name: 'English - Saheeh International' },
    { id: 22, name: 'English - A. Yusuf Ali' },
    { id: 84, name: 'English - Mufti Taqi Usmani' },
    { id: 32, name: 'Hausa - Abubakar Mahmoud Gumi' },
    { id: 234, name: 'Urdu - Fatah Muhammad Jalandhari' }
];
const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];

function formatMinutes(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), r = m % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
}
function timeAgo(ts) {
    if (!ts) return 'Never';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function Profile() {
    const store = useAppStore();
    const {
        setNavHeaderTitle, setIsSettingsOpen, bookmarks, collections,
        theme, toggleTheme, readingSessions, lastSyncAt,
        reciterId, translationId, dailyReadingGoal, setDailyReadingGoal,
    } = store;

    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState(null);
    const [authError, setAuthError] = useState('');
    const [authSuccess, setAuthSuccess] = useState('');
    const [showAuthForm, setShowAuthForm] = useState(false);
    const [showGoalPicker, setShowGoalPicker] = useState(false);

    useEffect(() => {
        setNavHeaderTitle('Profile');
        checkUser();
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const checkUser = async () => {
        setIsLoading(true);
        const u = await authService.getCurrentUser();
        setUser(u);
        setIsLoading(false);
    };

    const handleAuth = async (e) => {
        e.preventDefault(); setIsLoading(true); setAuthError(''); setAuthSuccess('');
        try {
            if (authMode === 'register') { await authService.register(email, password, name); await authService.login(email, password); }
            else if (authMode === 'forgot') {
                await authService.sendPasswordRecovery(email, window.location.origin + '/profile');
                setAuthSuccess('Recovery email sent. Check your inbox.');
                setIsLoading(false);
                return;
            }
            else { await authService.login(email, password); }
            await checkUser(); setEmail(''); setPassword(''); setName(''); setShowAuthForm(false);
        } catch (err) { setAuthError(err.message || 'Authentication failed'); }
        finally { setIsLoading(false); }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        try { await authService.logout(); setUser(null); } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handlePushSync = async () => {
        if (!user) return; setSyncStatus('pushing');
        try {
            const s = useAppStore.getState();
            await syncService.pushState(user.$id, {
                theme: s.theme, translationId: s.translationId, reciterId: s.reciterId,
                fontSize: s.fontSize, translationFontSize: s.translationFontSize,
                readingMode: s.readingMode, mushafId: s.mushafId, arabicFontId: s.arabicFontId,
                tajweedEnabled: s.tajweedEnabled, tafsirId: s.tafsirId,
                bookmark: s.bookmark, bookmarks: s.bookmarks,
                memorizedAyahs: s.memorizedAyahs, memorizedSurahs: s.memorizedSurahs,
                collections: s.collections, recentlyRead: s.recentlyRead, readingSessions: s.readingSessions,
                pomodoroProfiles: s.pomodoroProfiles, activePomodoroProfileId: s.activePomodoroProfileId,
                pomodoroHistory: s.pomodoroHistory, pomodoroCompletedFocusCount: s.pomodoroCompletedFocusCount,
                planners: s.planners, activePlannerId: s.activePlannerId, downloadedSurahs: s.downloadedSurahs,
                dailyReadingGoal: s.dailyReadingGoal,
            });
            setSyncStatus('success'); setTimeout(() => setSyncStatus(null), 3000);
        } catch (e) { console.error(e); setSyncStatus('error'); setTimeout(() => setSyncStatus(null), 3000); }
    };

    const handlePullSync = async () => {
        if (!user) return; setSyncStatus('pulling');
        try {
            const r = await syncService.pullState(user.$id);
            if (r) useAppStore.setState(r);
            setSyncStatus('success'); setTimeout(() => setSyncStatus(null), 3000);
        } catch (e) { console.error(e); setSyncStatus('error'); setTimeout(() => setSyncStatus(null), 3000); }
    };

    // ─── Computed ───
    const sessions = readingSessions || [];
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = useMemo(() => sessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0), [sessions, today]);
    const todayMins = Math.round(todayTotal / 60);
    const goalMins = dailyReadingGoal || 20;
    const goalPct = goalMins > 0 ? Math.round((todayMins / goalMins) * 100) : 0;

    const reciterName = useMemo(() => RECITERS.find(r => r.id === reciterId)?.name || 'Unknown', [reciterId]);
    const translationName = useMemo(() => TRANSLATIONS.find(t => t.id === translationId)?.name || 'Unknown', [translationId]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const getInitials = (nameStr) => {
        if (!nameStr) return '?';
        return nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (isLoading && !user && !authError && email === '') {
        return <div className="flex justify-center pt-16"><Loader2 size={28} className="animate-spin text-[var(--accent-primary)]" /></div>;
    }

    return (
        <div className="mx-auto max-w-[1200px] px-4 pb-24 text-[var(--text-primary)]">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* ═══ PREMIUM HERO ═══ */}
                <div className="py-8 text-center relative overflow-hidden flex flex-col items-center">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[var(--accent-primary)]/10 blur-[40px] rounded-full pointer-events-none" />
                    
                    <div className="relative w-24 h-24 rounded-full border-2 border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-secondary)] shadow-[0_0_20px_var(--shadow-glass)] flex items-center justify-center mb-4 overflow-hidden group">
                        {user ? (
                            <span className="font-ui text-[2.5rem] font-bold text-[var(--text-primary)]">{getInitials(user.name || user.email)}</span>
                        ) : (
                            <User size={40} className="text-[var(--text-secondary)] opacity-50" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--accent-primary)]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="relative z-10">
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-1 block">Your Profile</span>
                        {user ? (
                            <>
                                <h1 className="font-ui text-[1.75rem] font-bold text-[var(--text-primary)]">{user.name || 'Quran Student'}</h1>
                                <p className="mt-0.5 text-[0.85rem] text-[var(--text-secondary)]">{user.email}</p>
                            </>
                        ) : (
                            <>
                                <h1 className="font-ui text-[1.75rem] font-bold text-[var(--text-primary)]">{greeting}</h1>
                                <p className="mt-0.5 text-[0.85rem] text-[var(--text-secondary)]">Your personal Quran companion</p>
                            </>
                        )}
                    </div>
                </div>

                {/* ═══ SLEEK GOAL CARD ═══ */}
                <div className="mb-6 rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h3 className="font-ui text-[1rem] font-bold text-[var(--text-primary)]">Daily Goal</h3>
                                <p className="text-[0.75rem] text-[var(--text-secondary)]">{formatMinutes(todayTotal)} / {goalMins}m today</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGoalPicker(!showGoalPicker)}
                            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border-[1.5px] border-[var(--h-bone-dark)]"
                        >
                            <Settings size={14} className={showGoalPicker ? 'rotate-90 transition-transform' : 'transition-transform'} />
                        </button>
                    </div>

                    <div className="relative h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--accent-primary)] to-[#10b981] rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(goalPct, 100)}%` }}
                        />
                    </div>

                    <AnimatePresence>
                        {showGoalPicker && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t-[1.5px] border-[var(--h-bone-dark)]">
                                    {GOAL_OPTIONS.map(mins => (
                                        <button key={mins} onClick={() => { setDailyReadingGoal(mins); setShowGoalPicker(false); }}
                                            className={`rounded-full px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider font-semibold transition-all ${goalMins === mins ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)] shadow-[0_0_10px_var(--accent-light)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--h-bone)] hover:text-[var(--text-primary)] border-[1.5px] border-[var(--h-bone-dark)]'}`}>
                                            {mins}m
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ═══ QUICK LINKS ROW ═══ */}
                <div className="mb-6 w-full overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex gap-3 min-w-max">
                        {[
                            { icon: Bookmark, label: 'Bookmarks', to: '/library' },
                            { icon: TrendingUp, label: 'Analytics', to: '/progress' },
                            { icon: CalendarDays, label: 'Planner', to: '/planner' },
                            { icon: Brain, label: 'Memorize', to: '/memorize' },
                            { icon: Users, label: 'Sauka', to: '/sauka' },
                        ].map((item, i) => (
                            <Link key={i} to={item.to} className="flex items-center gap-3 rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-3 no-underline transition-all hover:border-[var(--accent-hover)] hover:-translate-y-0.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                                    <item.icon size={16} />
                                </div>
                                <span className="font-ui text-[0.85rem] font-bold text-[var(--text-primary)]">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* ═══ READING EXPERIENCE ═══ */}
                <div className="mb-6">
                    <h2 className="mb-2 pl-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Reading Experience</h2>
                    <div className="overflow-hidden rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)]">
                        {[
                            { icon: Settings, label: 'Reading Settings', onClick: () => setIsSettingsOpen(true) },
                            { icon: Mic, label: 'Reciter', detail: reciterName, onClick: () => setIsSettingsOpen(true) },
                            { icon: Languages, label: 'Translation', detail: translationName, onClick: () => setIsSettingsOpen(true) },
                        ].map((item, i, arr) => (
                            <button key={i} onClick={item.onClick}
                                className={`flex w-full items-center justify-between bg-transparent px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)] ${i < arr.length - 1 ? 'border-b-[1.5px] border-[var(--h-bone-dark)]' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><item.icon size={18} /></div>
                                    <span className="text-[0.95rem] font-bold text-[var(--text-primary)]">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.detail && <span className="max-w-[120px] truncate font-mono text-[0.65rem] text-[var(--text-secondary)] uppercase">{item.detail}</span>}
                                    <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-50" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══ APP & STORAGE ═══ */}
                <div className="mb-6">
                    <h2 className="mb-2 pl-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">App & Storage</h2>
                    <div className="overflow-hidden rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)]">
                        {[
                            { icon: theme === 'light' ? Moon : Sun, label: 'Appearance', detail: theme === 'light' ? 'Light' : 'Dark', onClick: toggleTheme },
                            { icon: HardDrive, label: 'Offline Library', to: '/offline-library' },
                        ].map((item, i, arr) => {
                            const Tag = item.to ? Link : 'button';
                            const props = item.to ? { to: item.to } : { type: 'button', onClick: item.onClick };
                            return (
                                <Tag key={i} {...props}
                                    className={`flex w-full items-center justify-between bg-transparent px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)] ${i < arr.length - 1 ? 'border-b-[1.5px] border-[var(--h-bone-dark)]' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><item.icon size={18} /></div>
                                        <span className="text-[0.95rem] font-bold text-[var(--text-primary)]">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.detail && <span className="max-w-[120px] truncate font-mono text-[0.65rem] text-[var(--text-secondary)] uppercase">{item.detail}</span>}
                                        <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-50" />
                                    </div>
                                </Tag>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ CLOUD SYNC ═══ */}
                <div className="mb-6">
                    <h2 className="mb-2 pl-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Cloud Sync</h2>
                    {!user ? (
                        <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5">
                            <button onClick={() => setShowAuthForm(!showAuthForm)}
                                className="flex w-full items-center justify-between bg-transparent text-left">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                                        <CloudUpload size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[0.95rem] font-bold text-[var(--text-primary)]">Sign in to sync</span>
                                        <p className="mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">Backup bookmarks & settings</p>
                                    </div>
                                </div>
                                <ChevronDown size={18} className={`text-[var(--text-secondary)] transition-transform ${showAuthForm ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showAuthForm && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <form onSubmit={handleAuth} className="mt-5 space-y-3 border-t-[1.5px] border-[var(--h-bone-dark)] pt-5">
                                            {authError && <div className="rounded-[12px] bg-red-500/10 px-4 py-3 text-[0.8rem] font-bold text-red-500 border border-red-500/20">{authError}</div>}
                                            {authSuccess && <div className="rounded-[12px] bg-green-500/10 px-4 py-3 text-[0.8rem] font-bold text-green-600 border border-green-500/20">{authSuccess}</div>}
                                            {authMode === 'register' && (
                                                <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)}
                                                    className="w-full rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 text-[0.9rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors" required />
                                            )}
                                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                                                className="w-full rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 text-[0.9rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors" required />
                                            {authMode !== 'forgot' && (
                                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                                                    className="w-full rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3 text-[0.9rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors" minLength={8} required />
                                            )}
                                            <button type="submit" disabled={isLoading}
                                                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--text-primary)] py-3 text-[0.9rem] font-bold text-[var(--bg-primary)] hover:scale-[0.98] transition-transform disabled:opacity-50 mt-2">
                                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : (authMode === 'login' ? 'Sign In' : authMode === 'register' ? 'Create Account' : 'Send Recovery Link')}
                                            </button>
                                            
                                            <div className="flex flex-col items-center gap-3 mt-4">
                                                <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); setAuthSuccess(''); }}
                                                    className="text-[0.8rem] font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                                                    {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                                                </button>
                                                {authMode !== 'forgot' && (
                                                    <button type="button" onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                                                        className="text-[0.75rem] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] underline underline-offset-2">
                                                        Forgot Password?
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                                        <CloudUpload size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-ui text-[1rem] font-bold text-[var(--text-primary)]">Backup & Restore</h3>
                                        <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--text-secondary)]">Last synced: {timeAgo(lastSyncAt)}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <AnimatePresence mode="wait">
                                {syncStatus === 'pushing' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-center gap-2 text-[0.8rem] font-bold text-[var(--accent-primary)]"><Loader2 size={16} className="animate-spin" /> Saving data...</motion.div>}
                                {syncStatus === 'pulling' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-center gap-2 text-[0.8rem] font-bold text-[var(--accent-primary)]"><Loader2 size={16} className="animate-spin" /> Restoring data...</motion.div>}
                                {syncStatus === 'success' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 text-[0.8rem] font-bold text-[#10b981]">✓ Sync complete successfully.</motion.div>}
                                {syncStatus === 'error' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 text-[0.8rem] font-bold text-red-500">Failed to sync. Please try again.</motion.div>}
                            </AnimatePresence>
                            
                            <div className="flex gap-3">
                                <button onClick={handlePullSync} disabled={!!syncStatus} className="flex flex-1 items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] py-3 text-[0.85rem] font-bold text-[var(--text-primary)] hover:bg-[var(--h-bone)] transition-colors disabled:opacity-50">
                                    <CloudDownload size={16} /> Restore
                                </button>
                                <button onClick={handlePushSync} disabled={!!syncStatus} className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[var(--text-primary)] py-3 text-[0.85rem] font-bold text-[var(--bg-primary)] hover:scale-[0.98] transition-transform disabled:opacity-50">
                                    <CloudUpload size={16} /> Backup
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ DANGER ZONE ═══ */}
                {user && (
                    <div className="mb-8">
                        <h2 className="mb-2 pl-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-red-500/70">Danger Zone</h2>
                        <div className="overflow-hidden rounded-[24px] border-[1.5px] border-red-500/20 bg-[var(--h-cream)]">
                            <button type="button" onClick={handleLogout} disabled={isLoading}
                                className="flex w-full cursor-pointer items-center justify-between bg-transparent px-5 py-4 text-left hover:bg-red-500/5 transition-colors disabled:opacity-40">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-500/10 text-red-500"><LogOut size={18} /></div>
                                    <span className="text-[0.95rem] font-bold text-red-500">Sign Out</span>
                                </div>
                                <ChevronRight size={16} className="text-red-500/50" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ FOOTER ═══ */}
                <div className="pt-4 text-center">
                    <p className="font-mono text-[0.6rem] tracking-[0.1em] text-[var(--text-secondary)] uppercase">Quran Nur · v1.0.0</p>
                    <p className="mt-1 font-ui text-[0.75rem] text-[var(--text-secondary)] italic opacity-70">Made with ♥ for the Ummah</p>
                </div>

            </motion.div>
        </div>
    );
}
