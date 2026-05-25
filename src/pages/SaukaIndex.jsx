import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { saukaService } from '../services/saukaService';
import { useAppStore } from '../store/useAppStore';
import { Users, Plus, Hash, ArrowRight, Loader2, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SaukaIndex() {
    const { setNavHeaderTitle } = useAppStore();
    const navigate = useNavigate();

    const [groups, setGroups] = useState({ created: [], joined: [], userId: null });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Create Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [createDivisionType, setCreateDivisionType] = useState('juz');
    const [createDeadline, setCreateDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Join Modal
    const [isJoinOpen, setIsJoinOpen] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        setNavHeaderTitle('Group Khatmah');
        loadGroups();
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const loadGroups = async () => {
        try {
            setIsLoading(true);
            setError('');
            const data = await saukaService.getMyGroups();
            setGroups(data);
        } catch (e) {
            console.error(e);
            setError('Please sign in from the Profile page to use Group Khatmah.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createTitle.trim()) return;
        setIsCreating(true);
        try {
            const group = await saukaService.createGroup(createTitle.trim(), createDivisionType, createDeadline);
            setIsCreateOpen(false);
            setCreateTitle('');
            setCreateDeadline('');
            navigate(`/sauka/${group.$id}`);
        } catch (e) {
            console.error(e);
            alert('Failed to create group. Please check your connection.');
            setIsCreating(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        setIsJoining(true);
        try {
            const group = await saukaService.findByCode(joinCode.trim());
            if (group) {
                setIsJoinOpen(false);
                setJoinCode('');
                navigate(`/sauka/${group.$id}`);
            } else {
                alert('Invalid join code.');
                setIsJoining(false);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to join group.');
            setIsJoining(false);
        }
    };

    const allGroups = [...groups.created, ...groups.joined].sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt));

    return (
        <div className="mx-auto max-w-[800px] pb-24 pt-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* ── Header ── */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--h-teal-soft)] text-[var(--h-teal)]">
                        <Users size={32} />
                    </div>
                    <h1 className="font-[var(--font-ui)] text-3xl font-bold text-[var(--h-ink)]">Sauka</h1>
                    <p className="mt-2 text-sm text-[var(--h-ink-muted)]">Read the Quran together with friends and family.</p>
                </div>

                {error ? (
                    <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-[var(--h-ink)]">
                        <AlertCircle className="mx-auto mb-3 text-red-500" size={24} />
                        <p className="mb-4 text-sm">{error}</p>
                        <Link to="/profile" className="inline-block rounded-xl bg-[var(--h-teal)] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--h-teal-mid)]">
                            Go to Profile
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* ── Actions ── */}
                        <div className="mb-10 flex flex-wrap justify-center gap-4">
                            <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 rounded-xl bg-[var(--h-teal)] px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-[var(--h-teal-mid)] active:scale-95">
                                <Plus size={18} /> Create Group
                            </button>
                            <button onClick={() => setIsJoinOpen(true)} className="flex items-center gap-2 rounded-xl border-2 border-[var(--h-teal)] bg-transparent px-6 py-3 font-semibold text-[var(--h-teal)] transition-all hover:bg-[var(--h-teal-soft)] active:scale-95">
                                <Hash size={18} /> Join via Code
                            </button>
                        </div>

                        {/* ── List ── */}
                        <div className="mb-6">
                            <h2 className="mb-4 px-2 font-[var(--font-mono)] text-xs uppercase tracking-widest text-[var(--h-ink-muted)]">Your Groups</h2>
                            {isLoading ? (
                                <div className="flex h-32 items-center justify-center text-[var(--h-gold)]"><Loader2 className="animate-spin" size={24} /></div>
                            ) : allGroups.length === 0 ? (
                                <div className="rounded-2xl border border-[var(--h-bone-dark)] border-dashed py-12 text-center text-sm text-[var(--h-ink-muted)]">
                                    You haven't joined any groups yet.
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {allGroups.map(g => (
                                        <Link key={g.$id} to={`/sauka/${g.$id}`} className="group block rounded-2xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5 no-underline transition-colors hover:border-[var(--h-gold)] hover:bg-white">
                                            <div className="mb-3 flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-[var(--font-ui)] text-lg font-bold text-[var(--h-ink)]">{g.title}</h3>
                                                    <p className="mt-0.5 text-xs text-[var(--h-ink-muted)]">by {g.createdByName}</p>
                                                </div>
                                                {g.status === 'completed' && <CheckCircle2 size={20} className="text-[var(--h-green)]" />}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-[var(--h-ink-muted)]">
                                                <div className="flex items-center gap-1.5 rounded-lg bg-[var(--h-bone)] px-2 py-1">
                                                    <Hash size={12} /> <span className="font-[var(--font-mono)] tracking-wider">{g.joinCode}</span>
                                                </div>
                                                {g.deadline && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={12} /> {new Date(g.deadline).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>

            {/* ── Modals ── */}
            <AnimatePresence>
                {isCreateOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isCreating && setIsCreateOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm rounded-3xl bg-[var(--color-paper)] p-6 shadow-xl">
                            <h2 className="mb-2 font-[var(--font-ui)] text-2xl font-bold text-[var(--h-ink)]">Create Sauka</h2>
                            <p className="mb-6 text-sm text-[var(--h-ink-muted)]">Invite others to complete a Khatmah together.</p>
                            <form onSubmit={handleCreate}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--h-ink-mid)]">Title</label>
                                        <input type="text" value={createTitle} onChange={e => setCreateTitle(e.target.value)} required placeholder="e.g. Ramadan Family Khatmah" className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-3 text-sm text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--h-ink-mid)]">Divide Quran By</label>
                                        <select value={createDivisionType} onChange={e => setCreateDivisionType(e.target.value)} className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-3 text-sm text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)] appearance-none cursor-pointer">
                                            <option value="juz">30 Parts (Juz / Para)</option>
                                            <option value="surah">114 Parts (Surahs / Chapters)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--h-ink-mid)]">Target Date (Optional)</label>
                                        <input type="date" value={createDeadline} onChange={e => setCreateDeadline(e.target.value)} className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-3 text-sm text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)]" />
                                    </div>
                                </div>
                                <div className="mt-8 flex gap-3">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 rounded-xl bg-[var(--h-bone)] py-3 text-sm font-bold text-[var(--h-ink-mid)] hover:bg-[var(--h-bone-dark)]">Cancel</button>
                                    <button type="submit" disabled={isCreating} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-3 text-sm font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {isJoinOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isJoining && setIsJoinOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm rounded-3xl bg-[var(--color-paper)] p-6 shadow-xl">
                            <h2 className="mb-2 font-[var(--font-ui)] text-2xl font-bold text-[var(--h-ink)]">Join Sauka</h2>
                            <p className="mb-6 text-sm text-[var(--h-ink-muted)]">Enter the 6-character invite code.</p>
                            <form onSubmit={handleJoin}>
                                <div>
                                    <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} required maxLength={6} placeholder="Enter Code" className="w-full rounded-xl border border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-4 py-4 text-center font-[var(--font-mono)] text-2xl tracking-[0.2em] text-[var(--h-ink)] outline-none focus:border-[var(--h-teal)] uppercase" />
                                </div>
                                <div className="mt-8 flex gap-3">
                                    <button type="button" onClick={() => setIsJoinOpen(false)} className="flex-1 rounded-xl bg-[var(--h-bone)] py-3 text-sm font-bold text-[var(--h-ink-mid)] hover:bg-[var(--h-bone-dark)]">Cancel</button>
                                    <button type="submit" disabled={isJoining || joinCode.length < 6} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--h-teal)] py-3 text-sm font-bold text-white hover:bg-[var(--h-teal-mid)] disabled:opacity-50">
                                        {isJoining ? <Loader2 size={16} className="animate-spin" /> : <>Join <ArrowRight size={16} /></>}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
