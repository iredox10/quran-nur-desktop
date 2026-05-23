import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import {
    ArrowLeft, Check, CheckCircle, ChevronDown, ChevronRight,
    FolderOpen, HardDrive, Moon, Sun, Type, WifiOff,
    Cloud, UploadCloud, DownloadCloud, LogOut,
} from 'lucide-react';
import { getMushafById, getMushafFontOptions, isTajweedEnabledForMushaf, MUSHAFS } from '../config/mushaf';
import { saveLocalAudioDirHandle } from '../utils/localAudio';
import { getOfflinePackStats } from '../utils/offlineLibrary';
import { authService, syncService } from '../services/appwrite';
import { getSyncableState } from '../store/useAppStore';
import './SettingsDrawer.css';

const RECITERS = [
    { id: 7, name: 'Mishary Rashid Alafasy' },
    { id: 1, name: 'AbdulBaset AbdulSamad' },
    { id: 3, name: 'Abdur-Rahman as-Sudais' },
    { id: 4, name: 'Abu Bakr al-Shatri' }
];

const TRANSLATIONS = [
    { id: 85, name: 'English - M.A.S. Abdel Haleem' },
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
        <button type="button" className="sd-row" onClick={onClick}>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sd-row-label">{label}</div>
                {value && <div className="sd-row-value">{value}</div>}
                {!value && hint && <div className="sd-row-hint">{hint}</div>}
            </div>
            <ChevronRight size={16} className="sd-row-chevron" />
        </button>
    );
}

function SegmentedOption({ active, icon, label, onClick }) {
    return (
        <button type="button" className={`sd-segment ${active ? 'active' : ''}`} onClick={onClick}>
            {icon}<span>{label}</span>
        </button>
    );
}

function ToggleRow({ label, hint, checked, onToggle, disabled = false }) {
    return (
        <button type="button" className="sd-toggle-row" disabled={disabled} onClick={() => !disabled && onToggle()}>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sd-row-label">{label}</div>
                <div className="sd-row-hint">{hint}</div>
            </div>
            <div className={`sd-toggle-track ${checked ? 'on' : ''}`}>
                <div className="sd-toggle-knob" />
            </div>
        </button>
    );
}

