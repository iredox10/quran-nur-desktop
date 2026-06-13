import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { RECITERS } from '../config/reciters';

export default function AudioSetupModal({
    isOpen,
    onClose,
    pendingPlaylist,
    audioSettings,
    updateAudioSettings,
    handleStartPlaying
}) {
    const { reciterId, setReciter } = useAppStore();
    
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
                                    <select
                                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                        value={reciterId}
                                        onChange={(e) => setReciter(Number(e.target.value))}
                                    >
                                        {RECITERS.map(reciter => (
                                            <option key={reciter.id} value={reciter.id}>{reciter.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-[0.6rem] block text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                                        Ayah Range
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">From</label>
                                            <select
                                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.startRange ?? 0}
                                                onChange={(e) => updateAudioSettings({ startRange: Number(e.target.value) })}
                                            >
                                                {pendingPlaylist.map((v, i) => (
                                                    <option key={v.verseKey} value={i}>{v.verseKey}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">To</label>
                                            <select
                                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.endRange ?? pendingPlaylist.length - 1}
                                                onChange={(e) => updateAudioSettings({ endRange: Number(e.target.value) })}
                                            >
                                                {pendingPlaylist.map((v, i) => (
                                                    <option key={v.verseKey} value={i}>{v.verseKey}</option>
                                                ))}
                                            </select>
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
                                            <select className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.repeatAya}
                                                onChange={(e) => updateAudioSettings({ repeatAya: Number(e.target.value) })}
                                            >
                                                {[1, 2, 3, 5, 10, -1].map(opt => <option key={opt} value={opt}>{opt === -1 ? '∞ Infinite' : `${opt}×`}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Full Selection</label>
                                            <select className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.repeatSelection}
                                                onChange={(e) => updateAudioSettings({ repeatSelection: Number(e.target.value) })}
                                            >
                                                {[1, 2, 3, 5, 10, -1].map(opt => <option key={opt} value={opt}>{opt === -1 ? '∞ Infinite' : `${opt}×`}</option>)}
                                            </select>
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
                                            <select className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.delayBetweenAyas}
                                                onChange={(e) => updateAudioSettings({ delayBetweenAyas: Number(e.target.value) })}
                                            >
                                                {[0, 1, 2, 3, 5, 10].map(opt => <option key={opt} value={opt}>{opt === 0 ? 'None' : `${opt}s`}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[0.8rem] text-[var(--text-muted)]">Playback Speed</label>
                                            <select className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none"
                                                value={audioSettings.playbackSpeed}
                                                onChange={(e) => updateAudioSettings({ playbackSpeed: Number(e.target.value) })}
                                            >
                                                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(opt => <option key={opt} value={opt}>{opt}×</option>)}
                                            </select>
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
                                    onClick={handleStartPlaying}
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
