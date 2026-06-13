import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, CalendarDays, BookMarked, BookOpen, Layers, Clock, TrendingUp, Flame, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const TOTAL_SURAHS = 114;

function getLastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

function formatMinutes(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getHeatmapLevel(active, duration) {
    if (!active) return 'level-0';
    const mins = Math.round(duration / 60);
    if (mins < 10) return 'level-1';
    if (mins < 30) return 'level-2';
    return 'level-3';
}

const CustomTooltip = ({ active, payload, label, unit = "min", labelFormatter }) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-xl px-3 py-2">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    {labelFormatter ? labelFormatter(label) : label}
                </p>
                <p className="font-ui text-[1rem] font-bold text-[var(--accent-primary)]">
                    {payload[0].value} {unit}
                </p>
            </div>
        );
    }
    return null;
};

export default function Progress() {
    const { setNavHeaderTitle, readingSessions, recentlyRead, bookmarks, collections, pomodoroHistory } = useAppStore();

    useEffect(() => {
        setNavHeaderTitle('Progress & Analytics');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const sessions = readingSessions || [];
    const today = new Date().toISOString().split('T')[0];

    const last7Days = getLastNDays(7);
    const dailyActivity = useMemo(() => {
        return last7Days.map(date => {
            const daySessions = sessions.filter(s => s.date === date);
            const totalSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
            return { name: dayLabel, minutes: Math.round(totalSeconds / 60), date };
        });
    }, [sessions, last7Days]);

    const activityByType = useMemo(() => {
        const typeMap = { reading: 0, memorizing: 0, listening: 0, pomodoro: 0 };
        sessions.forEach(s => {
            if (typeMap[s.type] !== undefined) {
                typeMap[s.type] += s.duration || 0;
            }
        });
        return [
            { name: 'Read', minutes: Math.round(typeMap.reading / 60) },
            { name: 'Memo', minutes: Math.round(typeMap.memorizing / 60) },
            { name: 'Listen', minutes: Math.round(typeMap.listening / 60) },
            { name: 'Focus', minutes: Math.round(typeMap.pomodoro / 60) },
        ];
    }, [sessions]);

    const uniqueSurahsRead = useMemo(() => {
        const surahIds = new Set();
        (recentlyRead || []).forEach(r => surahIds.add(r.chapterId));
        sessions.forEach(s => { if (s.chapterId) surahIds.add(s.chapterId); });
        return surahIds.size;
    }, [sessions, recentlyRead]);

    const streak = useMemo(() => {
        if (sessions.length === 0) return 0;
        const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
        let count = 0;
        const checkDate = new Date();
        for (let i = 0; i < 365; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (uniqueDates.includes(dateStr)) {
                count++;
            } else if (i > 0) {
                break;
            }
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return count;
    }, [sessions]);

    const todayTotal = useMemo(() => {
        return sessions.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0);
    }, [sessions, today]);

    const allTimeTotal = useMemo(() => {
        return sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    }, [sessions]);

    const last35Days = useMemo(() => getLastNDays(35), []);
    const heatmapData = useMemo(() => {
        return last35Days.map(date => {
            const daySessions = sessions.filter(s => s.date === date);
            const totalSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            return { date, active: daySessions.length > 0, duration: totalSeconds };
        });
    }, [sessions, last35Days]);

    const hasData = sessions.length > 0;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="mx-auto mb-20 max-w-[1200px] px-4 pb-20 text-[var(--text-primary)]">
            <svg width="0" height="0">
                <defs>
                    <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" />
                        <stop offset="100%" stopColor="var(--accent-light)" />
                    </linearGradient>
                </defs>
            </svg>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="mb-8 pt-6 text-center">
                    <span className="mb-1 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Analytics Dashboard</span>
                    <h1 className="font-ui text-[1.75rem] font-bold text-[var(--text-primary)]">Your Progress</h1>
                    <p className="text-[0.85rem] text-[var(--text-secondary)] mt-1">{greeting}. Here's the story of your consistency.</p>
                </div>

                {/* TIER 1: The Hero Motivators */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Streak Hero Card */}
                    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-[var(--shadow-glass)] p-6 md:p-8 flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/10 blur-[40px] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Consistency</div>
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent-primary)] shadow-[0_0_15px_var(--accent-light)]">
                                <Flame size={20} className={streak > 0 ? "animate-pulse text-[#e75344]" : ""} />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-end gap-2">
                                <span className="font-ui text-[4rem] font-black leading-none tracking-tight text-[var(--text-primary)]">{streak}</span>
                                <span className="font-ui text-[1.2rem] font-bold text-[var(--text-secondary)] mb-2">Days</span>
                            </div>
                            <div className="mt-2 text-[0.85rem] text-[var(--text-secondary)]">Current active streak</div>
                        </div>
                    </div>

                    {/* Today's Reading Hero */}
                    <div className="relative overflow-hidden rounded-[24px] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-8">
                            <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Today's Focus</div>
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)]">
                                <Clock size={18} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-end gap-2">
                                <span className="font-ui text-[3rem] md:text-[3.5rem] font-black leading-none tracking-tight text-[var(--accent-primary)]">{Math.round(todayTotal / 60)}</span>
                                <span className="font-ui text-[1.2rem] font-bold text-[var(--accent-primary)]/70 mb-2">Mins</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                                    <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (todayTotal / 60) / 30 * 100)}%` }} />
                                </div>
                                <span className="font-mono text-[0.65rem] text-[var(--text-secondary)] whitespace-nowrap">Goal: 30m</span>
                            </div>
                        </div>
                    </div>

                    {/* All-Time Mini Stats Column */}
                    <div className="flex flex-col gap-4">
                        <div className="flex-1 rounded-[24px] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-5 md:p-6 flex items-center gap-4 transition-colors hover:border-[var(--accent-hover)]">
                            <div className="w-12 h-12 shrink-0 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent-primary)]">
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-1">Total Dedicated Time</div>
                                <div className="font-ui text-[1.5rem] font-bold leading-none text-[var(--text-primary)]">{formatMinutes(allTimeTotal)}</div>
                            </div>
                        </div>
                        <div className="flex-1 rounded-[24px] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-5 md:p-6 flex items-center gap-4 transition-colors hover:border-[var(--accent-hover)]">
                            <div className="w-12 h-12 shrink-0 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent-primary)]">
                                <BookMarked size={22} />
                            </div>
                            <div>
                                <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-1">Surahs Explored</div>
                                <div className="font-ui text-[1.5rem] font-bold leading-none text-[var(--text-primary)]">{uniqueSurahsRead} <span className="text-[1rem] text-[var(--text-secondary)] font-normal">/ {TOTAL_SURAHS}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {!hasData && (
                    <div className="mb-8 rounded-[24px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-xl px-6 py-16 text-center relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--accent-primary)]/5 rounded-full blur-[50px] pointer-events-none" />
                        <BookOpen size={48} className="mx-auto mb-5 text-[var(--accent-primary)]/60" />
                        <h3 className="mb-3 font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">Start Your Journey</h3>
                        <p className="mx-auto max-w-[420px] text-[0.95rem] leading-[1.6] text-[var(--text-secondary)] mb-6">Your reading and memorization activity will beautifully visualize here as you use the app.</p>
                        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--text-primary)] text-[var(--bg-main)] font-ui font-bold text-[0.9rem] transition-transform hover:scale-105 active:scale-95">
                            Open Quran
                        </Link>
                    </div>
                )}

                {/* TIER 2: Charts and Breakdown */}
                <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Activity Area Chart */}
                    <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-6 md:p-7">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <Activity size={18} className="text-[var(--accent-primary)]" /> Activity Flow
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)]">Last 7 Days</span>
                        </div>
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}m`} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent-light)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="minutes" 
                                        stroke="url(#colorBar)" 
                                        strokeWidth={3} 
                                        dot={{ fill: 'var(--glass-bg)', stroke: 'var(--accent-primary)', strokeWidth: 2, r: 4 }} 
                                        activeDot={{ r: 6, fill: 'var(--accent-primary)', stroke: 'var(--glass-bg)', strokeWidth: 3 }} 
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Breakdown Bar Chart */}
                    <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-6 md:p-7">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <Layers size={18} className="text-[var(--accent-primary)]" /> Activity Mix
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)]">All Time</span>
                        </div>
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activityByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}m`} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-surface)', opacity: 0.5 }} />
                                    <Bar dataKey="minutes" fill="url(#colorBar)" radius={[6, 6, 6, 6]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* TIER 3: Consistency Heatmap & Small Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mb-8">
                    <div className="rounded-[24px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-6 md:p-7 flex flex-col justify-between">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <CalendarDays size={18} className="text-[var(--accent-primary)]" /> Consistency Heatmap
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)]">Last 5 Weeks</span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="grid grid-flow-col grid-rows-7 gap-[6px] md:gap-2">
                                {heatmapData.map((day, i) => {
                                    const d = new Date(day.date + 'T00:00:00');
                                    const level = getHeatmapLevel(day.active, day.duration);
                                    return (
                                        <div
                                            key={i}
                                            className={`w-[14px] h-[14px] md:w-5 md:h-5 rounded-[4px] transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer shadow-sm ${
                                                level === 'level-0' ? 'bg-[var(--bg-surface)] shadow-none opacity-50' :
                                                level === 'level-1' ? 'bg-[var(--accent-light)] border border-[var(--accent-primary)]/20' :
                                                level === 'level-2' ? 'bg-[var(--accent-primary)] opacity-80' :
                                                'bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                            }`}
                                            title={`${d.toDateString()} — ${day.active ? `${Math.round(day.duration / 60)}m` : 'No activity'}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-2">
                            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)] mr-2">Less</span>
                            <div className="w-3 h-3 md:w-4 md:h-4 rounded-[4px] bg-[var(--bg-surface)] opacity-50" />
                            <div className="w-3 h-3 md:w-4 md:h-4 rounded-[4px] bg-[var(--accent-light)] border border-[var(--accent-primary)]/20" />
                            <div className="w-3 h-3 md:w-4 md:h-4 rounded-[4px] bg-[var(--accent-primary)] opacity-80" />
                            <div className="w-3 h-3 md:w-4 md:h-4 rounded-[4px] bg-[#10b981]" />
                            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)] ml-2">More</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {[
                            { icon: BookMarked, label: 'Bookmarks', value: (bookmarks || []).length, route: '/bookmarks' },
                            { icon: Layers, label: 'Collections', value: (collections || []).length, route: '/collections' },
                            { icon: Activity, label: 'Recent Surahs', value: (recentlyRead || []).length, route: '/' },
                        ].map((item, i) => (
                            <Link to={item.route} key={i} className="group flex-1 rounded-[24px] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-glass)] backdrop-blur-xl p-5 md:p-6 flex items-center justify-between transition-all hover:border-[var(--accent-hover)] hover:shadow-[0_4px_20px_rgba(198,168,124,0.15)] hover:-translate-y-1">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--bg-main)] transition-colors">
                                        <item.icon size={20} />
                                    </div>
                                    <div>
                                        <div className="font-ui text-[1.4rem] font-bold leading-none text-[var(--text-primary)] mb-1">{item.value}</div>
                                        <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">{item.label}</div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-[var(--text-secondary)] opacity-50 group-hover:opacity-100 group-hover:text-[var(--accent-primary)] transition-all transform group-hover:translate-x-1" />
                            </Link>
                        ))}
                    </div>
                </div>

            </motion.div>
        </div>
    );
}
