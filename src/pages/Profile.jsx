import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
    User, Settings, Bookmark, Folder, Moon, Sun,
    ChevronRight, HardDrive, LogOut, CloudUpload, CloudDownload,
    Loader2, Mic, Languages, TrendingUp, CalendarDays, BookOpen, Brain, ChevronDown, Users
} from 'lucide-react';
import { authService, syncService } from '../services/appwrite';

const RECITERS = [
    { id: 7, name: 'Mishary Rashid Alafasy' },
    { id: 1, name: 'AbdulBaset AbdulSamad' },
    { id: 3, name: 'Abdur-Rahman as-Sudais' },
    { id: 4, name: 'Abu Bakr al-Shatri' },
];
const TRANSLATIONS = [
    { id: 85, name: 'Abdel Haleem' }, { id: 20, name: 'Saheeh Intl' },
    { id: 22, name: 'Yusuf Ali' }, { id: 84, name: 'Mufti Taqi Usmani' },
    { id: 32, name: 'Abubakar Gumi' }, { id: 234, name: 'Jalandhari' },
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

/* SVG ring component */
function GoalRing({ pct, size = 120, stroke = 8 }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="block -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--h-bone)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={pct >= 100 ? 'var(--h-green)' : 'var(--h-teal)'}
                strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
    );
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
        e.preventDefault(); setIsLoading(true); setAuthError('');
        try {
            if (authMode === 'register') { await authService.register(email, password, name); await authService.login(email, password); }
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

    if (isLoading && !user && !authError && email === '') {
        return <div className="flex justify-center pt-16"><Loader2 size={28} className="animate-spin text-[var(--h-gold)]" /></div>;
    }

    return (
        <div className="mx-auto max-w-[1200px] px-4 pb-24">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* ═══ HERO ═══ */}
                <div className="pb-5 pt-5 text-center">
                    <span className="font-[var(--font-mono)] text-[0.62rem] uppercase tracking-[0.14em] text-[var(--h-ink-muted)]">Your Account</span>
                    {user ? (
                        <>
                            <h1 className="mt-1 font-[var(--font-ui)] text-[1.75rem] font-bold text-[var(--h-ink)]">{user.name || 'Quran Student'}</h1>
                            <p className="mt-0.5 text-[0.82rem] text-[var(--h-ink-muted)]">{user.email}</p>
                        </>
                    ) : (
                        <>
                            <h1 className="mt-1 font-[var(--font-ui)] text-[1.75rem] font-bold text-[var(--h-ink)]">{greeting}</h1>
                            <p className="mt-0.5 text-[0.82rem] text-[var(--h-ink-muted)]">Your personal Quran companion</p>
                        </>
                    )}
                </div>

                {/* ═══ DAILY GOAL RING ═══ */}
                <div className="mb-5 rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5">
                    <div className="flex items-center gap-5">
                        <div className="relative flex-shrink-0">
                            <GoalRing pct={goalPct} size={100} stroke={7} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="font-[var(--font-ui)] text-[1.5rem] font-bold leading-none text-[var(--h-ink)]">
                                    {goalPct >= 100 ? '✓' : `${Math.min(goalPct, 99)}%`}
                                </span>
                                <span className="mt-0.5 font-[var(--font-mono)] text-[0.5rem] uppercase tracking-wider text-[var(--h-ink-muted)]">
                                    {goalPct >= 100 ? 'Complete' : 'of goal'}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-[var(--font-ui)] text-[1.05rem] font-semibold text-[var(--h-ink)]">Today's Reading</h3>
                            <p className="mt-0.5 text-[0.82rem] text-[var(--h-ink-muted)]">
                                {formatMinutes(todayTotal)} of {goalMins}m goal
                            </p>
                            <button
                                onClick={() => setShowGoalPicker(!showGoalPicker)}
                                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--h-teal-soft)] px-2.5 py-1.5 font-[var(--font-mono)] text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--h-teal)] transition-colors hover:bg-[var(--h-bone)]"
                            >
                                Set Goal <ChevronDown size={12} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showGoalPicker && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--h-bone)] pt-3">
                                    {GOAL_OPTIONS.map(mins => (
                                        <button key={mins} onClick={() => { setDailyReadingGoal(mins); setShowGoalPicker(false); }}
                                            className={`rounded-lg px-3 py-1.5 font-[var(--font-mono)] text-[0.68rem] font-semibold transition-colors ${goalMins === mins ? 'bg-[var(--h-teal)] text-white' : 'bg-[var(--h-bone)] text-[var(--h-ink-mid)] hover:bg-[var(--h-bone-dark)]'}`}>
                                            {mins}m
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ═══ QUICK LINKS ═══ */}
                <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {[
                        { icon: Bookmark, label: 'Bookmarks', count: (bookmarks || []).length, to: '/library' },
                        { icon: TrendingUp, label: 'Analytics', to: '/progress' },
                        { icon: CalendarDays, label: 'Planner', to: '/planner' },
                        { icon: Brain, label: 'Memorize', to: '/memorize' },
                        { icon: Users, label: 'Sauka', to: '/sauka' },
                    ].map((item, i) => (
                        <Link key={i} to={item.to} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-3 no-underline transition-colors hover:border-[var(--h-gold)]">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--h-teal-soft)]">
                                <item.icon size={15} className="text-[var(--h-teal)]" />
                            </div>
                            {item.count !== undefined && (
                                <span className="font-[var(--font-ui)] text-[1.1rem] font-bold leading-none text-[var(--h-ink)]">{item.count}</span>
                            )}
                            <span className="font-[var(--font-mono)] text-[0.5rem] uppercase tracking-[0.08em] text-[var(--h-ink-muted)]">{item.label}</span>
                        </Link>
                    ))}
                </div>

                {/* ═══ CLOUD SYNC ═══ */}
                {!user ? (
                    <div className="mb-5 rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-4">
                        <button onClick={() => setShowAuthForm(!showAuthForm)}
                            className="flex w-full items-center justify-between bg-transparent text-left">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--h-teal-soft)]">
                                    <CloudUpload size={17} className="text-[var(--h-teal)]" />
                                </div>
                                <div>
                                    <span className="text-[0.9rem] font-semibold text-[var(--h-ink)]">Sign in to sync</span>
                                    <p className="mt-0.5 text-[0.72rem] text-[var(--h-ink-muted)]">Backup bookmarks & settings to cloud</p>
                                </div>
                            </div>
                            <ChevronDown size={16} className={`text-[var(--h-ink-muted)] transition-transform ${showAuthForm ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showAuthForm && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <form onSubmit={handleAuth} className="mt-4 space-y-2.5 border-t border-[var(--h-bone)] pt-4">
                                        {authError && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-[0.78rem] font-semibold text-red-500">{authError}</div>}
                                        {authMode === 'register' && (
                                            <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)}
                                                className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-2.5 text-[0.85rem] text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" required />
                                        )}
                                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                                            className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-2.5 text-[0.85rem] text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" required />
                                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                                            className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-2.5 text-[0.85rem] text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" minLength={8} required />
                                        <button type="submit" disabled={isLoading}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-2.5 text-[0.85rem] font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                                        </button>
                                        <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                                            className="w-full bg-transparent text-center text-[0.78rem] font-semibold text-[var(--h-ink-muted)] hover:text-[var(--h-teal)]">
                                            {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="mb-5 rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <CloudUpload size={15} className="text-[var(--h-teal)]" />
                            <h3 className="font-[var(--font-ui)] text-[1.05rem] font-semibold text-[var(--h-ink)]">Cloud Sync</h3>
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--h-green)]" />
                            <span className="font-[var(--font-mono)] text-[0.62rem] text-[var(--h-ink-muted)]">Last synced: {timeAgo(lastSyncAt)}</span>
                        </div>
                        <AnimatePresence mode="wait">
                            {syncStatus === 'pushing' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--h-gold)]"><Loader2 size={14} className="animate-spin" /> Saving...</motion.p>}
                            {syncStatus === 'pulling' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--h-gold)]"><Loader2 size={14} className="animate-spin" /> Restoring...</motion.p>}
                            {syncStatus === 'success' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 text-[0.78rem] font-semibold text-[var(--h-green)]">✓ Sync complete</motion.p>}
                            {syncStatus === 'error' && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 text-[0.78rem] font-semibold text-red-500">Failed. Try again.</motion.p>}
                        </AnimatePresence>
                        <div className="flex gap-2.5">
                            <button onClick={handlePullSync} disabled={!!syncStatus} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--h-teal)] bg-transparent py-2.5 text-[0.78rem] font-bold text-[var(--h-teal)] hover:bg-[var(--h-teal-soft)] disabled:opacity-40">
                                <CloudDownload size={15} /> Restore
                            </button>
                            <button onClick={handlePushSync} disabled={!!syncStatus} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-2.5 text-[0.78rem] font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-40">
                                <CloudUpload size={15} /> Backup
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ PREFERENCES ═══ */}
                <div className="mb-5">
                    <h2 className="mb-2 pl-1 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-[0.12em] text-[var(--h-ink-muted)]">Preferences</h2>
                    <div className="overflow-hidden rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)]">
                        {[
                            { icon: theme === 'light' ? Moon : Sun, label: 'Appearance', detail: theme === 'light' ? 'Light' : 'Dark', onClick: toggleTheme },
                            { icon: Settings, label: 'Reading Settings', onClick: () => setIsSettingsOpen(true) },
                            { icon: Mic, label: 'Reciter', detail: reciterName, onClick: () => setIsSettingsOpen(true) },
                            { icon: Languages, label: 'Translation', detail: translationName, onClick: () => setIsSettingsOpen(true) },
                            { icon: HardDrive, label: 'Offline Library', to: '/offline-library' },
                        ].map((item, i, arr) => {
                            const Tag = item.to ? Link : 'button';
                            const props = item.to ? { to: item.to } : { type: 'button', onClick: item.onClick };
                            return (
                                <Tag key={i} {...props}
                                    className={`flex w-full cursor-pointer items-center justify-between bg-transparent px-4 py-3.5 text-left text-[var(--h-ink)] no-underline transition-colors hover:bg-[var(--h-bone)] ${i < arr.length - 1 ? 'border-b border-[var(--h-bone)]' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--h-teal-soft)] text-[var(--h-teal)]"><item.icon size={17} /></div>
                                        <span className="text-[0.9rem] font-semibold">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {item.detail && <span className="max-w-[130px] truncate font-[var(--font-mono)] text-[0.68rem] text-[var(--h-ink-muted)]">{item.detail}</span>}
                                        <ChevronRight size={16} className="text-[var(--h-ink-muted)]" />
                                    </div>
                                </Tag>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ DANGER ZONE ═══ */}
                {user && (
                    <div className="mb-5">
                        <h2 className="mb-2 pl-1 font-[var(--font-mono)] text-[0.6rem] uppercase tracking-[0.12em] text-red-400/70">Danger Zone</h2>
                        <div className="overflow-hidden rounded-2xl border border-red-500/15 bg-[var(--h-cream)]">
                            <button type="button" onClick={handleLogout} disabled={isLoading}
                                className="flex w-full cursor-pointer items-center justify-between bg-transparent px-4 py-3.5 text-left text-red-500 hover:bg-red-500/5 disabled:opacity-40">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-red-500/8 text-red-500"><LogOut size={17} /></div>
                                    <span className="text-[0.9rem] font-semibold">Sign Out</span>
                                </div>
                                <ChevronRight size={16} className="text-red-400/50" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ ABOUT ═══ */}
                <div className="pt-2 text-center">
                    <p className="font-[var(--font-mono)] text-[0.58rem] text-[var(--h-ink-muted)]">Quran Nur · v1.0.0</p>
                    <p className="mt-0.5 font-[var(--font-body)] text-[0.68rem] italic text-[var(--h-ink-muted)]">Made with ♥ for the Ummah</p>
                </div>

            </motion.div>
        </div>
    );
}
