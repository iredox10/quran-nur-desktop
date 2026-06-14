import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getLocalAudioUrl } from '../utils/localAudio';
import { Play, Pause, X, Music, SkipBack, SkipForward, Square, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from './ui/CustomSelect';

const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10];
const REPEAT_OPTIONS = [1, 2, 3, 5, 10, -1];
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function GlobalAudioPlayer() {
    const {
        currentAudioUrl, audioPlaylist, audioTrackIndex, isPlaying, audioSettings,
        setAudioTrackIndex, updateAudioSettings, setIsPlaying, stopAudio,
        isPlayerVisible, setIsPlayerVisible,
        localAudioDirHandle
    } = useAppStore();

    const audioRef = useRef(null);
    const delayTimeoutRef = useRef(null);
    const prevIsPlayingRef = useRef(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [currentAyaLoopCount, setCurrentAyaLoopCount] = useState(0);
    const [currentSelectionLoopCount, setCurrentSelectionLoopCount] = useState(0);

    const ayahOptions = audioPlaylist.map((v, i) => ({ value: i, label: v.verseKey || String(i) }));
    const repeatOptions = REPEAT_OPTIONS.map(opt => ({ value: opt, label: opt === -1 ? '∞ Infinite' : `${opt}×` }));
    const delayOptions = DELAY_OPTIONS.map(opt => ({ value: opt, label: opt === 0 ? 'None' : `${opt}s` }));
    const speedOptions = SPEED_OPTIONS.map(opt => ({ value: opt, label: `${opt}×` }));

    const hasAudio = !!(currentAudioUrl || audioPlaylist.length > 0);
    const activeUrl = audioPlaylist.length > 0 ? audioPlaylist[audioTrackIndex]?.url : currentAudioUrl;
    const currentTitle = audioPlaylist.length > 0
        ? `Ayah ${audioPlaylist[audioTrackIndex]?.verseNumber || '...'}`
        : 'Recitation';

    // Scroll to & highlight current verse while playing
    useEffect(() => {
        if (isPlaying && audioSettings.scrollWhilePlaying && audioPlaylist.length > 0) {
            const currentVerse = audioPlaylist[audioTrackIndex];
            if (currentVerse?.verseKey) {
                const el = document.getElementById(`verse-${currentVerse.verseKey}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }, [audioTrackIndex, isPlaying, audioPlaylist, audioSettings.scrollWhilePlaying]);

    // Auto-show player only on false→true transition
    useEffect(() => {
        const wasPlaying = prevIsPlayingRef.current;
        prevIsPlayingRef.current = isPlaying;
        if (!wasPlaying && isPlaying && hasAudio) {
            setIsPlayerVisible(true);
        }
    }, [isPlaying, hasAudio, setIsPlayerVisible]);

    const [resolvedAudioUrl, setResolvedAudioUrl] = useState(null);

    // Resolve local-audio:// to object URL if needed
    useEffect(() => {
        if (!activeUrl) {
            setResolvedAudioUrl(null);
            return;
        }

        if (typeof activeUrl === 'string' && activeUrl.startsWith('local-audio://') && localAudioDirHandle) {
            const fileName = activeUrl.replace('local-audio://', '');
            getLocalAudioUrl(localAudioDirHandle, fileName).then(url => {
                setResolvedAudioUrl(url || activeUrl);
            });
        } else {
            setResolvedAudioUrl(activeUrl);
        }

        return () => {};
    }, [activeUrl, localAudioDirHandle]);

    // Sync with audio element
    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.playbackRate = audioSettings.playbackSpeed;
        if (isPlaying && resolvedAudioUrl) {
            if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
            audioRef.current.play().catch(e => { console.error('Audio failed', e); setIsPlaying(false); });
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, resolvedAudioUrl, audioSettings.playbackSpeed]);

    const handleStop = () => { stopAudio(); setIsPlayerVisible(false); setIsSettingsOpen(false); };

    const handleEnded = () => {
        if (currentAudioUrl) { setIsPlaying(false); return; }
        if (!audioPlaylist.length) return;

        const playNext = (idx) => {
            if (audioSettings.delayBetweenAyas > 0) {
                audioRef.current?.pause();
                delayTimeoutRef.current = setTimeout(() => setAudioTrackIndex(idx), audioSettings.delayBetweenAyas * 1000);
            } else { setAudioTrackIndex(idx); }
        };

        if (audioSettings.repeatAya === -1 || currentAyaLoopCount + 1 < audioSettings.repeatAya) {
            setCurrentAyaLoopCount(p => p + 1);
            if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
            return;
        }

        setCurrentAyaLoopCount(0);
        const endRange = audioSettings.endRange ?? audioPlaylist.length - 1;
        const startRange = audioSettings.startRange ?? 0;

        if (audioTrackIndex >= endRange) {
            if (audioSettings.repeatSelection === -1 || currentSelectionLoopCount + 1 < audioSettings.repeatSelection) {
                setCurrentSelectionLoopCount(p => p + 1);
                playNext(startRange);
            } else {
                setCurrentSelectionLoopCount(0);
                setIsPlaying(false);
                setAudioTrackIndex(startRange);
            }
        } else {
            playNext(audioTrackIndex + 1);
        }
    };

    const handleNext = () => {
        const end = audioSettings.endRange ?? audioPlaylist.length - 1;
        if (audioTrackIndex < end) { setAudioTrackIndex(audioTrackIndex + 1); setCurrentAyaLoopCount(0); }
    };

    const handlePrev = () => {
        const start = audioSettings.startRange ?? 0;
        if (audioTrackIndex > start) { setAudioTrackIndex(audioTrackIndex - 1); setCurrentAyaLoopCount(0); }
        else if (audioRef.current) audioRef.current.currentTime = 0;
    };

    return (
        <>
            {/* ── Floating Player Pill ── */}
            <AnimatePresence>
                {isPlayerVisible && (
                    <motion.div
                        key="player-pill"
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-8 left-0 right-0 mx-auto w-[calc(100%-1rem)] max-w-[480px] px-3 py-2 bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)] z-[900] flex items-center justify-between gap-2 rounded-full shadow-[var(--shadow-xl)]"
                    >
                        {hasAudio && (
                            <audio 
                                ref={audioRef} 
                                src={resolvedAudioUrl || activeUrl || ''} 
                                onEnded={handleEnded}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                            />
                        )}

                        {!hasAudio ? (
                            <>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] shrink-0 flex items-center justify-center text-[var(--text-muted)]">
                                        <Music size={16} />
                                    </div>
                                    <span className="text-[0.85rem] text-[var(--text-muted)] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                        Open a Surah & press Play
                                    </span>
                                </div>
                                <button className="btn-icon w-7 h-7 text-[var(--text-muted)] shrink-0" onClick={() => setIsPlayerVisible(false)}>
                                    <X size={16} />
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Track info (truncates if too long) */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] shrink-0 flex items-center justify-center text-[var(--accent-primary)]">
                                        <Music size={16} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[0.85rem] font-semibold text-[var(--text-primary)] leading-[1.2] whitespace-nowrap overflow-hidden text-ellipsis">
                                            {currentTitle}
                                        </span>
                                        <span className="text-[0.7rem] text-[var(--accent-primary)] whitespace-nowrap" style={{ opacity: isPlaying ? 1 : 0.7 }}>
                                            {isPlaying ? 'Playing' : 'Paused'}
                                        </span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-[0.15rem] shrink-0">
                                    {audioPlaylist.length > 0 && <button className="btn-icon w-7 h-7" onClick={handlePrev}><SkipBack size={16} /></button>}
                                    <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-md transition-all hover:scale-105 hover:bg-[var(--accent-hover)] mx-1" onClick={() => setIsPlaying(!isPlaying)}>
                                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-[2px]" />}
                                    </button>
                                    <button className="btn-icon w-7 h-7 text-[var(--accent-primary)]" onClick={handleStop} title="Stop"><Square size={14} fill="currentColor" /></button>
                                    {audioPlaylist.length > 0 && <button className="btn-icon w-7 h-7" onClick={handleNext}><SkipForward size={16} /></button>}
                                </div>

                                <div className="w-px h-5 bg-[var(--border-color)] mx-[0.15rem] shrink-0" />

                                {/* Settings & Close */}
                                <div className="flex items-center gap-[0.15rem] shrink-0">
                                    {audioPlaylist.length > 0 && (
                                        <button className="btn-icon w-7 h-7" onClick={() => setIsSettingsOpen(true)} style={{ color: isSettingsOpen ? 'var(--accent-primary)' : 'var(--text-muted)' }} title="Audio Settings">
                                            <Settings2 size={16} />
                                        </button>
                                    )}
                                    <button className="btn-icon w-7 h-7 text-[var(--text-muted)]" onClick={handleStop} aria-label="Close Player">
                                        <X size={16} />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Audio Settings Bottom Drawer (shown during playback) ── */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsSettingsOpen(false)}
                            className="fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm"
                        />
                        {/* Bottom Drawer — outer row handles centering via flex */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="fixed bottom-0 inset-x-0 flex justify-center z-[999]"
                        >
                            {/* Inner card */}
                            <div className="w-full max-w-[520px] max-h-[85vh] flex flex-col bg-[var(--bg-surface)] rounded-t-[24px] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] border border-[var(--border-color)] border-b-0 overflow-hidden">
                                {/* Drag handle */}
                                <div className="flex justify-center pt-3 pb-1 shrink-0">
                                    <div className="w-10 h-[5px] rounded-full bg-[var(--border-color)]" />
                                </div>

                                {/* Header */}
                                <div className="px-6 pb-4 shrink-0 flex justify-between items-center">
                                    <h3 className="m-0 text-[var(--text-primary)] text-[1.1rem] font-bold">Audio Settings</h3>
                                    <button className="btn-icon bg-[var(--bg-secondary)] w-8 h-8" onClick={() => setIsSettingsOpen(false)}>
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Scrollable body */}
                                <div className="flex-1 overflow-y-auto px-6 pb-6 grid gap-6">
                                    {/* Range */}
                                    <div>
                                        <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                            Playback Range
                                        </label>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">From Ayah</label>
                                                <CustomSelect 
                                                    value={audioSettings.startRange ?? 0} 
                                                    onChange={(val) => updateAudioSettings({ startRange: Number(val) })}
                                                    options={ayahOptions}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">To Ayah</label>
                                                <CustomSelect 
                                                    value={audioSettings.endRange ?? Math.max(0, audioPlaylist.length - 1)} 
                                                    onChange={(val) => updateAudioSettings({ endRange: Number(val) })}
                                                    options={ayahOptions}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Repeats */}
                                    <div>
                                        <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                            Repeat
                                        </label>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Each Ayah</label>
                                                <CustomSelect 
                                                    value={audioSettings.repeatAya ?? 1} 
                                                    onChange={(val) => updateAudioSettings({ repeatAya: Number(val) })}
                                                    options={repeatOptions}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Full Selection</label>
                                                <CustomSelect 
                                                    value={audioSettings.repeatSelection ?? 1} 
                                                    onChange={(val) => updateAudioSettings({ repeatSelection: Number(val) })}
                                                    options={repeatOptions}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advanced */}
                                    <div>
                                        <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                            Advanced
                                        </label>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Delay Between Ayahs</label>
                                                <CustomSelect 
                                                    value={audioSettings.delayBetweenAyas ?? 0} 
                                                    onChange={(val) => updateAudioSettings({ delayBetweenAyas: Number(val) })}
                                                    options={delayOptions}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Playback Speed</label>
                                                <CustomSelect 
                                                    value={audioSettings.playbackSpeed ?? 1.0} 
                                                    onChange={(val) => updateAudioSettings({ playbackSpeed: Number(val) })}
                                                    options={speedOptions}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Auto-scroll toggle */}
                                    <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--accent-light)] mt-2">
                                        <input 
                                            type="checkbox" 
                                            checked={audioSettings.scrollWhilePlaying ?? true} 
                                            onChange={(e) => updateAudioSettings({ scrollWhilePlaying: e.target.checked })} 
                                            className="h-5 w-5 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]" 
                                        />
                                        <div>
                                            <div className="text-[0.9rem] font-semibold text-[var(--text-primary)]">Auto-scroll while playing</div>
                                            <div className="text-[0.8rem] text-[var(--text-muted)]">Highlights and scrolls to each Ayah</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {resolvedAudioUrl && (
                <audio
                    ref={audioRef}
                    src={resolvedAudioUrl}
                    onEnded={handleEnded}
                    onError={(e) => {
                        console.error("Audio playback error", e);
                        setIsPlaying(false);
                        handleEnded();
                    }}
                />
            )}
        </>
    );
}
