import { useCallback, useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getLocalAudioDirHandle } from '../utils/localAudio';
import { Moon, Sun, Settings, ArrowLeft, BookOpen, ChevronsDown, Volume2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalAudioPlayer from './GlobalAudioPlayer';
import SettingsDrawer from './SettingsDrawer';
import NavigationModal from './NavigationModal';
import WordTranslationTooltip from './WordTranslationTooltip';

export default function Layout() {
    const {
        theme, toggleTheme, navHeaderTitle, readingMode, setReadingMode,
        autoScroll, setAutoScroll,
        setLocalAudioDirHandle,
        isPlayerVisible, setIsPlayerVisible,
        audioPlaylist, currentAudioUrl, isPlaying,
        incrementPlayTrigger,
        isSettingsOpen, setIsSettingsOpen,
        pomodoroIsRunning, tickPomodoro,
    } = useAppStore();
    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isNavModalOpen, setIsNavModalOpen] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    const isSurahPage = /^\/surah\/\d+/.test(location.pathname);
    const isMemorizePage = /^\/memorize\/\d+/.test(location.pathname);
    const isPagePage = /^\/page\/\d+/.test(location.pathname);
    const isPlannerReader = /^\/planner\/read\/\d+/.test(location.pathname);
    const isImmersivePage = isSurahPage || isMemorizePage || isPagePage || isPlannerReader;
    const hasAudio = audioPlaylist.length > 0 || !!currentAudioUrl;
    const shouldReturnToPlanner = Boolean(location.state?.backToPlanner) || isPlannerReader;
    const shouldReturnToSauka = Boolean(location.state?.backToSauka);
    const shouldForceHomeBack = (isSurahPage || isPagePage) && !shouldReturnToSauka;

    const navigateHomeAtTop = useCallback((replace = false) => {
        navigate('/', {
            replace,
            state: {
                scrollToTop: Date.now(),
            },
        });
    }, [navigate]);

    const handleImmersiveBack = () => {
        if (shouldReturnToSauka) {
            navigate(`/sauka/${location.state.backToSauka}`);
            return;
        }

        if (isMemorizePage) {
            navigate('/memorize');
            return;
        }

        if (shouldForceHomeBack) {
            navigateHomeAtTop(true);
            return;
        }

        if (shouldReturnToPlanner) {
            navigate('/planner');
            return;
        }

        navigate('/');
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        getLocalAudioDirHandle().then(handle => {
            if (handle) setLocalAudioDirHandle(handle);
        }).catch(err => console.warn('Could not load local directory handle', err));
    }, [setLocalAudioDirHandle]);

    useEffect(() => {
        if (!pomodoroIsRunning) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            tickPomodoro();
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [pomodoroIsRunning, tickPomodoro]);

    useEffect(() => {
        if (!shouldForceHomeBack && !isMemorizePage) {
            return undefined;
        }

        const state = window.history.state || {};
        if (!state.quranBackTrap || state.quranBackTrapPath !== location.pathname) {
            window.history.pushState(
                {
                    ...state,
                    quranBackTrap: true,
                    quranBackTrapPath: location.pathname,
                },
                ''
            );
        }

        const handlePopState = () => {
            if (isMemorizePage) {
                navigate('/memorize', { replace: true });
            } else {
                navigateHomeAtTop(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [location.pathname, navigateHomeAtTop, shouldForceHomeBack, isMemorizePage, navigate]);

    useEffect(() => {
        let hideTimer;

        const handleActivity = () => {
            setShowHeader(true);
            if (isMemorizePage) {
                if (hideTimer) clearTimeout(hideTimer);
                hideTimer = setTimeout(() => {
                    setShowHeader(false);
                }, 3000);
            }
        };

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (!isMemorizePage) {
                if (currentScrollY > lastScrollY && currentScrollY > 100) {
                    setShowHeader(false);
                } else {
                    setShowHeader(true);
                }
            } else {
                handleActivity();
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        if (isMemorizePage) {
            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('touchstart', handleActivity);
            window.addEventListener('click', handleActivity);
            handleActivity();
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (isMemorizePage) {
                window.removeEventListener('mousemove', handleActivity);
                window.removeEventListener('touchstart', handleActivity);
                window.removeEventListener('click', handleActivity);
                if (hideTimer) clearTimeout(hideTimer);
            }
        };
    }, [lastScrollY, isMemorizePage]);

    useEffect(() => {
        setShowHeader(true);
    }, [location.pathname]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    /* ── Icon Button ── */
    const IconBtn = ({ onClick, active, label, children }) => (
        <button
            onClick={onClick}
            aria-label={label}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                active
                    ? 'bg-[var(--h-gold-soft)] text-[var(--h-gold)]'
                    : 'text-[var(--h-ink-muted)] hover:bg-[var(--h-bone)] hover:text-[var(--h-ink)]'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="flex min-h-screen flex-col">
            <header
                className={`fixed inset-x-0 top-0 z-[1000] transition-all duration-[400ms] ${
                    showHeader
                        ? 'translate-y-0 pointer-events-auto'
                        : '-translate-y-full pointer-events-none'
                }`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
                {/* Glass bar */}
                <div className="border-b border-[var(--h-bone-dark)]/40 bg-[var(--color-paper)]/80 backdrop-blur-2xl backdrop-saturate-150">
                    <div className="container flex h-[52px] items-center justify-between">

                        {/* ── Left side ── */}
                        <div className="flex min-w-0 items-center gap-2">
                            {isImmersivePage ? (
                                <>
                                    <button
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--h-ink-muted)] transition-all duration-200 hover:bg-[var(--h-bone)] hover:text-[var(--h-ink)]"
                                        onClick={handleImmersiveBack}
                                        aria-label="Go back"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <button
                                        onClick={() => setIsNavModalOpen(true)}
                                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2 py-1 transition-all duration-200 hover:bg-[var(--h-bone)]"
                                    >
                                        <span className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-ui)] text-[1.05rem] font-semibold text-[var(--h-ink)] md:max-w-[280px]">
                                            {navHeaderTitle || 'Page'}
                                        </span>
                                        <ChevronDown size={14} className="text-[var(--h-ink-muted)]" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/" className="no-underline">
                                        <span className="font-[var(--font-ui)] text-[1.35rem] font-bold tracking-tight text-[var(--h-ink)]">
                                            Qur'an
                                        </span>
                                    </Link>
                                    {navHeaderTitle && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[0.75rem] text-[var(--h-ink-muted)]">/</span>
                                            <span className="font-[var(--font-mono)] text-[0.72rem] font-medium tracking-wide text-[var(--h-ink-mid)]">
                                                {navHeaderTitle}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── Right side ── */}
                        <div className="flex items-center gap-1">
                            {(isSurahPage || isPagePage || isPlannerReader) && (
                                <>
                                    <IconBtn onClick={() => setAutoScroll(!autoScroll)} active={autoScroll} label={autoScroll ? 'Stop Auto-scroll' : 'Auto-scroll'}>
                                        <ChevronsDown size={18} />
                                    </IconBtn>
                                    <IconBtn onClick={() => setReadingMode(!readingMode)} active={readingMode} label={readingMode ? 'Translation Mode' : 'Reading Mode'}>
                                        <BookOpen size={18} />
                                    </IconBtn>
                                </>
                            )}

                            {!location.pathname.startsWith('/memorize') &&
                                !['/', '/progress', '/profile'].includes(location.pathname) && (
                                <IconBtn
                                    onClick={() => {
                                        if (isSurahPage || isPagePage || isPlannerReader) { incrementPlayTrigger(); }
                                        else { setIsPlayerVisible(!isPlayerVisible); }
                                    }}
                                    active={isPlayerVisible || isPlaying}
                                    label={(isSurahPage || isPagePage || isPlannerReader) ? 'Play / Pause' : isPlayerVisible ? 'Hide Player' : 'Show Player'}
                                >
                                    <Volume2 size={18} />
                                    {isPlaying && (
                                        <span className="absolute right-0.5 top-0.5 h-[5px] w-[5px] animate-[pulse_2s_infinite] rounded-full bg-[var(--h-gold)]" />
                                    )}
                                </IconBtn>
                            )}

                            <IconBtn onClick={toggleTheme} label="Toggle Theme">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={theme}
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                                    </motion.div>
                                </AnimatePresence>
                            </IconBtn>

                            <IconBtn onClick={() => setIsSettingsOpen(true)} label="Settings">
                                <Settings size={18} />
                            </IconBtn>
                        </div>

                    </div>
                </div>
            </header>

            <main className={`flex-1 pb-[90px] ${isPlannerReader ? 'pt-[52px]' : 'pt-[calc(52px+2.5rem)]'}`}>
                <Outlet />
            </main>

            <GlobalAudioPlayer />
            <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <NavigationModal isOpen={isNavModalOpen} onClose={() => setIsNavModalOpen(false)} />
            <WordTranslationTooltip />
        </div>
    );
}