function PickerOption({ title, subtitle, active, onClick, sampleStyle }) {
    return (
        <button type="button" className={`sd-picker-option ${active ? 'active' : ''}`} onClick={onClick}>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sd-picker-title" style={sampleStyle || {}}>{title}</div>
                {subtitle && <div className="sd-picker-subtitle">{subtitle}</div>}
            </div>
            {active && <Check size={16} />}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="sd-card-padded">
                    <div className="sd-user-card">
                        <div className="sd-user-avatar">{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
                        <div className="sd-user-info">
                            <div className="sd-user-name">{currentUser.name || 'User'}</div>
                            <div className="sd-user-email">{currentUser.email}</div>
                        </div>
                        <button type="button" className="sd-logout-btn" onClick={handleLogout} disabled={loading} aria-label="Logout"><LogOut size={18} /></button>
                    </div>
                </div>

                <div className="sd-card-padded">
                    <div className="sd-row-label" style={{ marginBottom: '0.2rem' }}>Cloud Backup</div>
                    <div className="sd-row-hint" style={{ marginBottom: '0.85rem' }}>Securely back up your bookmarks, memorization progress, planners, and reading history.</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <button type="button" className="sd-btn-primary" onClick={handlePush} disabled={syncLoading}>
                            <UploadCloud size={16} /> {syncLoading ? 'Syncing...' : 'Backup to Cloud'}
                        </button>
                        <button type="button" className="sd-btn-outline" onClick={handlePull} disabled={syncLoading}>
                            <DownloadCloud size={16} /> Restore from Cloud
                        </button>
                    </div>

                    {syncStatus && <div className={`sd-sync-status ${syncStatus.includes('Failed') ? 'error' : ''}`}>{syncStatus}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="sd-card-padded" style={{ textAlign: 'center' }}>
            <div className="sd-auth-icon-wrap"><Cloud size={22} /></div>
            <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.2rem', color: 'var(--sd-ink)' }}>Cloud Sync</h3>
            <p style={{ color: 'var(--sd-ink-muted)', fontSize: '0.78rem', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                Create an account to securely back up and sync your reading progress across devices.
            </p>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: 'left' }}>
                {!isLoginMode && <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required className="sd-auth-input" />}
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="sd-auth-input" />
                <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="sd-auth-input" />

                {error && <div className="sd-auth-error">{error}</div>}

                <button type="submit" disabled={loading} className="sd-btn-primary" style={{ marginTop: '0.35rem' }}>
                    {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Create Account')}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.3rem' }}>
                    <button type="button" className="sd-auth-toggle" onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}>
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
    const [showAdvanced, setShowAdvanced] = useState(false);

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

    /* ── Picker Views ── */
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

        return {
            title: p.title,
            content: (
                <div className="sd-picker-list">
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
            <div className="sd-overlay" onClick={onClose} />

            <aside className="sd-drawer" aria-label="Reading settings">
                {/* Header */}
                <div className="sd-header">
                    <div className="sd-header-left">
                        {activeView !== VIEWS.root && (
                            <button type="button" className="sd-back-btn" onClick={() => setActiveView(VIEWS.root)} aria-label="Back">
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <div>
                            <h2 className="sd-title">{pickerView?.title || 'Settings'}</h2>
                            {activeView === VIEWS.root && <p className="sd-subtitle">Customize your reading experience</p>}
                        </div>
                    </div>
                    <button type="button" className="sd-close-btn" onClick={onClose} aria-label="Close settings">✕</button>
                </div>

                {/* Body */}
                <div className="sd-body">
                    {pickerView ? pickerView.content : (
                        <div>
                            {/* Theme */}
                            <div className="sd-section">
                                <div className="sd-section-title">Appearance</div>
                                <div className="sd-card sd-segment-wrap">
                                    <SegmentedOption active={theme === 'light'} icon={<Sun size={15} />} label="Light" onClick={() => theme !== 'light' && toggleTheme()} />
                                    <SegmentedOption active={theme === 'dark'} icon={<Moon size={15} />} label="Dark" onClick={() => theme !== 'dark' && toggleTheme()} />
                                </div>
                            </div>

                            {/* Quick Settings */}
                            <div className="sd-section">
                                <div className="sd-section-title">Essentials</div>
                                <div className="sd-card">
                                    <SelectionRow label="Mushaf" value={mushaf.name} onClick={() => setActiveView(VIEWS.mushaf)} />
                                    <SelectionRow label="Translation" value={selectedTranslation?.name} onClick={() => setActiveView(VIEWS.translation)} />
                                    <SelectionRow label="Reciter" value={selectedReciter?.name} onClick={() => setActiveView(VIEWS.reciter)} />
                                    <SelectionRow label="Cloud Sync" hint={currentUser ? `Signed in as ${currentUser.name || currentUser.email}` : 'Backup your progress'} onClick={() => setActiveView(VIEWS.sync)} />

                                    {/* Arabic Size Slider */}
                                    <div className="sd-slider-row">
                                        <div className="sd-slider-header">
                                            <div>
                                                <div className="sd-slider-label">Arabic Size</div>
                                                <div className="sd-slider-hint">Adjust Quran text size</div>
                                            </div>
                                            <span className="sd-slider-value"><Type size={13} style={{ marginRight: '0.2rem', verticalAlign: '-2px' }} />{fontSize}</span>
                                        </div>
                                        <input type="range" min="1" max="8" step="1" value={fontSize}
                                            onChange={(e) => setFontSize(Number(e.target.value))}
                                            className="settings-slider" aria-label="Arabic font size" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Reading */}
                            <div className="sd-section">
                                <div className="sd-section-title">Reading</div>
                                <div className="sd-card">
                                    <ToggleRow
                                        label="Tajweed"
                                        hint={mushaf.supportsTajweedToggle ? 'Color cues for pronunciation' : 'Not available for this Mushaf'}
                                        checked={isTajweedActive}
                                        disabled={!mushaf.supportsTajweedToggle}
                                        onToggle={() => setTajweed(!tajweedEnabled)}
                                    />
                                    <button type="button" className="sd-row" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div className="sd-row-label">Advanced</div>
                                            <div className="sd-row-hint">Arabic font, tafsir, offline & audio</div>
                                        </div>
                                        <ChevronDown size={16} className={`sd-expand-icon ${showAdvanced ? 'open' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Advanced (collapsible) */}
                            {showAdvanced && (
                                <>
                                    <div className="sd-section">
                                        <div className="sd-section-title">Advanced Reading</div>
                                        <div className="sd-card">
                                            <SelectionRow label="Arabic Font" value={selectedFont?.name || 'Default'} onClick={() => setActiveView(VIEWS.arabicFont)} />
                                            <SelectionRow label="Tafsir" value={selectedTafsir ? `${selectedTafsir.name}` : ''} onClick={() => setActiveView(VIEWS.tafsir)} />
                                            <div className="sd-slider-row">
                                                <div className="sd-slider-header">
                                                    <div>
                                                        <div className="sd-slider-label">Translation Size</div>
                                                        <div className="sd-slider-hint">Subtle or more readable</div>
                                                    </div>
                                                    <span className="sd-slider-value">{translationFontSize || 2}</span>
                                                </div>
                                                <input type="range" min="1" max="8" step="1" value={translationFontSize || 2}
                                                    onChange={(e) => setTranslationFontSize(Number(e.target.value))}
                                                    className="settings-slider" aria-label="Translation font size" style={{ width: '100%' }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sd-section">
                                        <div className="sd-section-title">Audio</div>
                                        <div className="sd-card-padded">
                                            <div className="sd-row-label">Local Offline Audio</div>
                                            <div className="sd-row-hint" style={{ marginBottom: '0.75rem' }}>Connect a folder of ayah MP3 files for native offline playback.</div>
                                            <button type="button" className={`sd-btn-folder ${localAudioDirHandle ? 'connected' : ''}`} onClick={handleSelectAudioFolder}>
                                                {localAudioDirHandle ? <CheckCircle size={16} /> : <FolderOpen size={16} />}
                                                {localAudioDirHandle ? 'Folder Connected' : 'Choose Audio Folder'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="sd-section">
                                        <div className="sd-section-title">Offline</div>
                                        <div className="sd-card-padded">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <div className="sd-row-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <HardDrive size={14} /> Offline Library
                                                    </div>
                                                    <div className="sd-row-hint">Manage downloadable Quran packs.</div>
                                                </div>
                                                <div className={`sd-online-badge ${navigator.onLine ? 'online' : 'offline'}`}>
                                                    <WifiOff size={11} />
                                                    {navigator.onLine ? 'Online' : 'Offline'}
                                                </div>
                                            </div>

                                            <div className="sd-stats-grid">
                                                <div className="sd-stat-card">
                                                    <div className="sd-stat-label">Quran text</div>
                                                    <div className="sd-stat-value">{offlineStats?.quranText?.downloaded ? offlineStats.quranText.sizeLabel : 'Not downloaded'}</div>
                                                </div>
                                                <div className="sd-stat-card">
                                                    <div className="sd-stat-label">Tajweed</div>
                                                    <div className="sd-stat-value">{offlineStats?.tajweed?.downloaded ? offlineStats.tajweed.sizeLabel : 'Not downloaded'}</div>
                                                </div>
                                            </div>

                                            <button type="button" className="sd-btn-primary" onClick={() => { onClose(); navigate('/offline-library'); }}>
                                                <CheckCircle size={16} /> Open Offline Library
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Footer */}
                            <div className="sd-footer">
                                <a href="https://iredox.tech" target="_blank" rel="noopener noreferrer">built by iredox.tech</a>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
