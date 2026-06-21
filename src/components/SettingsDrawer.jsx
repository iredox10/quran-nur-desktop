import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import {
    ArrowLeft, Check, CheckCircle, ChevronDown, ChevronRight,
    FolderOpen, HardDrive, Moon, Sun, Type, WifiOff,
    Cloud, UploadCloud, DownloadCloud, LogOut, Play, Pause, Loader2
} from 'lucide-react';
import * as quranApi from '../services/api/quranApi';
import { getMushafById, getMushafFontOptions, isTajweedEnabledForMushaf, MUSHAFS } from '../config/mushaf';
import { saveLocalAudioDirHandle } from '../utils/localAudio';
import { getOfflinePackStats } from '../utils/offlineLibrary';
import { authService, syncService } from '../services/appwrite';
import { getSyncableState } from '../store/useAppStore';

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

const TAFSIRS = [
    { id: 169, name: 'Ibn Kathir (Abridged)', lang: 'English' },
    { id: 168, name: "Ma'arif al-Qur'an", lang: 'English' },
    { id: 817, name: 'Tazkirul Quran', lang: 'English' },
    { id: 16, name: 'Tafsir al-Muyassar', lang: 'Arabic' },
    { id: 14, name: 'Tafsir Ibn Kathir', lang: 'Arabic' },
    { id: 15, name: 'Tafsir al-Tabari', lang: 'Arabic' },
    { id: 93, name: 'Al-Tafsir al-Wasit', lang: 'Arabic' }
];

const VIEWS = { root: 'root', mushaf: 'mushaf', translation: 'translation', reciter: 'reciter', arabicFont: 'arabicFont', tafsir: 'tafsir', sync: 'sync' };

/* ── Reusable Primitives ── */

function SelectionRow({ label, value, hint, onClick }) {
    return (
        <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3 text-left text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--bg-primary)]">
            <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">{label}</div>
                {value && <div className="mt-px text-[0.75rem] text-[var(--text-secondary)]">{value}</div>}
                {!value && hint && <div className="mt-px text-[0.75rem] text-[var(--text-secondary)]">{hint}</div>}
            </div>
            <ChevronRight size={16} className="shrink-0 text-[var(--text-secondary)]" />
        </button>
    );
}

