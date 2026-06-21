import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { getChapters } from '../services/api/quranApi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, CalendarDays, BookMarked, BookOpen, Layers, Clock, TrendingUp, Flame, ChevronRight, Award, History, Sparkles, Target, Lightbulb } from 'lucide-react';
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
            <div className="rounded-[12px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-3 py-2 z-50">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    {labelFormatter ? labelFormatter(label) : label}
                </p>
                <div className="flex flex-col gap-1">
                    {payload.map((entry, index) => (
                        <p key={index} className="font-ui text-[1rem] font-bold" style={{ color: entry.color || 'var(--accent-primary)' }}>
                            {entry.name !== label ? `${entry.name}: ` : ''}{entry.value} {unit}
                        </p>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const CircularProgress = ({ percent, color, size = 64, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size/2} cy={size/2} r={radius} stroke="var(--bg-surface)" strokeWidth={strokeWidth} fill="none" />
                <circle 
                    cx={size/2} 
                    cy={size/2} 
                    r={radius} 
                    stroke={color} 
                    strokeWidth={strokeWidth} 
                    fill="none" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={offset} 
                    strokeLinecap="round" 
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
        </div>
    );
};

export default function Progress() {
    const { setNavHeaderTitle, readingSessions, recentlyRead, bookmarks, collections, pomodoroHistory } = useAppStore();
    const [chartMode, setChartMode] = useState('flow');

    const { data: chapters = [] } = useQuery({ queryKey: ['chapters'], queryFn: getChapters, staleTime: Infinity });

    useEffect(() => {
        setNavHeaderTitle('Analytics');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const sessions = readingSessions || [];
    const today = new Date().toISOString().split('T')[0];

    const last7Days = useMemo(() => getLastNDays(7), []);
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
            { name: 'Reading', value: Math.round(typeMap.reading / 60), color: '#10b981' },
            { name: 'Memorizing', value: Math.round(typeMap.memorizing / 60), color: '#3b82f6' },
            { name: 'Focus', value: Math.round(typeMap.pomodoro / 60), color: '#8b5cf6' },
        ].filter(item => item.value > 0);
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

    const weeklyGoalMins = 180;
    const weeklyTotalMins = useMemo(() => {
        return last7Days.reduce((total, date) => {
            const dayTotal = sessions.filter(s => s.date === date).reduce((sum, s) => sum + (s.duration || 0), 0);
            return total + Math.round(dayTotal / 60);
        }, 0);
    }, [sessions, last7Days]);
    const weeklyGoalPercent = Math.min(100, Math.round((weeklyTotalMins / weeklyGoalMins) * 100));

    const smartInsight = useMemo(() => {
        if (sessions.length === 0) return "Start reading to unlock insights!";
        const dayCounts = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
        sessions.forEach(s => {
            const day = new Date(s.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
            dayCounts[day] += (s.duration || 0);
        });
        const bestDay = Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b);
        if (dayCounts[bestDay] === 0) return "Start reading to unlock insights!";
        
        const fullDays = { 'Sun': 'Sundays', 'Mon': 'Mondays', 'Tue': 'Tuesdays', 'Wed': 'Wednesdays', 'Thu': 'Thursdays', 'Fri': 'Fridays', 'Sat': 'Saturdays' };
        return `You usually read best on ${fullDays[bestDay]}. Keep up the great momentum!`;
    }, [sessions]);

    const achievements = useMemo(() => {
        const badges = [];
        if (streak >= 3) badges.push({ icon: '🔥', title: '3-Day Streak', desc: 'Consistency is key.' });
        if (streak >= 7) badges.push({ icon: '🔥', title: '7-Day Streak', desc: 'A whole week!' });
        if (streak >= 30) badges.push({ icon: '🔥', title: '30-Day Streak', desc: 'Unstoppable!' });
        
        const allTimeMins = Math.round(allTimeTotal / 60);
        if (allTimeMins >= 100) badges.push({ icon: '⏱️', title: '100 Minutes', desc: 'First big milestone.' });
        if (allTimeMins >= 500) badges.push({ icon: '⏱️', title: '500 Minutes', desc: 'Dedicated reader.' });
        
        if (uniqueSurahsRead >= 5) badges.push({ icon: '🗺️', title: 'Explorer', desc: 'Read 5 Surahs.' });
        if (uniqueSurahsRead >= 30) badges.push({ icon: '🗺️', title: 'Traveler', desc: 'Read 30 Surahs.' });
        if (uniqueSurahsRead === TOTAL_SURAHS) badges.push({ icon: '👑', title: 'Khatm', desc: 'Read all 114 Surahs!' });
        
        return badges.reverse().slice(0, 3);
    }, [streak, allTimeTotal, uniqueSurahsRead]);

    const recentActivity = useMemo(() => {
        return [...sessions].sort((a, b) => {
            const timeA = a.timestamp || new Date(a.date).getTime();
            const timeB = b.timestamp || new Date(b.date).getTime();
            return timeB - timeA;
        }).slice(0, 5);
    }, [sessions]);

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
                <div className="mb-6 pt-6 text-center">
                    <span className="mb-1 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Analytics Dashboard</span>
                    <h1 className="font-ui text-[1.75rem] font-bold text-[var(--text-primary)]">Your Progress</h1>
                    <p className="text-[0.85rem] text-[var(--text-secondary)] mt-1">{greeting}. Here's the story of your consistency.</p>
                </div>

                {hasData && (
                    <div className="mb-6 rounded-[16px] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 px-5 py-3 flex items-center gap-3">
                        <Lightbulb size={18} className="text-[var(--accent-primary)] shrink-0" />
                        <span className="text-[0.85rem] text-[var(--text-primary)] font-medium">{smartInsight}</span>
                    </div>
                )}

                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative overflow-hidden rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6 flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/10 blur-[40px] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Consistency</div>
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent-primary)] shadow-[0_0_15px_var(--accent-light)]">
                                <Flame size={20} className={streak > 0 ? "animate-pulse text-[#e75344]" : ""} />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-end gap-2">
                                <span className="font-ui text-[3.5rem] font-black leading-none tracking-tight text-[var(--text-primary)]">{streak}</span>
                                <span className="font-ui text-[1rem] font-bold text-[var(--text-secondary)] mb-1">Days</span>
                            </div>
                            <div className="mt-1 text-[0.8rem] text-[var(--text-secondary)]">Current active streak</div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-8">
                            <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Today's Focus</div>
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)]">
                                <Clock size={18} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-end gap-2">
                                <span className="font-ui text-[3.5rem] font-black leading-none tracking-tight text-[var(--accent-primary)]">{Math.round(todayTotal / 60)}</span>
                                <span className="font-ui text-[1rem] font-bold text-[var(--accent-primary)]/70 mb-1">Mins</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                                    <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (todayTotal / 60) / 30 * 100)}%` }} />
                                </div>
                                <span className="font-mono text-[0.6rem] text-[var(--text-secondary)] whitespace-nowrap">Goal: 30m</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Weekly Goal</div>
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)]">
                                <Target size={18} />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <CircularProgress percent={weeklyGoalPercent} color="var(--accent-primary)" size={70} strokeWidth={6} />
                                <div className="absolute inset-0 flex items-center justify-center font-ui text-[0.9rem] font-bold text-[var(--text-primary)]">
                                    {weeklyGoalPercent}%
                                </div>
                            </div>
                            <div>
                                <div className="font-ui text-[1.4rem] font-bold leading-none text-[var(--text-primary)] mb-1">{weeklyTotalMins} <span className="text-[0.9rem] font-normal text-[var(--text-secondary)]">/ {weeklyGoalMins}m</span></div>
                                <div className="text-[0.75rem] text-[var(--text-secondary)] mt-1">Total this week</div>
                            </div>
                        </div>
                    </div>
                </div>

                {!hasData && (
                    <div className="mb-8 rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] px-6 py-16 text-center relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--accent-primary)]/5 rounded-full blur-[50px] pointer-events-none" />
                        <BookOpen size={48} className="mx-auto mb-5 text-[var(--accent-primary)]/60" />
                        <h3 className="mb-3 font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">Start Your Journey</h3>
                        <p className="mx-auto max-w-[420px] text-[0.95rem] leading-[1.6] text-[var(--text-secondary)] mb-6">Your reading and memorization activity will beautifully visualize here as you use the app.</p>
                        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] font-ui font-bold text-[0.9rem] transition-transform hover:scale-105 active:scale-95">
                            Open Quran
                        </Link>
                    </div>
                )}

                <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6 flex flex-col">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <Activity size={18} className="text-[var(--accent-primary)]" /> Activity Flow
                            </div>
                            <div className="flex bg-[var(--bg-surface)] rounded-full p-1">
                                <button 
                                    className={`px-3 py-1 rounded-full font-mono text-[0.6rem] uppercase tracking-widest transition-colors ${chartMode === 'flow' ? 'bg-[var(--h-white)] border-[1.5px] border-[var(--h-bone-dark)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    onClick={() => setChartMode('flow')}
                                >
                                    7 Days
                                </button>
                                <button 
                                    className={`px-3 py-1 rounded-full font-mono text-[0.6rem] uppercase tracking-widest transition-colors ${chartMode === 'heatmap' ? 'bg-[var(--h-white)] border-[1.5px] border-[var(--h-bone-dark)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    onClick={() => setChartMode('heatmap')}
                                >
                                    Heatmap
                                </button>
                            </div>
                        </div>
                        
                        <div className="h-[240px] w-full flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                {chartMode === 'flow' ? (
                                    <motion.div key="flow" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="w-full h-full">
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
                                                    dot={{ fill: 'var(--h-cream)', stroke: 'var(--accent-primary)', strokeWidth: 2, r: 4 }} 
                                                    activeDot={{ r: 6, fill: 'var(--accent-primary)', stroke: 'var(--h-cream)', strokeWidth: 3 }} 
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </motion.div>
                                ) : (
                                    <motion.div key="heatmap" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="w-full flex flex-col justify-center">
                                        <div className="flex items-end justify-center py-4 overflow-x-auto no-scrollbar">
                                            <div className="flex gap-2">
                                                {Array.from({ length: 5 }).map((_, colIndex) => (
                                                    <div key={colIndex} className="flex flex-col gap-2">
                                                        {heatmapData.slice(colIndex * 7, (colIndex + 1) * 7).map((day, i) => {
                                                            const d = new Date(day.date + 'T00:00:00');
                                                            const level = getHeatmapLevel(day.active, day.duration);
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`w-4 h-4 md:w-5 md:h-5 rounded-[4px] transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer shadow-sm ${
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
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-center gap-2">
                                            <span className="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--text-secondary)] mr-1">Less</span>
                                            <div className="w-3 h-3 rounded-[3px] bg-[var(--bg-surface)] opacity-50" />
                                            <div className="w-3 h-3 rounded-[3px] bg-[var(--accent-light)] border border-[var(--accent-primary)]/20" />
                                            <div className="w-3 h-3 rounded-[3px] bg-[var(--accent-primary)] opacity-80" />
                                            <div className="w-3 h-3 rounded-[3px] bg-[#10b981]" />
                                            <span className="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--text-secondary)] ml-1">More</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6 flex flex-col">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <Layers size={18} className="text-[var(--accent-primary)]" /> Activity Mix
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] font-mono text-[0.6rem] uppercase tracking-widest text-[var(--text-secondary)]">All Time</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center relative">
                            {activityByType.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie 
                                            data={activityByType} 
                                            innerRadius={60} 
                                            outerRadius={80} 
                                            paddingAngle={6} 
                                            dataKey="value" 
                                            stroke="none"
                                            cornerRadius={8}
                                        >
                                            {activityByType.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-[0.85rem] text-[var(--text-secondary)]">No activity data yet.</div>
                            )}
                            {activityByType.length > 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <div className="font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">{Math.round(allTimeTotal / 60)}</div>
                                    <div className="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--text-secondary)]">Mins Total</div>
                                </div>
                            )}
                        </div>
                        {activityByType.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-3 mt-4">
                                {activityByType.map((item, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="font-ui text-[0.8rem] text-[var(--text-secondary)]">{item.name}</span>
                                        <span className="font-ui text-[0.8rem] font-bold text-[var(--text-primary)]">{item.value}m</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                    <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6">
                        <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <Award size={18} className="text-[var(--accent-primary)]" /> Achievements
                            </div>
                        </div>
                        {achievements.length > 0 ? (
                            <div className="grid gap-3">
                                {achievements.map((badge, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 rounded-[16px] bg-[var(--h-white)] border-[1.5px] border-[var(--h-bone-dark)] transition-all hover:bg-[var(--h-bone)] hover:border-[var(--accent-hover)]">
                                        <div className="w-12 h-12 flex items-center justify-center bg-[var(--h-white)] rounded-xl text-[1.5rem] shadow-sm">
                                            {badge.icon}
                                        </div>
                                        <div>
                                            <div className="font-ui text-[1rem] font-bold text-[var(--text-primary)] mb-0.5">{badge.title}</div>
                                            <div className="text-[0.8rem] text-[var(--text-secondary)]">{badge.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-[0.85rem] text-[var(--text-secondary)]">Read consistently to unlock badges!</div>
                        )}
                    </div>

                    <div className="rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-6">
                        <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-ui text-[1.15rem] font-bold text-[var(--text-primary)]">
                                <History size={18} className="text-[var(--accent-primary)]" /> Recent Activity
                            </div>
                        </div>
                        {recentActivity.length > 0 ? (
                            <div className="flex flex-col relative before:absolute before:inset-y-2 before:left-[19px] before:w-0.5 before:bg-[var(--h-bone-dark)]">
                                {recentActivity.map((session, i) => {
                                    const dateObj = new Date(session.timestamp || session.date + 'T00:00:00');
                                    const timeLabel = session.timestamp ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                                    const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                    
                                    let icon = <BookOpen size={14} />;
                                    let color = "text-[#10b981]";
                                    let bg = "bg-[#10b981]/10";
                                    let title = "Reading Session";
                                    
                                    if (session.type === 'pomodoro') {
                                        icon = <Target size={14} />;
                                        color = "text-[#8b5cf6]";
                                        bg = "bg-[#8b5cf6]/10";
                                        title = "Focus Session";
                                    } else if (session.type === 'memorizing') {
                                        icon = <Layers size={14} />;
                                        color = "text-[#3b82f6]";
                                        bg = "bg-[#3b82f6]/10";
                                        title = "Memorization";
                                    }

                                    if (session.chapterId) {
                                        const chapter = chapters.find(c => c.id === parseInt(session.chapterId));
                                        if (chapter) {
                                            title += ` - ${chapter.name_simple}`;
                                        } else {
                                            title += ` - Surah ${session.chapterId}`;
                                        }
                                    }

                                    return (
                                        <div key={i} className="flex gap-4 relative py-3 group">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-[1.5px] border-[var(--h-cream)] shadow-sm z-10 ${bg} ${color}`}>
                                                {icon}
                                            </div>
                                            <div className="flex-1 flex justify-between items-center bg-[var(--h-white)] px-4 py-2 rounded-[16px] group-hover:bg-[var(--h-bone)] transition-colors border-[1.5px] border-transparent group-hover:border-[var(--h-bone-dark)]">
                                                <div>
                                                    <div className="font-ui text-[0.95rem] font-bold text-[var(--text-primary)]">{title}</div>
                                                    <div className="font-mono text-[0.65rem] text-[var(--text-secondary)] mt-0.5">{dateLabel} • {timeLabel}</div>
                                                </div>
                                                <div className="font-ui font-bold text-[0.9rem] text-[var(--text-secondary)]">
                                                    {formatMinutes(session.duration)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-[0.85rem] text-[var(--text-secondary)]">No recent activity found.</div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {[
                        { icon: BookMarked, label: 'Bookmarks', value: (bookmarks || []).length, route: '/bookmarks' },
                        { icon: Layers, label: 'Collections', value: (collections || []).length, route: '/collections' },
                        { icon: Activity, label: 'Recent Surahs', value: (recentlyRead || []).length, route: '/' },
                    ].map((item, i) => (
                        <Link to={item.route} key={i} className="group rounded-[24px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-cream)] p-5 md:p-6 flex items-center justify-between transition-all hover:border-[var(--accent-hover)] hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(198,168,124,0.15)]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--bg-primary)] transition-colors">
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

            </motion.div>
        </div>
    );
}
