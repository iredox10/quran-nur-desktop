import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { saukaService, JUZ_MAP, ASSIGNMENTS_COLLECTION, COMMENTS_COLLECTION } from '../services/saukaService';
import { client, databaseId } from '../services/appwrite';
import { useAppStore } from '../store/useAppStore';
import { Loader2, ArrowLeft, CheckCircle2, Clock, Share2, Copy, BookOpen, Trash2, MessageSquare } from 'lucide-react';
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
    
    // Comments
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isDuaOpen, setIsDuaOpen] = useState(false);

    // Modal
    const [selectedJuz, setSelectedJuz] = useState(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);

    useEffect(() => {
        loadData();

        const unsubscribe = client.subscribe(
            [
                `databases.${databaseId}.collections.${ASSIGNMENTS_COLLECTION}.documents`,
                `databases.${databaseId}.collections.${COMMENTS_COLLECTION}.documents`
            ],
            (response) => {
                if (
                    response.events.includes('databases.*.collections.*.documents.*.update') ||
                    response.events.includes('databases.*.collections.*.documents.*.create') ||
                    response.events.includes('databases.*.collections.*.documents.*.delete')
                ) {
                    loadData(true); // silent reload
                }
            }
        );

        return () => unsubscribe();
    }, [groupId]);

    const loadData = async (silent = false) => {
        try {
            if (!data && !silent) setIsLoading(true);
            const result = await saukaService.getGroup(groupId);
            setData(result);
            setNavHeaderTitle(result.group.title);
            
            const commentsData = await saukaService.getComments(groupId);
            setComments(commentsData);
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
            setIsActionModalOpen(false);
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
            setIsActionModalOpen(false);
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
            setIsActionModalOpen(false);
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

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsActionLoading(true);
        try {
            await saukaService.addComment(groupId, newComment.trim());
            setNewComment('');
            const commentsData = await saukaService.getComments(groupId);
            setComments(commentsData);
        } catch (e) {
            alert('Failed to post comment.');
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleDeleteComment = async (commentId) => {
        if (!confirm('Delete comment?')) return;
        try {
            await saukaService.deleteComment(commentId);
            setComments(comments.filter(c => c.$id !== commentId));
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--h-gold)]" size={32} /></div>;
    if (error || !data) return <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center"><p className="text-[var(--h-ink-muted)]">{error}</p><button onClick={() => navigate('/sauka')} className="mt-4 rounded-xl bg-[var(--h-bone)] px-4 py-2 text-sm font-semibold text-[var(--h-ink)]">Go Back</button></div>;

    const { group, assignments, userId } = data;
    const isSurah = group.divisionType === 'surah';
    const isHizb = group.divisionType === 'hizb';
    const unitName = isSurah ? 'Surah' : isHizb ? 'Hizb' : 'Juz';
    const totalParts = isSurah ? 114 : isHizb ? 60 : 30;
    const completedCount = assignments.filter(a => a.status === 'completed').length;
    const isAdmin = group.createdBy === userId;

    const getDaysLeft = (deadline) => {
        if (!deadline) return null;
        const diff = new Date(deadline).getTime() - new Date().getTime();
        if (diff <= 0) return 'Expired';
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return `${days} Day${days !== 1 ? 's' : ''} Left`;
    };

    const handleShareGraphic = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#065f57'; // h-teal
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Decorations
        ctx.fillStyle = '#10756B';
        ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(1080, 1080, 300, 0, Math.PI*2); ctx.fill();

        // Texts
        ctx.fillStyle = '#E5C07B'; // gold
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ALHAMDULILLAH', 540, 300);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('Khatmah Completed!', 540, 420);
        
        ctx.font = '40px sans-serif';
        ctx.fillText(`Group: ${group.title}`, 540, 550);
        
        if (group.intention) {
            ctx.fillStyle = '#E5C07B';
            ctx.font = 'italic 40px sans-serif';
            ctx.fillText(`" ${group.intention.substring(0, 50)}${group.intention.length > 50 ? '...' : ''} "`, 540, 650);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '30px sans-serif';
        ctx.fillText('Read on Quran App', 540, 950);

        // Download
        const link = document.createElement('a');
        link.download = 'khatmah-completed.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 pb-24 pt-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* ── Top Info Card ── */}
                <button 
                    onClick={() => navigate('/sauka')} 
                    className="mb-6 flex w-fit items-center gap-2 rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-2 text-sm font-semibold text-[var(--h-ink-mid)] transition-colors hover:bg-white hover:text-[var(--h-ink)]"
                >
                    <ArrowLeft size={16} /> Back to Sauka
                </button>
                <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)]">
                    <div className="p-6">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h1 className="font-[var(--font-ui)] text-2xl font-bold text-[var(--h-ink)]">{group.title}</h1>
                                <p className="mt-1 text-sm text-[var(--h-ink-muted)]">Organized by {group.createdByName}</p>
                            </div>
                        </div>
                        
                        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                            <span className="text-[var(--h-ink-mid)]">Progress</span>
                            <span className="text-[var(--h-teal)]">{completedCount} / {totalParts} {unitName}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--h-bone-dark)]">
                            <div className="h-full rounded-full bg-[var(--h-teal)] transition-all duration-500" style={{ width: `${(completedCount / totalParts) * 100}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-3 sm:gap-4 mb-6 mt-4">
                            <div className="flex-1 min-w-[120px] flex flex-col items-start px-4 py-3 bg-[var(--h-teal)]/10 rounded-2xl">
                                <span className="text-[10px] font-bold tracking-widest text-[var(--h-teal)] uppercase">Join Code</span>
                                <span className="text-xl font-bold font-mono tracking-widest cursor-pointer text-[var(--h-ink)]" onClick={copyCode}>
                                    {group.joinCode} {copied ? '✓' : ''}
                                </span>
                            </div>
                            {group.deadline && (
                                <div className="flex-1 min-w-[120px] flex flex-col items-start px-4 py-3 bg-[var(--h-teal)]/10 rounded-2xl">
                                    <span className="text-[10px] font-bold tracking-widest text-[var(--h-teal)] uppercase">Deadline</span>
                                    <span className="text-xl font-bold font-mono text-[var(--h-ink)]">{getDaysLeft(group.deadline)}</span>
                                </div>
                            )}
                        </div>
                        {group.intention && (
                            <div className="mt-4 rounded-xl bg-white/50 p-4 border border-[var(--h-bone)]">
                                <p className="text-xs uppercase tracking-wider text-[var(--h-ink-muted)] mb-1 font-[var(--font-mono)]">Dedication / Intention</p>
                                <p className="text-sm italic text-[var(--h-ink)]">"{group.intention}"</p>
                            </div>
                        )}
                    </div>
                    {group.status === 'completed' && (
                        <div className="bg-[var(--h-green)]/10 px-6 py-4 text-center">
                            <p className="text-sm font-bold text-[var(--h-green)] mb-3">Alhamdulillah! This Khatmah is complete.</p>
                            <button onClick={() => setIsDuaOpen(true)} className="rounded-xl bg-[var(--h-green)] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--h-green)]/90">
                                Read Completion Dua
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Grid ── */}
                <h2 className="mb-4 px-2 font-[var(--font-mono)] text-xs uppercase tracking-widest text-[var(--h-ink-muted)]">The {totalParts} {isSurah ? 'Surahs' : isHizb ? 'Hizbs' : 'Juz'}</h2>
                <div className={`grid gap-2 sm:gap-3 ${isSurah ? 'grid-cols-4 min-[400px]:grid-cols-5 sm:grid-cols-8 md:grid-cols-12' : isHizb ? 'grid-cols-4 min-[400px]:grid-cols-5 sm:grid-cols-8 md:grid-cols-10' : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-10'}`}>
                    {assignments.map(j => {
                        const isClaimedByMe = j.claimedBy === userId;
                        const isInactive = j.status === 'in_progress' && j.claimedAt && (new Date().getTime() - new Date(j.claimedAt).getTime()) > 3 * 24 * 60 * 60 * 1000;
                        return (
                            <motion.button
                                key={j.$id}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelectedJuz(j); setIsActionModalOpen(true); }}
                                className={`relative flex aspect-square flex-col items-center justify-center p-2 rounded-xl shadow-sm border transition-all ${j.status === 'completed'
                                    ? 'bg-[var(--h-green)]/10 text-[var(--h-green)] border-[var(--h-green)]/30'
                                    : j.status === 'in_progress'
                                        ? isClaimedByMe ? 'bg-[var(--h-gold)] text-white border-[var(--h-gold)]' : 'bg-gray-100 text-gray-500 border-gray-200'
                                        : 'bg-white text-[var(--h-ink-mid)] border-[var(--h-bone-dark)] hover:border-[var(--h-teal)]'
                                    }`}
                            >
                                {isInactive && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Inactive for over 3 days" />}
                                <span className="text-xl font-bold">{j.partNumber}</span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* ── Comments / Nudges ── */}
                <div className="mt-8 mb-6 rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6">
                    <h2 className="mb-4 font-[var(--font-ui)] text-lg font-bold text-[var(--h-ink)]">Group Activity & Nudges</h2>
                    
                    <div className="mb-6 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {comments.length === 0 ? (
                            <p className="text-sm text-[var(--h-ink-muted)] text-center py-4">No comments yet. Start the conversation!</p>
                        ) : (
                            comments.map(c => (
                                <div key={c.$id} className="rounded-xl bg-white p-3 shadow-sm border border-[var(--h-bone)] relative group/comment">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-semibold text-sm text-[var(--h-ink)]">{c.userName}</span>
                                        <span className="text-[10px] text-[var(--h-ink-muted)]">{new Date(c.$createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-[var(--h-ink-mid)]">{c.text}</p>
                                    {(c.userId === userId || isAdmin) && (
                                        <button onClick={() => handleDeleteComment(c.$id)} className="absolute top-3 right-3 text-red-500 opacity-0 transition-opacity group-hover/comment:opacity-100">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-2">
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Type a message or nudge..." className="flex-1 rounded-xl border border-[var(--h-bone-dark)] bg-white px-4 py-2.5 text-sm text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" />
                        <button type="submit" disabled={isActionLoading || !newComment.trim()} className="rounded-xl bg-[var(--h-teal)] px-4 py-2.5 font-bold text-white transition-colors hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                            Post
                        </button>
                    </form>
                </div>
            </motion.div>

            {/* ── Action Modal ── */}
            <AnimatePresence>
                {isActionModalOpen && selectedJuz && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isActionLoading && setIsActionModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--color-paper)] shadow-xl">
                            
                            <div className="bg-[var(--h-cream)] p-6 text-center border-b border-[var(--h-bone-dark)]">
                                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-[var(--h-bone-dark)]">
                                    <span className="font-[var(--font-ui)] text-3xl font-bold text-[var(--h-ink)]">{selectedJuz.partNumber}</span>
                                </div>
                                <h3 className="font-[var(--font-ui)] text-xl font-bold text-[var(--h-ink)]">{unitName} {selectedJuz.partNumber}</h3>
                            </div>

                            <div className="p-6">
                                {selectedJuz.status === 'unclaimed' ? (
                                    <div className="space-y-3">
                                        <button onClick={() => handleClaim(selectedJuz.$id)} disabled={isActionLoading} className="w-full rounded-xl bg-[var(--h-teal)] py-3 text-sm font-bold text-white hover:bg-[var(--h-teal)]/90 disabled:opacity-50">
                                            Claim {unitName}
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => {
                                                const guestName = prompt(`Enter name to assign ${unitName} ${selectedJuz.partNumber} to:`);
                                                if (guestName) {
                                                    setIsActionLoading(true);
                                                    saukaService.assignGuest(selectedJuz.$id, guestName)
                                                        .then(() => loadData(true))
                                                        .finally(() => {
                                                            setIsActionLoading(false);
                                                            setIsActionModalOpen(false);
                                                        });
                                                }
                                            }} disabled={isActionLoading} className="w-full py-2 text-xs font-semibold text-[var(--h-teal)] border border-[var(--h-teal)] rounded-xl hover:bg-[var(--h-teal)]/10">
                                                Assign to Guest (Admin)
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="mb-6">
                                            <p className="text-xs text-[var(--h-ink-muted)] uppercase tracking-wider mb-1 font-[var(--font-mono)]">Status</p>
                                            <p className="text-[var(--h-ink)] font-bold mb-1">{selectedJuz.status === 'completed' ? 'Completed' : 'In Progress'}</p>
                                            <p className="text-sm text-[var(--h-ink-mid)]">by {selectedJuz.claimedByName || 'Someone'}</p>
                                        </div>

                                        {(selectedJuz.claimedBy === userId || isAdmin) && selectedJuz.status === 'in_progress' && (
                                            <div className="space-y-3">
                                                {(selectedJuz.claimedAt && (new Date().getTime() - new Date(selectedJuz.claimedAt).getTime()) > 3 * 24 * 60 * 60 * 1000) && (
                                                    <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-semibold p-2 bg-red-50 rounded-lg border border-red-100">
                                                        <Clock size={12} /> Claimed more than 3 days ago
                                                    </div>
                                                )}
                                                {selectedJuz.claimedBy === userId && (
                                                    <button onClick={() => {
                                                    let startPage = 1, endPage = 604;
                                                    if (!isSurah) {
                                                        if (isHizb) {
                                                            const juzIndex = Math.ceil(selectedJuz.partNumber / 2) - 1;
                                                            const juzStart = JUZ_MAP[juzIndex]?.startPage || 1;
                                                            const nextJuzStart = JUZ_MAP[juzIndex + 1]?.startPage || 605;
                                                            const half = Math.floor((nextJuzStart - juzStart) / 2);
                                                            if (selectedJuz.partNumber % 2 !== 0) {
                                                                startPage = juzStart;
                                                                endPage = juzStart + half - 1;
                                                            } else {
                                                                startPage = juzStart + half;
                                                                endPage = nextJuzStart - 1;
                                                            }
                                                        } else {
                                                            const juzIndex = selectedJuz.partNumber - 1;
                                                            startPage = JUZ_MAP[juzIndex]?.startPage || 1;
                                                            endPage = (JUZ_MAP[juzIndex + 1]?.startPage || 605) - 1;
                                                        }
                                                    }

                                                    // Resume progress
                                                    const savedProgress = localStorage.getItem(`sauka_progress_${selectedJuz.$id}`);
                                                    let targetPage = startPage;
                                                    if (!isSurah && savedProgress && parseInt(savedProgress) >= startPage && parseInt(savedProgress) <= endPage) {
                                                        targetPage = parseInt(savedProgress);
                                                    }

                                                    navigate(isSurah ? `/surah/${selectedJuz.partNumber}` : `/page/${targetPage}`, { 
                                                        state: { 
                                                            backToSauka: groupId, 
                                                            saukaAssignmentId: selectedJuz.$id, 
                                                            saukaPartNumber: selectedJuz.partNumber, 
                                                            saukaUnit: unitName,
                                                            saukaStartPage: startPage,
                                                            saukaEndPage: endPage
                                                        } 
                                                    });
                                                }} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--h-gold)] py-3.5 text-sm font-bold text-white hover:bg-[var(--h-gold)]/90">
                                                    <BookOpen size={16} /> Start Reading
                                                </button>
                                                )}
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
                
                {/* ── Dua Modal ── */}
                {isDuaOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDuaOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-3xl bg-[var(--color-paper)] p-6 shadow-xl">
                            <h2 className="mb-4 text-center font-[var(--font-ui)] text-2xl font-bold text-[var(--h-ink)]">Dua Khatm al-Quran</h2>
                            <div className="space-y-4 text-center">
                                <p className="text-2xl font-[var(--font-quran)] leading-loose text-[var(--h-ink)]" dir="rtl">
                                    اللَّهُمَّ ارْحَمْنِي بالقُرْآنِ وَاجْعَلهُ لِي إِمَاماً وَنُوراً وَهُدًى وَرَحْمَةً
                                </p>
                                <p className="text-sm italic text-[var(--h-ink-mid)]">
                                    Allahummarhamni bil-qur'an, waj'alhu li imaman wa nuran wa hudan wa rahmah.
                                </p>
                                <p className="text-sm text-[var(--h-ink)]">
                                    "O Allah, have mercy on me through the Quran, and make it a leader, a light, guidance, and mercy for me."
                                </p>
                                
                                <p className="text-2xl font-[var(--font-quran)] leading-loose text-[var(--h-ink)] pt-4 border-t border-[var(--h-bone-dark)]" dir="rtl">
                                    اللَّهُمَّ ذَكِّرْنِي مِنْهُ مَا نَسِيتُ وَعَلِّمْنِي مِنْهُ مَا جَهِلْتُ وَارْزُقْنِي تِلاَوَتَهُ آنَاءَ اللَّيْلِ وَأَطْرَافَ النَّهَارِ وَاجْعَلهُ لِي حُجَّةً يَا رَبَّ العَالَمِينَ
                                </p>
                                <p className="text-sm italic text-[var(--h-ink-mid)]">
                                    Allahumma dhakkirni minhu ma nasitu wa 'allimni minhu ma jahiltu warzuqni tilawatahu aana'al-laili wa atrafan-nahari waj'alhu li hujjatan ya rabbal-'alamin.
                                </p>
                                <p className="text-sm text-[var(--h-ink)]">
                                    "O Allah, remind me of what I have forgotten of it, teach me what I am ignorant of it, and bless me with its recitation during the hours of the night and the edges of the day, and make it a proof for me, O Lord of the worlds."
                                </p>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button onClick={handleShareGraphic} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--h-teal)] text-[var(--h-teal)] py-3 text-sm font-bold hover:bg-[var(--h-teal)]/10">
                                    <Share2 size={16} /> Share Graphic
                                </button>
                                <button onClick={() => setIsDuaOpen(false)} className="flex-1 rounded-xl bg-[var(--h-teal)] py-3 text-sm font-bold text-white hover:bg-[var(--h-teal-mid)]">
                                    Ameen / Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