function SegmentedOption({ active, icon, label, onClick }) {
    return (
        <button type="button" onClick={onClick} className={`flex flex-1 cursor-pointer items-center justify-center gap-[6px] border-none px-4 py-[10px] text-[0.82rem] font-semibold transition-all duration-200 first:rounded-l-[12px] last:rounded-r-[12px] ${
            active ? 'bg-accent text-white shadow-[0_4px_8px_rgba(198,168,124,0.25)]' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}>
            {icon}<span>{label}</span>
        </button>
    );
}

function ToggleRow({ label, hint, checked, onToggle, disabled = false }) {
    return (
        <button type="button" disabled={disabled} onClick={() => !disabled && onToggle()} className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3 text-left transition-colors duration-200 hover:bg-[var(--bg-primary)] disabled:opacity-50">
            <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">{label}</div>
                <div className="mt-px text-[0.75rem] text-[var(--text-secondary)]">{hint}</div>
            </div>
            <div className={`flex h-6 w-10 shrink-0 items-center rounded-[999px] px-[3px] transition-all duration-200 ${
                checked ? 'bg-accent' : 'bg-[var(--border-color)]'
            }`}>
                <div className={`h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                }`} />
            </div>
        </button>
    );
}

function PickerOption({ title, subtitle, active, onClick, sampleStyle }) {
    return (
        <button type="button" onClick={onClick} className={`flex w-full cursor-pointer items-center gap-3 border-none px-4 py-3 text-left transition-all duration-200 ${
            active ? 'rounded-[10px] bg-[var(--accent-light)]' : 'rounded-[10px] bg-transparent hover:bg-[var(--bg-primary)]'
        }`}>
            <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-medium text-[var(--text-primary)]" style={sampleStyle || {}}>{title}</div>
                {subtitle && <div className="mt-px text-[0.75rem] text-[var(--text-secondary)]">{subtitle}</div>}
            </div>
            {active && <Check size={16} className="shrink-0 text-accent" />}
        </button>
    );
}

function ReciterPickerOption({ reciter, active, onClick }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef(null);

    const togglePlay = async (e) => {
        e.stopPropagation();
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
        }

        if (!audioRef.current) {
            setIsLoading(true);
            try {
                const res = await quranApi.getVerses(1, 85, reciter.id);
                if (res?.verses?.[0]?.audio?.url) {
                    let audioUrl = res.verses[0].audio.url;
                    if (!audioUrl.startsWith('http')) {
                        audioUrl = `https://verses.quran.com/${audioUrl}`;
                    }
                    const audio = new Audio(audioUrl);
                    audio.onended = () => setIsPlaying(false);
                    audioRef.current = audio;
                } else {
                    console.error("Audio URL not found for reciter", reciter.id);
                    setIsLoading(false);
                    return;
                }
            } catch (err) {
                console.error("Failed to fetch audio preview", err);
                setIsLoading(false);
                return;
            }
            setIsLoading(false);
        }

        audioRef.current.play();
        setIsPlaying(true);
    };

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <button type="button" onClick={onClick} className={`flex w-full cursor-pointer items-center gap-3 border-none px-4 py-3 text-left transition-all duration-200 ${
            active ? 'rounded-[10px] bg-[var(--accent-light)]' : 'rounded-[10px] bg-transparent hover:bg-[var(--bg-primary)]'
        }`}>
            <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">{reciter.name}</div>
            </div>
            <button 
                type="button" 
                onClick={togglePlay} 
                disabled={isLoading}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:bg-accent hover:text-white"
                title="Play sample"
            >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-[2px]" />}
            </button>
            {active && <Check size={16} className="shrink-0 text-accent" />}
        </button>
    );
}

/* ── Cloud Sync View ── */

