import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { saukaService, JUZ_MAP } from '../services/saukaService';
import { useAppStore } from '../store/useAppStore';
import { Loader2, ArrowLeft, CheckCircle2, Clock, Share2, Copy, BookOpen, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SaukaGroup() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { setNavHeaderTitle } = useAppStore();

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Modal
    const [selectedJuz, setSelectedJuz] = useState(null);

    useEffect(() => {
        loadData();
    }, [groupId]);

    const loadData = async () => {
        try {
            if (!data) setIsLoading(true);
            const result = await saukaService.getGroup(groupId);
            setData(result);
            setNavHeaderTitle(result.group.title);
        } catch (e) {
            console.error(e);
            setError('Group not found or you are offline.');
            setNavHeaderTitle('Error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const handleClaim = async (assignmentId) => {
        setIsActionLoading(true);
        try {
            await saukaService.claimJuz(assignmentId);
            await loadData();
            setSelectedJuz(null);
        } catch (e) {
            alert('Failed to claim. It may have been claimed by someone else.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleComplete = async (assignmentId) => {
        setIsActionLoading(true);
        try {
            await saukaService.completeJuz(assignmentId, groupId);
            const newData = await saukaService.getGroup(groupId);
            setData(newData);
            if (newData.group.status === 'completed' && data.group.status !== 'completed') {
                confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
            }
            setSelectedJuz(null);
        } catch (e) {
            alert('Failed to mark complete.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUnclaim = async (assignmentId) => {
        setIsActionLoading(true);
        try {
            await saukaService.unclaimJuz(assignmentId);
            await loadData();
            setSelectedJuz(null);
        } catch (e) {
            alert('Failed to unclaim.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(data.group.joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--h-gold)]" size={32} /></div>;
    if (error || !data) return <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center"><p className="text-[var(--h-ink-muted)]">{error}</p><button onClick={() => navigate('/sauka')} className="mt-4 rounded-xl bg-[var(--h-bone)] px-4 py-2 text-sm font-semibold text-[var(--h-ink)]">Go Back</button></div>;

    const { group, assignments, userId } = data;
    const completedCount = assignments.filter(a => a.status === 'completed').length;
    const isAdmin = group.createdBy === userId;

    const isSurah = group.divisionType === 'surah';
    const unitName = isSurah ? 'Surah' : 'Juz';
    const totalParts = isSurah ? 114 : 30;

    return (
        <div className="mx-auto max-w-[900px] pb-24 pt-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* ── Top Info Card ── */}
                <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)]">
                    <div className="p-6">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h1 className="font-[var(--font-ui)] text-2xl font-bold text-[var(--h-ink)]">{group.title}</h1>
                                <p className="mt-1 text-sm text-[var(--h-ink-muted)]">Organized by {group.createdByName}</p>
                            </div>
                            <button onClick={copyCode} className="flex items-center gap-2 rounded-xl border border-[var(--h-bone-dark)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--h-ink-mid)] transition-colors hover:bg-[var(--h-bone)]">
                                {copied ? <CheckCircle2 size={16} className="text-[var(--h-green)]" /> : <Copy size={16} />}
                                <span className="font-[var(--font-mono)] tracking-wider">Code: {group.joinCode}</span>
                            </button>
                        </div>
                        
                        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                            <span className="text-[var(--h-ink-mid)]">Progress</span>
                            <span className="text-[var(--h-teal)]">{completedCount} / {totalParts} {unitName}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--h-bone-dark)]">
                            <div className="h-full rounded-full bg-[var(--h-teal)] transition-all duration-500" style={{ width: `${(completedCount / totalParts) * 100}%` }} />
                        </div>
                    </div>
                    {group.status === 'completed' && (
                        <div className="bg-[var(--h-green)]/10 px-6 py-3 text-center text-sm font-bold text-[var(--h-green)]">
                            Alhamdulillah! This Khatmah is complete.
                        </div>
                    )}
                </div>

                {/* ── Grid ── */}
                <h2 className="mb-4 px-2 font-[var(--font-mono)] text-xs uppercase tracking-widest text-[var(--h-ink-muted)]">The {totalParts} {isSurah ? 'Surahs' : 'Juz'}</h2>
                <div className={`grid gap-2 ${isSurah ? 'grid-cols-6 sm:grid-cols-8 md:grid-cols-12' : 'grid-cols-5 sm:grid-cols-6 md:grid-cols-10'}`}>
                    {assignments.map(a => {
                        const isMine = a.claimedBy === userId;
                        let bg = 'bg-[var(--h-cream)] hover:bg-white';
                        let border = 'border-[var(--h-bone-dark)]';
                        let text = 'text-[var(--h-ink-mid)]';
                        let icon = null;

                        if (a.status === 'completed') {
                            bg = 'bg-[var(--h-green)]/10';
                            border = 'border-[var(--h-green)]/30';
                            text = 'text-[var(--h-green)]';
                            icon = <CheckCircle2 size={12} />;
                        } else if (a.status === 'in_progress') {
                            if (isMine) {
                                bg = 'bg-[var(--h-gold)] text-white';
                                border = 'border-[var(--h-gold)]';
                                text = 'text-white';
                            } else {
                                bg = 'bg-[var(--h-teal-soft)]';
                                border = 'border-[var(--h-teal)]/30';
                                text = 'text-[var(--h-teal)]';
                                icon = <Clock size={12} />;
                            }
                        }

                        return (
                            <button key={a.$id} onClick={() => setSelectedJuz(a)} className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border ${bg} ${border} ${text} transition-all active:scale-95`}>
                                <span className="font-[var(--font-ui)] text-xl font-bold">{a.partNumber}</span>
                                {icon && <div className="absolute right-1.5 top-1.5">{icon}</div>}
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* ── Action Modal ── */}
            <AnimatePresence>
                {selectedJuz && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isActionLoading && setSelectedJuz(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--color-paper)] shadow-xl">
                            
                            <div className="bg-[var(--h-cream)] p-6 text-center border-b border-[var(--h-bone-dark)]">
                                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-[var(--h-bone-dark)]">
                                    <span className="font-[var(--font-ui)] text-3xl font-bold text-[var(--h-ink)]">{selectedJuz.partNumber}</span>
                                </div>
                                <h3 className="font-[var(--font-ui)] text-xl font-bold text-[var(--h-ink)]">{unitName} {selectedJuz.partNumber}</h3>
                                {!isSurah && JUZ_MAP[selectedJuz.partNumber - 1] && (
                                    <p className="mt-1 text-xs text-[var(--h-ink-muted)]">{JUZ_MAP[selectedJuz.partNumber - 1].label}</p>
                                )}
                            </div>

                            <div className="p-6">
                                {selectedJuz.status === 'unclaimed' ? (
                                    <div className="text-center">
                                        <p className="mb-6 text-sm text-[var(--h-ink-mid)]">This {unitName} is currently available.</p>
                                        <button onClick={() => handleClaim(selectedJuz.$id)} disabled={isActionLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-3.5 text-sm font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                                            {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : `Claim This ${unitName}`}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="mb-6">
                                            <p className="text-xs text-[var(--h-ink-muted)] uppercase tracking-wider mb-1 font-[var(--font-mono)]">Status</p>
                                            <p className="text-[var(--h-ink)] font-bold mb-1">{selectedJuz.status === 'completed' ? 'Completed' : 'In Progress'}</p>
                                            <p className="text-sm text-[var(--h-ink-mid)]">by {selectedJuz.claimedByName || 'Someone'}</p>
                                        </div>

                                        {selectedJuz.claimedBy === userId && selectedJuz.status === 'in_progress' && (
                                            <div className="space-y-3">
                                                <button onClick={() => navigate(isSurah ? `/surah/${selectedJuz.partNumber}` : `/page/${JUZ_MAP[selectedJuz.partNumber - 1].startPage}`)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--h-gold)] py-3.5 text-sm font-bold text-white hover:bg-[var(--h-gold)]/90">
                                                    <BookOpen size={16} /> Start Reading
                                                </button>
                                                <button onClick={() => handleComplete(selectedJuz.$id)} disabled={isActionLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-3.5 text-sm font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                                                    {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Mark as Complete</>}
                                                </button>
                                                <button onClick={() => handleUnclaim(selectedJuz.$id)} disabled={isActionLoading} className="w-full py-2 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50">
                                                    Unclaim (Drop)
                                                </button>
                                            </div>
                                        )}

                                        {/* Admin can unclaim anyone's part if not completed */}
                                        {isAdmin && selectedJuz.claimedBy !== userId && selectedJuz.status === 'in_progress' && (
                                            <button onClick={() => handleUnclaim(selectedJuz.$id)} disabled={isActionLoading} className="w-full py-3 mt-2 rounded-xl border border-red-500/20 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50">
                                                {isActionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Admin: Unclaim this ${unitName}`}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
