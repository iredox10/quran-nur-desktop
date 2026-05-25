import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Target, Activity, CalendarDays, BookMarked, BookOpen, Layers, Clock, TrendingUp, Flame, BarChart3 } from 'lucide-react';

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

function getBarLevel(mins, maxMins) {
    if (mins === 0) return 'bg-[var(--bg-surface)]';
    const ratio = maxMins > 0 ? mins / maxMins : 0;
    if (ratio < 0.25) return 'bg-[var(--border-color)]';
    if (ratio < 0.55) return 'bg-[var(--accent-light)] border border-teal-900/12';
    if (ratio < 0.85) return 'bg-[var(--accent-primary)]';
    return 'bg-[#10b981]';
}

function getHeatmapLevel(active, duration) {
    if (!active) return 'level-0';
    const mins = Math.round(duration / 60);
    if (mins < 10) return 'level-1';
    if (mins < 30) return 'level-2';
    return 'level-3';
}

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
    }, [sessions]);

    const maxDayMinutes = useMemo(() => Math.max(...dailyActivity.map(d => d.minutes), 1), [dailyActivity]);

    const activityByType = useMemo(() => {
        const typeMap = { reading: 0, memorizing: 0, listening: 0, pomodoro: 0 };
        sessions.forEach(s => {
            if (typeMap[s.type] !== undefined) {
                typeMap[s.type] += s.duration || 0;
            }
        });
        return [
            { name: 'Reading', minutes: Math.round(typeMap.reading / 60) },
            { name: 'Memorizing', minutes: Math.round(typeMap.memorizing / 60) },
            { name: 'Listening', minutes: Math.round(typeMap.listening / 60) },
            { name: 'Pomodoro', minutes: Math.round(typeMap.pomodoro / 60) },
        ];
    }, [sessions]);

    const pomodoroFocusMinutes = useMemo(() => {
        return (pomodoroHistory || [])
            .filter(session => session.mode === 'focus')
            .reduce((sum, session) => sum + (session.duration || 0), 0);
    }, [pomodoroHistory]);

    const pomodoroFocusCount = useMemo(() => {
        return (pomodoroHistory || []).filter(session => session.mode === 'focus').length;
    }, [pomodoroHistory]);

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

    const surahData = [
        { name: 'Read', value: uniqueSurahsRead },
        { name: 'Remaining', value: TOTAL_SURAHS - uniqueSurahsRead },
    ];
    const COLORS = ['var(--accent-primary)', 'var(--bg-surface)'];

    const weeklyTrend = useMemo(() => {
        const weeks = [];
        for (let w = 3; w >= 0; w--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (w * 7));
            let total = 0;
            const startStr = weekStart.toISOString().split('T')[0];
            const endStr = weekEnd.toISOString().split('T')[0];
            sessions.forEach(s => {
                if (s.date >= startStr && s.date <= endStr) {
                    total += s.duration || 0;
                }
            });
            weeks.push({ name: `W${4 - w}`, minutes: Math.round(total / 60) });
        }
        return weeks;
    }, [sessions]);

    const last30Days = getLastNDays(30);
    const heatmapData = useMemo(() => {
        return last30Days.map(date => {
            const daySessions = sessions.filter(s => s.date === date);
            const totalSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            return { date, active: daySessions.length > 0, duration: totalSeconds };
        });
    }, [sessions]);

    const hasData = sessions.length > 0;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="mx-auto mb-20 max-w-[1200px] px-4 pb-20 text-[var(--text-primary)]">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                <div className="mb-7 pt-6 text-center">
                    <span className="mb-1 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Your Journey</span>
                    <h1 className="font-ui text-[1.75rem] font-bold text-[var(--text-primary)]">Progress & Analytics</h1>
                    <p className="text-[0.85rem] text-[var(--text-secondary)]">{greeting}. Here's how your Quran journey is going.</p>
                </div>

                <div className="mb-7 grid grid-cols-2 gap-[0.6rem] sm:grid-cols-3 md:grid-cols-6">
                    {[
                        { label: 'Current Streak', value: `${streak}`, unit: streak !== 1 ? 'Days' : 'Day', icon: <Flame size={18} /> },
                        { label: 'Surahs Read', value: `${uniqueSurahsRead}`, unit: `/ ${TOTAL_SURAHS}`, icon: <BookMarked size={18} /> },
                        { label: 'Today', value: formatMinutes(todayTotal), icon: <Clock size={18} /> },
                        { label: 'All Time', value: formatMinutes(allTimeTotal), icon: <TrendingUp size={18} /> },
                        { label: 'Focus Time', value: formatMinutes(pomodoroFocusMinutes), icon: <Target size={18} /> },
                        { label: 'Focus Sessions', value: `${pomodoroFocusCount}`, icon: <CalendarDays size={18} /> },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="rounded-[14px] border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md px-3 py-[1.15rem] text-center transition-colors duration-200 hover:border-[var(--accent-hover)]"
                        >
                            <div className="mb-1 text-[var(--accent-primary)]">{stat.icon}</div>
                            <div className="font-ui text-[1.5rem] font-bold leading-[1.2] text-[var(--text-primary)]">
                                {stat.value}
                                {stat.unit && <span className="ml-1 text-[0.7rem] font-normal text-[var(--text-secondary)]">{stat.unit}</span>}
                            </div>
                            <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>

                {!hasData && (
                    <div className="mb-7 rounded-[18px] border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md px-6 py-12 text-center">
                        <BookOpen size={44} className="mx-auto mb-4 text-[var(--text-secondary)]" />
                        <h3 className="mb-2 font-ui text-[1.15rem] font-semibold text-[var(--text-primary)]">Start Your Journey</h3>
                        <p className="mx-auto max-w-[400px] text-[0.88rem] leading-[1.6] text-[var(--text-secondary)]">Your reading and memorization activity will appear here as you use the app. Open a Surah to begin tracking your progress!</p>
                    </div>
                )}

                <div className="mb-7 rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-ui text-[1.1rem] font-semibold text-[var(--text-primary)]">
                            <Activity size={16} /> Weekly Activity
                        </div>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-secondary)]">Last 7 days</span>
                    </div>
                    <div className="mt-3 flex justify-between gap-[0.35rem]">
                        {dailyActivity.map((day, i) => {
                            const isToday = day.date === today;
                            const heightPct = maxDayMinutes > 0 ? Math.max((day.minutes / maxDayMinutes) * 100, day.minutes > 0 ? 8 : 0) : 0;
                            const level = getBarLevel(day.minutes, maxDayMinutes);
                            return (
                                <div key={i} className="flex flex-1 flex-col items-center gap-[0.4rem]">
                                    <span className={`font-mono text-[0.58rem] uppercase tracking-[0.05em] ${isToday ? 'font-bold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>{day.name}</span>
                                    <div className="flex h-12 w-full flex-col-reverse overflow-hidden rounded-[6px] bg-[var(--bg-surface)]">
                                        <div className={`w-full rounded-[6px] transition-all duration-[0.4s] ${level}`} style={{ height: `${heightPct}%` }} />
                                    </div>
                                    <span className={`font-mono text-[0.58rem] ${isToday ? 'font-bold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                        {day.minutes > 0 ? `${day.minutes}m` : '–'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-6 transition-colors duration-200 hover:border-[var(--accent-hover)]">
                        <div className="mb-5 flex items-center gap-1 font-ui text-base font-semibold text-[var(--text-primary)]">
                            <BarChart3 size={16} /> Daily Trend
                        </div>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer>
                                <LineChart data={dailyActivity}>
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip formatter={(value) => [`${value} min`, 'Time Spent']} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 4px 16px rgba(43,63,60,0.08)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)' }} />
                                    <Line type="monotone" dataKey="minutes" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ fill: 'var(--accent-primary)', r: 3.5 }} activeDot={{ r: 5.5, fill: 'var(--accent-hover)' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-6 transition-colors duration-200 hover:border-[var(--accent-hover)]">
                        <div className="mb-5 flex items-center gap-1 font-ui text-base font-semibold text-[var(--text-primary)]">
                            <BookOpen size={16} /> Surah Coverage
                        </div>
                        <div className="relative h-[220px] w-full">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={surahData} innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                                        {surahData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 4px 16px rgba(43,63,60,0.08)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                <div className="font-ui text-[2rem] font-bold leading-none text-[var(--text-primary)]">
                                    {Math.round((uniqueSurahsRead / TOTAL_SURAHS) * 100)}%
                                </div>
                                <div className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-secondary)]">Explored</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-6 transition-colors duration-200 hover:border-[var(--accent-hover)]">
                        <div className="mb-5 flex items-center gap-1 font-ui text-base font-semibold text-[var(--text-primary)]">
                            <Layers size={16} /> Activity Breakdown
                        </div>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer>
                                <BarChart data={activityByType}>
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip formatter={(value) => [`${value} min`, 'Total']} cursor={{ fill: 'var(--bg-surface)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 4px 16px rgba(43,63,60,0.08)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)' }} />
                                    <Bar dataKey="minutes" fill="var(--accent-primary)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-6 transition-colors duration-200 hover:border-[var(--accent-hover)]">
                        <div className="mb-5 flex items-center gap-1 font-ui text-base font-semibold text-[var(--text-primary)]">
                            <TrendingUp size={16} /> Weekly Trend
                        </div>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer>
                                <BarChart data={weeklyTrend}>
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip formatter={(value) => [`${value} min`, 'Total']} cursor={{ fill: 'var(--bg-surface)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 4px 16px rgba(43,63,60,0.08)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)' }} />
                                    <Bar dataKey="minutes" fill="var(--accent-hover)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="mb-7 rounded-2xl border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-6">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-ui text-[1.1rem] font-semibold text-[var(--text-primary)]">
                            <CalendarDays size={16} /> Activity Heatmap
                        </div>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-secondary)]">Last 30 days</span>
                    </div>
                    <div className="mt-3 grid grid-cols-10 gap-[6px]">
                        {heatmapData.map((day, i) => {
                            const d = new Date(day.date + 'T00:00:00');
                            const level = getHeatmapLevel(day.active, day.duration);
                            return (
                                <div
                                    key={i}
                                    className={`aspect-square rounded-[4px] transition-transform duration-[0.15s] hover:scale-110 ${
                                        level === 'level-0' ? 'bg-[var(--bg-surface)] opacity-50' :
                                        level === 'level-1' ? 'bg-[var(--accent-light)] border border-teal-900/12' :
                                        level === 'level-2' ? '' :
                                        'bg-[var(--accent-primary)]'
                                    }`}
                                    style={{ background: level === 'level-2' ? 'var(--accent-light)' : undefined }}
                                    title={`${d.toDateString()} — ${day.active ? `${Math.round(day.duration / 60)}m` : 'No activity'}`}
                                />
                            );
                        })}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-[0.35rem]">
                        <span className="font-mono text-[0.55rem] tracking-[0.05em] text-[var(--text-secondary)]">Less</span>
                        <div className="h-3 w-3 rounded-[2px] bg-[var(--bg-surface)] opacity-50" />
                        <div className="h-3 w-3 rounded-[2px] border border-teal-900/12 bg-[var(--accent-light)]" />
                        <div className="h-3 w-3 rounded-[2px]" style={{ background: 'var(--accent-light)' }} />
                        <div className="h-3 w-3 rounded-[2px] bg-[var(--accent-primary)]" />
                        <span className="font-mono text-[0.55rem] tracking-[0.05em] text-[var(--text-secondary)]">More</span>
                    </div>
                </div>

                <div className="mb-7 grid grid-cols-1 gap-[0.6rem] sm:grid-cols-3">
                    {[
                        { icon: BookMarked, label: 'Bookmarks', value: (bookmarks || []).length, color: 'gold' },
                        { icon: Layers, label: 'Collections', value: (collections || []).length, color: 'teal' },
                        { icon: CalendarDays, label: 'Recent Surahs', value: (recentlyRead || []).length, color: 'green' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-glass)] backdrop-blur-md p-4 transition-all duration-200 hover:border-[var(--accent-hover)] hover:shadow-[0_2px_12px_rgba(184,146,74,0.1)]">
                            <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] ${
                                item.color === 'gold' ? 'bg-[var(--bg-secondary)] text-[var(--accent-hover)]' :
                                item.color === 'teal' ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' :
                                'bg-[rgba(16,185,129,0.1)] text-[#10b981]'
                            }`}>
                                <item.icon size={20} />
                            </div>
                            <div>
                                <div className="font-ui text-[1.35rem] font-bold leading-[1.2] text-[var(--text-primary)]">{item.value}</div>
                                <div className="mt-[0.1rem] font-mono text-[0.58rem] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{item.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

            </motion.div>
        </div>
    );
}