function CloudSyncView({ currentUser, setCurrentUser }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [syncStatus, setSyncStatus] = useState('');
    const [syncLoading, setSyncLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isLoginMode) {
                await authService.login(email, password);
            } else {
                await authService.register(email, password, name);
                await authService.login(email, password);
            }
            const user = await authService.getCurrentUser();
            setCurrentUser(user);
            setEmail(''); setPassword('');
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally { setLoading(false); }
    };

    const handleLogout = async () => {
        setLoading(true);
        try { await authService.logout(); } catch (err) { console.error('Logout error:', err); }
        finally { setCurrentUser(null); setLoading(false); }
    };

    const handlePush = async () => {
        if (!currentUser) return;
        setSyncLoading(true); setSyncStatus('Pushing to cloud...');
        try {
            const state = getSyncableState(useAppStore.getState());
            const result = await syncService.pushState(currentUser.$id, state);
            useAppStore.setState({ lastSyncAt: result.updatedAt });
            setSyncStatus('Successfully backed up to cloud! ✅');
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) { console.error(err); setSyncStatus('Failed to push data ❌'); }
        finally { setSyncLoading(false); }
    };

    const handlePull = async () => {
        if (!currentUser) return;
        if (!window.confirm("Warning: This will overwrite your local data with the cloud data. Proceed?")) return;
        setSyncLoading(true); setSyncStatus('Pulling from cloud...');
        try {
            const remoteData = await syncService.pullState(currentUser.$id);
            if (remoteData?.state) {
                useAppStore.setState({ ...remoteData.state, lastSyncAt: remoteData.updatedAt });
                setSyncStatus('Successfully restored from cloud! ✅');
            } else { setSyncStatus('No cloud backup found.'); }
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err) { console.error(err); setSyncStatus('Failed to pull data ❌'); }
        finally { setSyncLoading(false); }
    };

    if (currentUser) {
        return (
            <div className="flex flex-col gap-3 px-4 py-4">
                <div className="rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
                        <div className="flex-1">
                            <div className="text-[0.9rem] font-semibold text-[var(--text-primary)]">{currentUser.name || 'User'}</div>
                            <div className="text-[0.75rem] text-[var(--text-secondary)]">{currentUser.email}</div>
                        </div>
                        <button type="button" onClick={handleLogout} disabled={loading} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--text-secondary)] transition-colors duration-200 hover:bg-red-50 hover:text-red-500" aria-label="Logout"><LogOut size={18} /></button>
                    </div>
                </div>

                <div className="rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-4">
                    <div className="mb-1 text-[0.9rem] font-medium text-[var(--text-primary)]">Cloud Backup</div>
                    <div className="mb-3 text-[0.75rem] text-[var(--text-secondary)]">Securely back up your bookmarks, memorization progress, planners, and reading history.</div>

                    <div className="flex flex-col gap-2">
                        <button type="button" onClick={handlePush} disabled={syncLoading} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-none bg-accent px-4 py-[10px] text-[0.85rem] font-bold text-white transition-all duration-200 hover:bg-[var(--accent-hover)] disabled:opacity-60">
                            <UploadCloud size={16} /> {syncLoading ? 'Syncing...' : 'Backup to Cloud'}
                        </button>
                        <button type="button" onClick={handlePull} disabled={syncLoading} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-2 border-accent bg-transparent px-4 py-[10px] text-[0.85rem] font-bold text-accent transition-all duration-200 hover:bg-[var(--accent-light)] disabled:opacity-60">
                            <DownloadCloud size={16} /> Restore from Cloud
                        </button>
                    </div>

                    {syncStatus && <div className={`mt-2 text-[0.78rem] font-semibold ${syncStatus.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{syncStatus}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-4 mb-4 mt-4 rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)] text-accent"><Cloud size={22} /></div>
            <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">Cloud Sync</h3>
            <p className="mb-5 text-[0.78rem] leading-[1.4] text-[var(--text-secondary)]">
                Create an account to securely back up and sync your reading progress across devices.
            </p>

            <form onSubmit={handleAuth} className="flex flex-col gap-2 text-left">
                {!isLoginMode && <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[0.85rem] text-[var(--text-primary)] outline-none" />}
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[0.85rem] text-[var(--text-primary)] outline-none" />
                <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[0.85rem] text-[var(--text-primary)] outline-none" />

                {error && <div className="rounded-[8px] bg-red-500/10 px-3 py-2 text-[0.78rem] font-semibold text-red-500">{error}</div>}

                <button type="submit" disabled={loading} className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-none bg-accent px-4 py-3 text-[0.85rem] font-bold text-white transition-all duration-200 hover:bg-[var(--accent-hover)] disabled:opacity-60">
                    {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Create Account')}
                </button>

                <div className="mt-1 text-center">
                    <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }} className="cursor-pointer border-none bg-transparent text-[0.78rem] font-semibold text-[var(--text-secondary)] transition-colors duration-200 hover:text-accent">
                        {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                    </button>
                </div>
            </form>
        </div>
    );
}

/* ── Main Component ── */

export default function SettingsDrawer({ isOpen, onClose }) {
    const navigate = useNavigate();
    const {
        theme, toggleTheme, fontSize, setFontSize,
        translationFontSize, setTranslationFontSize,
        reciterId, setReciter, translationId, setTranslation,
        mushafId, setSelectedMushaf, arabicFontId, setArabicFont,
        tajweedEnabled, setTajweed, tafsirId, setTafsirId,
        localAudioDirHandle, setLocalAudioDirHandle,
        currentUser, setCurrentUser
    } = useAppStore();

    const mushaf = getMushafById(mushafId);
    const mushafFonts = getMushafFontOptions(mushafId);
    const isTajweedActive = isTajweedEnabledForMushaf(mushafId, tajweedEnabled);

    const [activeView, setActiveView] = useState(VIEWS.root);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        if (isOpen) setTimeout(() => setActiveView(VIEWS.root), 0);
    }, [isOpen]);

    const selectedTranslation = useMemo(() => TRANSLATIONS.find(i => i.id === translationId), [translationId]);
    const selectedReciter = useMemo(() => RECITERS.find(i => i.id === reciterId), [reciterId]);
    const selectedTafsir = useMemo(() => TAFSIRS.find(i => i.id === tafsirId), [tafsirId]);
    const selectedFont = useMemo(() => mushafFonts.find(i => i.id === arabicFontId), [arabicFontId, mushafFonts]);

    const { data: offlineStats } = useQuery({
        queryKey: ['offline-pack-stats', translationId, reciterId, mushafId],
        queryFn: () => getOfflinePackStats({ translationId, reciterId, mushafId }),
        enabled: isOpen,
    });

    const handleSelectAudioFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) { alert('Your browser does not support local folder selection.'); return; }
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            await saveLocalAudioDirHandle(handle);
            setLocalAudioDirHandle(handle);
        } catch (error) { console.error('Failed to get directory', error); }
    };

    const renderPickerView = () => {
        const pickers = {
            [VIEWS.mushaf]: { title: 'Choose Mushaf', items: MUSHAFS, idKey: mushafId, onSelect: (id) => { setSelectedMushaf(id); setActiveView(VIEWS.root); }, getSubtitle: (i) => i.description },
            [VIEWS.translation]: { title: 'Choose Translation', items: TRANSLATIONS, idKey: translationId, onSelect: (id) => { setTranslation(id); setActiveView(VIEWS.root); } },
            [VIEWS.reciter]: { title: 'Choose Reciter', items: RECITERS, idKey: reciterId, onSelect: (id) => { setReciter(id); setActiveView(VIEWS.root); } },
            [VIEWS.arabicFont]: { title: 'Choose Arabic Font', items: mushafFonts, idKey: arabicFontId, onSelect: (id) => { setArabicFont(id); setActiveView(VIEWS.root); }, getSubtitle: () => `Compatible with ${mushaf.name}`, getSampleStyle: (i) => ({ fontFamily: i.family }) },
            [VIEWS.tafsir]: { title: 'Choose Tafsir', items: TAFSIRS, idKey: tafsirId, onSelect: (id) => { setTafsirId(id); setActiveView(VIEWS.root); }, getSubtitle: (i) => i.lang },
        };

        if (activeView === VIEWS.sync) return { title: 'Cloud Sync', content: <CloudSyncView currentUser={currentUser} setCurrentUser={setCurrentUser} /> };

        const p = pickers[activeView];
        if (!p) return null;

        if (activeView === VIEWS.reciter) {
            const groupedReciters = RECITERS.reduce((acc, reciter) => {
                const style = reciter.style || 'Other';
                if (!acc[style]) acc[style] = [];
                acc[style].push(reciter);
                return acc;
            }, {});

            return {
                title: 'Choose Reciter',
                content: (
                    <div className="flex flex-col gap-4 px-3 py-3">
                        {Object.entries(groupedReciters).map(([style, reciters]) => (
                            <div key={style} className="flex flex-col gap-1">
                                <div className="px-2 pb-1 text-[0.75rem] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    {style}
                                </div>
                                {reciters.map(reciter => (
                                    <ReciterPickerOption
                                        key={reciter.id}
                                        reciter={reciter}
                                        active={reciter.id === reciterId}
                                        onClick={() => { setReciter(reciter.id); setActiveView(VIEWS.root); }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )
            };
        }

        return {
            title: p.title,
            content: (
                <div className="flex flex-col gap-1 px-3 py-3">
                    {p.items.map(item => (
                        <PickerOption
                            key={item.id}
                            title={item.name}
                            subtitle={p.getSubtitle?.(item)}
                            active={item.id === p.idKey}
                            sampleStyle={p.getSampleStyle?.(item)}
                            onClick={() => p.onSelect(item.id)}
                        />
                    ))}
                </div>
            )
        };
    };

    if (!isOpen) return null;

    const pickerView = renderPickerView();

    return (
        <>
            <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <aside className="fixed inset-y-0 right-0 z-[3001] flex w-full max-w-[380px] flex-col bg-[var(--bg-surface)] shadow-[-8px_0_40px_rgba(0,0,0,0.1)]" aria-label="Reading settings"
                
            >
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-4">
                    <div className="flex items-center gap-3">
                        {activeView !== VIEWS.root && (
                            <button type="button" onClick={() => setActiveView(VIEWS.root)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--bg-primary)] hover:text-accent" aria-label="Back">
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{pickerView?.title || 'Settings'}</h2>
                            {activeView === VIEWS.root && <p className="m-0 text-[0.75rem] text-[var(--text-secondary)]">Customize your reading experience</p>}
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-lg text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--bg-primary)] hover:text-accent" aria-label="Close settings">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {pickerView ? pickerView.content : (
                        <div className="flex flex-col gap-4 px-4 py-4">
                            <div className="flex overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)]">
                                <SegmentedOption active={activeTab === 'general'} label="General" onClick={() => setActiveTab('general')} />
                                <SegmentedOption active={activeTab === 'reading'} label="Reading" onClick={() => setActiveTab('reading')} />
                                <SegmentedOption active={activeTab === 'data'} label="Data" onClick={() => setActiveTab('data')} />
                            </div>

                            {activeTab === 'general' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Appearance</div>
                                        <div className="flex overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)]">
                                            <SegmentedOption active={theme === 'light'} icon={<Sun size={15} />} label="Light" onClick={() => theme !== 'light' && toggleTheme()} />
                                            <SegmentedOption active={theme === 'dark'} icon={<Moon size={15} />} label="Dark" onClick={() => theme !== 'dark' && toggleTheme()} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Essentials</div>
                                        <div className="overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)]">
                                            <SelectionRow label="Mushaf" value={mushaf.name} onClick={() => setActiveView(VIEWS.mushaf)} />
                                            <SelectionRow label="Translation" value={selectedTranslation?.name} onClick={() => setActiveView(VIEWS.translation)} />
                                            <SelectionRow label="Reciter" value={selectedReciter?.name} onClick={() => setActiveView(VIEWS.reciter)} />
                                            <SelectionRow label="Cloud Sync" hint={currentUser ? `Signed in as ${currentUser.name || currentUser.email}` : 'Backup your progress'} onClick={() => setActiveView(VIEWS.sync)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'reading' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Text Preferences</div>
                                        <div className="overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)]">
                                            <SelectionRow label="Arabic Font" value={selectedFont?.name || 'Default'} onClick={() => setActiveView(VIEWS.arabicFont)} />
                                            <SelectionRow label="Tafsir" value={selectedTafsir ? `${selectedTafsir.name}` : ''} onClick={() => setActiveView(VIEWS.tafsir)} />
                                            <ToggleRow
                                                label="Tajweed"
                                                hint={mushaf.supportsTajweedToggle ? 'Color cues for pronunciation' : 'Not available for this Mushaf'}
                                                checked={isTajweedActive}
                                                disabled={!mushaf.supportsTajweedToggle}
                                                onToggle={() => setTajweed(!tajweedEnabled)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Sizes</div>
                                        <div className="overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)]">
                                            <div className="px-4 py-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">Arabic Size</div>
                                                    </div>
                                                    <span className="text-[0.85rem] font-semibold text-[var(--text-secondary)]"><Type size={13} className="mr-1 inline align-text-bottom" />{fontSize}</span>
                                                </div>
                                                <input type="range" min="1" max="8" step="1" value={fontSize}
                                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                                    className="w-full cursor-pointer outline-none"
                                                    style={{ accentColor: 'var(--accent-primary)' }} aria-label="Arabic font size" />
                                            </div>
                                            <div className="border-t border-[var(--border-color)] px-4 py-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">Translation Size</div>
                                                    </div>
                                                    <span className="text-[0.85rem] font-semibold text-[var(--text-secondary)]">{translationFontSize || 2}</span>
                                                </div>
                                                <input type="range" min="1" max="8" step="1" value={translationFontSize || 2}
                                                    onChange={(e) => setTranslationFontSize(Number(e.target.value))}
                                                    className="w-full cursor-pointer outline-none"
                                                    style={{ accentColor: 'var(--accent-primary)' }} aria-label="Translation font size" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'data' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Local Audio</div>
                                        <div className="rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-4">
                                            <div className="text-[0.9rem] font-medium text-[var(--text-primary)]">Local Offline Audio</div>
                                            <div className="mb-3 text-[0.72rem] text-[var(--text-secondary)]">Connect a folder of ayah MP3 files for native offline playback.</div>
                                            <button type="button" onClick={handleSelectAudioFolder} className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 px-4 py-[10px] text-[0.82rem] font-bold transition-all duration-200 ${
                                                localAudioDirHandle ? 'border-green-500 bg-green-50 text-green-600' : 'border-[var(--border-color)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                                            }`}>
                                                {localAudioDirHandle ? <CheckCircle size={16} /> : <FolderOpen size={16} />}
                                                {localAudioDirHandle ? 'Folder Connected' : 'Choose Audio Folder'}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Offline Downloads</div>
                                        <div className="rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-4">
                                            <div className="mb-3 flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-1 text-[0.9rem] font-medium text-[var(--text-primary)]">
                                                        <HardDrive size={14} /> Offline Library
                                                    </div>
                                                    <div className="text-[0.72rem] text-[var(--text-secondary)]">Manage downloadable Quran packs.</div>
                                                </div>
                                                <div className={`flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-1 text-[0.65rem] font-semibold ${
                                                    navigator.onLine ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                                }`}>
                                                    <WifiOff size={11} />
                                                    {navigator.onLine ? 'Online' : 'Offline'}
                                                </div>
                                            </div>

                                            <div className="mb-3 flex gap-2">
                                                <div className="flex-1 rounded-[8px] bg-[var(--bg-secondary)] px-3 py-2">
                                                    <div className="text-[0.65rem] font-medium text-[var(--text-secondary)]">Quran text</div>
                                                    <div className="text-[0.82rem] font-semibold text-[var(--text-primary)]">{offlineStats?.quranText?.downloaded ? offlineStats.quranText.sizeLabel : 'Not downloaded'}</div>
                                                </div>
                                                <div className="flex-1 rounded-[8px] bg-[var(--bg-secondary)] px-3 py-2">
                                                    <div className="text-[0.65rem] font-medium text-[var(--text-secondary)]">Tajweed</div>
                                                    <div className="text-[0.82rem] font-semibold text-[var(--text-primary)]">{offlineStats?.tajweed?.downloaded ? offlineStats.tajweed.sizeLabel : 'Not downloaded'}</div>
                                                </div>
                                            </div>

                                            <button type="button" onClick={() => { onClose(); navigate('/offline-library'); }} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-none bg-accent px-4 py-[10px] text-[0.85rem] font-bold text-white transition-all duration-200 hover:bg-[var(--accent-hover)]">
                                                <CheckCircle size={16} /> Open Offline Library
                                            </button>
                                        </div>
                                    </div>
                                    <div className="py-2 text-center">
                                        <a href="https://iredox.tech" target="_blank" rel="noopener noreferrer" className="text-[0.72rem] text-[var(--text-secondary)] no-underline transition-colors duration-200 hover:text-accent">built by iredox.tech</a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
