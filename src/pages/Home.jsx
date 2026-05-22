import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChapters } from '../services/api/quranApi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, Search, Bookmark, DownloadCloud, X, Hash, Layers3, LibraryBig, Rows3, ArrowRight, Flame, Clock, BarChart3, Sparkles, Share2, Copy, Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { HIZB_STARTS, JUZ_STARTS, PAGE_GROUPS } from '../data/quranNavigation';
import './Home.css';

// ─── Curated Verses of the Day ───
const DAILY_VERSES = [
    { arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', translation: '"In the name of Allah, the Most Gracious, the Most Merciful."', ref: 'Al-Fatiha 1:1' },
    { arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', translation: '"Guide us to the straight path."', ref: 'Al-Fatiha 1:6' },
    { arabic: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا', translation: '"Indeed, with hardship comes ease."', ref: 'Ash-Sharh 94:6' },
    { arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', translation: '"And your Lord is going to give you, and you will be satisfied."', ref: 'Ad-Duha 93:5' },
    { arabic: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ', translation: '"So remember Me; I will remember you."', ref: 'Al-Baqarah 2:152' },
    { arabic: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥ', translation: '"Whoever puts their trust in Allah, He is sufficient for them."', ref: 'At-Talaq 65:3' },
    { arabic: 'رَبِّ ٱشْرَحْ لِى صَدْرِى', translation: '"My Lord, expand for me my chest."', ref: 'Ta-Ha 20:25' },
    { arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا', translation: '"And say: My Lord, increase me in knowledge."', ref: 'Ta-Ha 20:114' },
    { arabic: 'إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ', translation: '"Indeed, Allah is with the patient."', ref: 'Al-Baqarah 2:153' },
    { arabic: 'وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ ٱلْوَرِيدِ', translation: '"And We are closer to him than his jugular vein."', ref: 'Qaf 50:16' },
    { arabic: 'فَإِنَّ ذِكْرَىٰ تَنفَعُ ٱلْمُؤْمِنِينَ', translation: '"And remind, for indeed, the reminder benefits the believers."', ref: 'Adh-Dhariyat 51:55' },
    { arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا', translation: '"Allah does not burden a soul beyond that it can bear."', ref: 'Al-Baqarah 2:286' },
];

const BROWSE_MODES = [
    { id: 'surah', label: 'Surah', icon: BookOpen },
    { id: 'page', label: 'Page', icon: Rows3 },
    { id: 'juz', label: 'Juz', icon: LibraryBig },
    { id: 'hizb', label: 'Hizb', icon: Layers3 },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getBrowseItems(mode, chapters) {
    if (mode === 'page') {
        return PAGE_GROUPS.map((item) => ({
            key: `page-${item.id}`, title: `Page ${item.pageNumber}`,
            subtitle: 'Mushaf page view', meta: `Page ${String(item.pageNumber).padStart(3, '0')}`,
            to: `/page/${item.pageNumber}`, arabic: null, prefix: null,
        }));
    }
    if (mode === 'juz') {
        return JUZ_STARTS.map((item) => ({
            key: `juz-${item.id}`, title: `Juz ${item.id}`,
            subtitle: `Starts at ${item.verseKey}`, meta: `Page ${item.pageNumber}`,
            to: `/page/${item.pageNumber}`, arabic: `الجزء ${item.id}`, prefix: item.id,
        }));
    }
    if (mode === 'hizb') {
        return HIZB_STARTS.map((item) => ({
            key: `hizb-${item.id}`, title: `Hizb ${item.id}`,
            subtitle: `Starts at ${item.verseKey}`, meta: `Page ${item.pageNumber}`,
            to: `/page/${item.pageNumber}`, arabic: `حزب ${item.id}`, prefix: item.id,
        }));
    }
    return (chapters || []).map((chapter) => ({
        key: `surah-${chapter.id}`, title: chapter.name_simple,
        subtitle: chapter.translated_name.name, meta: `${chapter.verses_count} Ayahs`,
        to: `/surah/${chapter.id}`, arabic: chapter.name_arabic, prefix: chapter.id,
    }));
}

function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { salam: 'Assalamu Alaikum', sub: 'May your morning be blessed' };
    if (h >= 12 && h < 17) return { salam: 'Assalamu Alaikum', sub: 'Wishing you a productive afternoon' };
    if (h >= 17 && h < 21) return { salam: 'Assalamu Alaikum', sub: 'May your evening be peaceful' };
    return { salam: 'Assalamu Alaikum', sub: 'May your night be filled with barakah' };
}

function getDailyVerse() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}

function formatDate() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function Home() {
    const { recentlyRead, bookmark, readingSessions } = useAppStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [browseMode, setBrowseMode] = useState('surah');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!location.state?.scrollToTop) return;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    // PWA install
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const dismissed = localStorage.getItem('hideInstallCard');
        if (!isStandalone && !dismissed) setIsInstallable(true);
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setIsInstallable(true); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const dismissInstall = (e) => { e.stopPropagation(); localStorage.setItem('hideInstallCard', 'true'); setIsInstallable(false); };
    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') { setDeferredPrompt(null); setIsInstallable(false); }
        } else {
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            alert(isIos ? "Tap Share → 'Add to Home Screen'." : "Look for 'Install App' in your browser menu.");
        }
    };

    const { data: chapters, isLoading, error } = useQuery({ queryKey: ['chapters'], queryFn: getChapters });
    const browseItems = useMemo(() => getBrowseItems(browseMode, chapters), [browseMode, chapters]);
    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return browseItems;
        return browseItems.filter(item => [item.title, item.subtitle, item.meta, item.arabic].filter(Boolean).some(v => v.toLowerCase().includes(q)));
    }, [browseItems, searchQuery]);

    // Computed stats
    const today = new Date().toISOString().split('T')[0];
    const sessions = readingSessions || [];

    const todayMinutes = useMemo(() => {
        return Math.round(sessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
    }, [sessions, today]);

    const totalHours = useMemo(() => {
        return (sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3600).toFixed(1);
    }, [sessions]);

    const streak = useMemo(() => {
        const uniqueDays = [...new Set(sessions.map(s => s.date))].sort().reverse();
        if (uniqueDays.length === 0) return 0;
        let count = 0;
        const d = new Date();
        const todayStr = d.toISOString().split('T')[0];
        // Check if today has a session
        if (uniqueDays[0] !== todayStr) {
            d.setDate(d.getDate() - 1);
            if (uniqueDays[0] !== d.toISOString().split('T')[0]) return 0;
        }
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const ds = checkDate.toISOString().split('T')[0];
            if (uniqueDays.includes(ds)) count++;
            else if (i > 0) break; // Allow gap only for today
        }
        return count;
    }, [sessions]);

    // Weekly heatmap
    const weekData = useMemo(() => {
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            const dayMins = Math.round(sessions.filter(s => s.date === ds).reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
            result.push({ label: DAY_LABELS[d.getDay()], mins: dayMins, isToday: i === 0 });
        }
        return result;
    }, [sessions]);

    const weekMax = useMemo(() => Math.max(...weekData.map(d => d.mins), 1), [weekData]);

    // Greeting & verse
    const greeting = useMemo(() => getGreeting(), []);
    const verse = useMemo(() => getDailyVerse(), []);

    // Continue reading
    const lastRead = recentlyRead?.[0];

    // Time ago
    const timeAgo = useCallback((ts) => {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }, []);

    // Copy verse
    const copyVerse = useCallback(() => {
        navigator.clipboard.writeText(`${verse.arabic}\n\n${verse.translation}\n— ${verse.ref}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [verse]);

    // Share verse
    const shareVerse = useCallback(() => {
        if (navigator.share) {
            navigator.share({ title: `Verse of the Day — ${verse.ref}`, text: `${verse.arabic}\n\n${verse.translation}\n— ${verse.ref}` });
        } else copyVerse();
    }, [verse, copyVerse]);

    if (isLoading) return (
        <div className="home">
            <div className="home-loading">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid var(--h-bone-dark)', borderTopColor: 'var(--h-teal)', borderRadius: '50%', marginBottom: '1rem' }} />
                <p>Loading...</p>
            </div>
        </div>
    );

    if (error) return <div className="home"><div className="home-empty">Error fetching data. Please try again later.</div></div>;

    return (
        <div className="home">
            <Helmet>
                <title>The Noble Qur'an — Read, Study, Learn</title>
                <meta name="description" content="A beautiful web application for reading and studying the Noble Qur'an." />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* Offline Banner */}
                <AnimatePresence>
                    {!isOnline && (
                        <motion.div className="home-offline" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <span className="home-offline-dot" /> Offline Mode — Using Cached Data
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Install Banner */}
                <AnimatePresence>
                    {isInstallable && (
                        <motion.div className="home-install" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }} onClick={handleInstallClick}>
                            <button className="home-install-close" onClick={dismissInstall}><X size={14} /></button>
                            <div className="home-install-inner">
                                <div className="home-install-icon"><DownloadCloud size={22} /></div>
                                <div>
                                    <div className="home-install-title">Install App</div>
                                    <div className="home-install-sub">Read offline with a native feel</div>
                                </div>
                            </div>
                            <span className="home-install-btn">Install</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── Greeting Hero ─── */}
                <div className="home-hero">
                    <h1 className="home-salam">{greeting.salam}</h1>
                    <p className="home-greeting-sub">{greeting.sub}</p>
                    <p className="home-date">{formatDate()}</p>

                    {lastRead && (
                        <Link to={lastRead.verseKey ? `/surah/${lastRead.chapterId}?verse=${lastRead.verseKey}` : `/surah/${lastRead.chapterId}`}
                            className="home-continue">
                            <div className="home-continue-icon"><BookOpen size={22} /></div>
                            <div className="home-continue-info">
                                <div className="home-continue-title">Continue: {lastRead.chapterName}</div>
                                <div className="home-continue-sub">{lastRead.verseKey ? `Verse ${lastRead.verseKey.split(':')[1]}` : 'From the beginning'} · {timeAgo(lastRead.timestamp)}</div>
                            </div>
                            <ArrowRight size={18} className="home-continue-arrow" />
                        </Link>
                    )}
                </div>

                {/* ─── Stats Row ─── */}
                <div className="home-stats">
                    <div className="home-stat">
                        <div className="home-stat-icon"><Flame size={18} color={streak > 0 ? '#ef4444' : 'var(--h-ink-muted)'} /></div>
                        <div className="home-stat-value">{streak}<small> days</small></div>
                        <div className="home-stat-label">Streak</div>
                    </div>
                    <div className="home-stat">
                        <div className="home-stat-icon"><Clock size={18} color="var(--h-teal)" /></div>
                        <div className="home-stat-value">{todayMinutes}<small> min</small></div>
                        <div className="home-stat-label">Today</div>
                    </div>
                    <div className="home-stat">
                        <div className="home-stat-icon"><BarChart3 size={18} color="var(--h-gold)" /></div>
                        <div className="home-stat-value">{totalHours}<small> hrs</small></div>
                        <div className="home-stat-label">Total</div>
                    </div>
                </div>

                {/* ─── Verse of the Day ─── */}
                <div className="home-votd">
                    <div className="home-votd-label"><Sparkles size={14} /> Verse of the Day</div>
                    <div className="home-votd-arabic quran-text" style={{ fontFamily: 'var(--quran-font-family, "Amiri Quran", serif)' }}>
                        {verse.arabic}
                    </div>
                    <div className="home-votd-translation">{verse.translation}</div>
                    <div className="home-votd-ref">— {verse.ref}</div>
                    <div className="home-votd-actions">
                        <button className={`home-votd-btn ${copied ? 'copied' : ''}`} onClick={copyVerse}>
                            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button className="home-votd-btn" onClick={shareVerse}><Share2 size={14} /> Share</button>
                    </div>
                </div>

                {/* ─── Weekly Heatmap ─── */}
                <div className="home-week">
                    <div className="home-section-header">
                        <h2 className="home-section-title"><BarChart3 size={16} /> This Week</h2>
                    </div>
                    <div className="home-week-grid">
                        {weekData.map((day, i) => {
                            const pct = Math.round((day.mins / weekMax) * 100);
                            let level = 'low';
                            if (pct > 20) level = 'med';
                            if (pct > 50) level = 'high';
                            if (pct > 80) level = 'max';
                            return (
                                <div key={i} className="home-week-day">
                                    <span className={`home-week-label ${day.isToday ? 'home-week-today' : ''}`}>{day.label}</span>
                                    <div className="home-week-bar-track">
                                        <div className={`home-week-bar-fill ${day.mins > 0 ? level : ''}`}
                                            style={{ height: day.mins > 0 ? `${Math.max(15, pct)}%` : '0%' }} />
                                    </div>
                                    <span className={`home-week-mins ${day.isToday ? 'home-week-today' : ''}`}>{day.mins}m</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Bookmark ─── */}
                {bookmark && (
                    <Link to={`/surah/${bookmark.chapterId || bookmark.verseKey.split(':')[0]}?verse=${bookmark.verseKey}`}
                        className="home-bookmark-card">
                        <div className="home-bookmark-icon"><Bookmark size={20} color="var(--h-gold)" /></div>
                        <div className="home-bookmark-info">
                            <div className="home-bookmark-name">{bookmark.surahName}</div>
                            <div className="home-bookmark-detail">Verse {bookmark.verseKey.split(':')[1]} · Resume reading</div>
                        </div>
                        <ArrowRight size={16} color="var(--h-gold)" />
                    </Link>
                )}

                {/* ─── Recently Read ─── */}
                {recentlyRead?.length > 0 && (
                    <>
                        <div className="home-section-header">
                            <h2 className="home-section-title"><BookOpen size={16} /> Recently Read</h2>
                        </div>
                        <div className="home-recent-scroll">
                            {recentlyRead.slice(0, 6).map((item) => (
                                <Link key={item.chapterId} to={item.verseKey ? `/surah/${item.chapterId}?verse=${item.verseKey}` : `/surah/${item.chapterId}`}
                                    className="home-recent-card">
                                    <div className="home-recent-num">{item.chapterId}</div>
                                    <div className="home-recent-name">{item.chapterName}</div>
                                    {item.verseKey && <div className="home-recent-detail">Verse {item.verseKey.split(':')[1]}</div>}
                                    <div className="home-recent-detail">{timeAgo(item.timestamp)}</div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}

                {/* ─── Browse the Quran ─── */}
                <section>
                    <div className="home-browse-header">
                        <div>
                            <h2 className="home-browse-title"><BookOpen size={20} /> Browse the Quran</h2>
                            <p className="home-browse-sub">Select a Surah, Page, Juz, or Hizb to begin.</p>
                        </div>
                        <div className="home-mode-tabs">
                            {BROWSE_MODES.map(mode => {
                                const Icon = mode.icon;
                                return (
                                    <button key={mode.id} className={`home-mode-tab ${browseMode === mode.id ? 'active' : ''}`}
                                        onClick={() => setBrowseMode(mode.id)}>
                                        <Icon size={14} /> {mode.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="home-search">
                        <Search size={18} />
                        <input type="text" placeholder={`Search ${browseMode}...`} value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="home-browse-grid">
                        {filteredItems.map(item => (
                            <motion.div key={item.key} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                <Link to={item.to} className="home-browse-card">
                                    <div className="home-browse-num">{item.prefix || <Hash size={14} />}</div>
                                    <div className="home-browse-info">
                                        <div className="home-browse-name">
                                            <span className="home-browse-name-text">{item.title}</span>
                                            {item.arabic && <span className="home-browse-arabic">{item.arabic}</span>}
                                        </div>
                                        <div className="home-browse-meta">
                                            <span>{item.subtitle}</span>
                                            <span className="home-browse-pill">{item.meta}</span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {filteredItems.length === 0 && <div className="home-empty">No results matching your search.</div>}
                </section>
            </motion.div>
        </div>
    );
}
