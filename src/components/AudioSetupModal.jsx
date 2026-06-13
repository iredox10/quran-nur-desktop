import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { RECITERS } from '../config/reciters';
import CustomSelect from './ui/CustomSelect';
import * as quranApi from '../services/api/quranApi';

function ReciterPlayButton({ reciterId }) {
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
                const res = await quranApi.getVerses(1, 85, reciterId);
                if (res?.verses?.[0]?.audio?.url) {
                    let audioUrl = res.verses[0].audio.url;
                    if (!audioUrl.startsWith('http')) audioUrl = `https://verses.quran.com/${audioUrl}`;
                    const audio = new Audio(audioUrl);
                    audio.onended = () => setIsPlaying(false);
                    audioRef.current = audio;
                }
            } catch (err) { console.error(err); }
            setIsLoading(false);
        }

        if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <button type="button" onClick={togglePlay} disabled={isLoading} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--bg-primary)] text-[var(--text-muted)] transition-colors hover:bg-accent hover:text-white" title="Play preview">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-[2px]" />}
        </button>
    );
}

export default function AudioSetupModal({
    isOpen,
    onClose,
    pendingPlaylist = [],
    handleStartPlaying
}) {
    const { reciterId, setReciter, audioSettings, updateAudioSettings } = useAppStore();

    const reciterGroups = useMemo(() => {
        const grouped = RECITERS.reduce((acc, r) => {
            const style = r.style || 'Other';
            if (!acc[style]) acc[style] = { label: style, items: [] };
            acc[style].items.push({
                value: r.id,
                label: r.name,
                renderRight: () => <ReciterPlayButton reciterId={r.id} />
            });
            return acc;
        }, {});
        return Object.values(grouped);
    }, []);

    // Other options
    const ayahOptions = pendingPlaylist.map((v, i) => ({ value: i, label: v.verseKey }));
    const repeatOptions = [1, 2, 3, 5, 10, -1].map(opt => ({ value: opt, label: opt === -1 ? '∞ Infinite' : `${opt}×` }));
    const delayOptions = [0, 1, 2, 3, 5, 10].map(opt => ({ value: opt, label: opt === 0 ? 'None' : `${opt}s` }));
    const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(opt => ({ value: opt, label: `${opt}×` }));

    const onStartPlay = () => {
        if (handleStartPlaying) handleStartPlaying();
        onClose();
    };
    
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="fixed inset-x-0 bottom-0 z-[1101] flex justify-center"
                    >
                        <div className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-color)] border-b-0 bg-[var(--bg-surface)] shadow-[0_-8px_40px_rgba(0,0,0,0.25)]"
                            style={{ maxHeight: '85vh' }}
                        >
                            <div className="flex shrink-0 justify-center pb-1 pt-3">
                                <div className="h-[5px] w-10 rounded-[9999px] bg-[var(--border-color)]" />
                            </div>

                            <div className="shrink-0 px-6 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="m-0 text-[1.2rem] font-bold text-[var(--text-primary)]">Audio Setup</h3>
                                        <p className="m-0 mt-1 text-[0.82rem] text-[var(--text-muted)]">
                                            Configure before playing · {pendingPlaylist.length} Ayahs
                                        </p>
                                    </div>
                                    <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all duration-200 hover:text-accent">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6">

                                <div>
                                    <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                        Reciter
                                    </label>
                                    <CustomSelect
                                        value={reciterId}
                                        onChange={setReciter}
                                        groups={reciterGroups}
                                    />
                                </div>

                                <div>
                                    <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                        Ayah Range
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">From</label>
                                            <CustomSelect
                                                value={audioSettings.startRange ?? 0}
                                                onChange={(val) => updateAudioSettings({ startRange: Number(val) })}
                                                options={ayahOptions}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">To</label>
                                            <CustomSelect
                                                value={audioSettings.endRange ?? Math.max(0, pendingPlaylist.length - 1)}
                                                onChange={(val) => updateAudioSettings({ endRange: Number(val) })}
                                                options={ayahOptions}
                                            />
                                        </div>
                                    </div>
                                </div>

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

                                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--bg-secondary)] px-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={audioSettings.scrollWhilePlaying ?? true}
                                        onChange={(e) => updateAudioSettings({ scrollWhilePlaying: e.target.checked })}
                                        className="h-[18px] w-[18px] shrink-0 cursor-pointer"
                                        style={{ accentColor: 'var(--accent-primary)' }}
                                    />
                                    <div>
                                        <div className="text-[0.9rem] font-semibold text-[var(--text-primary)]">Auto-scroll while playing</div>
                                        <div className="text-[0.75rem] text-[var(--text-muted)]">Highlights and scrolls to each Ayah</div>
                                    </div>
                                </label>

                            </div>

                            <div className="shrink-0 px-6 pb-6 pt-4">
                                <button
                                    onClick={onStartPlay}
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-accent px-4 py-[0.9rem] text-base font-bold text-white transition-all duration-200 hover:bg-[var(--accent-hover)]"
                                >
                                    <Play size={20} fill="currentColor" />
                                    Start Playing
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
