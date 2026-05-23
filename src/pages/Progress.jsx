import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Target, Activity, CalendarDays, BookMarked, BookOpen, Layers, Clock, TrendingUp, Flame, BarChart3 } from 'lucide-react';
import './Progress.css';

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
    if (mins === 0) return 'level-0';
    const ratio = maxMins > 0 ? mins / maxMins : 0;
    if (ratio < 0.25) return 'level-1';
    if (ratio < 0.55) return 'level-2';
    if (ratio < 0.85) return 'level-3';
    return 'level-4';
}

function getHeatmapLevel(active, duration) {
    if (!active) return 'level-0';
    const mins = Math.round(duration / 60);
    if (mins < 10) return 'level-1';
    if (mins < 30) return 'level-2';
    return 'level-3';
}

const tooltipStyle = {
    background: '#FAFAF5',
    border: '1.5px solid #DDD7C7',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(43,63,60,0.08)',
    fontFamily: "'Geist Mono', monospace",
    fontSize: '0.72rem',
    color: '#2B3F3C',
};

export default function Progress() {
    const { setNavHeaderTitle, readingSessions, recentlyRead, bookmarks, collections, pomodoroHistory } = useAppStore();

    useEffect(() => {
        setNavHeaderTitle('Progress & Analytics');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const sessions = readingSessions || [];
    const today = new Date().toISOString().split('T')[0];

    // === Compute Stats ===

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
    const COLORS = ['#2E4F4A', '#DDD7C7'];

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

    // 30-day heatmap data
    const last30Days = getLastNDays(30);
    const heatmapData = useMemo(() => {
        return last30Days.map(date => {
            const daySessions = sessions.filter(s => s.date === date);
            const totalSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            return { date, active: daySessions.length > 0, duration: totalSeconds };
        });
    }, [sessions]);

    const hasData = sessions.length > 0;

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="prog">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* ─── Hero ─── */}
                <div className="prog-hero">
                    <span className="prog-eyebrow">Your Journey</span>
                    <h1 className="prog-title">Progress & Analytics</h1>
                    <p className="prog-subtitle">{greeting}. Here's how your Quran journey is going.</p>
                </div>

                {/* ─── Top Stat Cards ─── */}
                <div className="prog-stats">
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
                            className="prog-stat"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                        >
                            <div className="prog-stat-icon">{stat.icon}</div>
                            <div className="prog-stat-value">
                                {stat.value}
                                {stat.unit && <span style={{ fontSize: '0.7rem', color: 'var(--prog-ink-muted)', fontWeight: 400, marginLeft: '0.2rem' }}>{stat.unit}</span>}
                            </div>
                            <div className="prog-stat-label">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>

                {/* ─── Empty State ─── */}
                {!hasData && (
                    <div className="prog-empty">
                        <BookOpen size={44} className="prog-empty-icon" />
                        <h3>Start Your Journey</h3>
                        <p>Your reading and memorization activity will appear here as you use the app. Open a Surah to begin tracking your progress!</p>
                    </div>
                )}

                {/* ─── Weekly Heatmap Bars ─── */}
                <div className="prog-week">
                    <div className="prog-section-header">
                        <div className="prog-section-title">
                            <Activity size={16} /> Weekly Activity
                        </div>
                        <span className="prog-section-badge">Last 7 days</span>
                    </div>
                    <div className="prog-week-grid">
                        {dailyActivity.map((day, i) => {
                            const isToday = day.date === today;
                            const heightPct = maxDayMinutes > 0 ? Math.max((day.minutes / maxDayMinutes) * 100, day.minutes > 0 ? 8 : 0) : 0;
                            const level = getBarLevel(day.minutes, maxDayMinutes);
                            return (
                                <div key={i} className="prog-week-day">
                                    <span className={`prog-week-label ${isToday ? 'prog-week-today' : ''}`}>{day.name}</span>
                                    <div className="prog-week-bar-track">
                                        <div className={`prog-week-bar-fill ${level}`} style={{ height: `${heightPct}%` }} />
                                    </div>
                                    <span className={`prog-week-mins ${isToday ? 'prog-week-today' : ''}`}>
                                        {day.minutes > 0 ? `${day.minutes}m` : '–'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Charts Grid ─── */}
                <div className="prog-charts-grid">

                    {/* Daily Activity Line Chart */}
                    <div className="prog-chart-card">
                        <div className="prog-chart-title">
                            <BarChart3 size={16} /> Daily Trend
                        </div>
                        <div className="prog-chart-wrap">
                            <ResponsiveContainer>
                                <LineChart data={dailyActivity}>
                                    <XAxis dataKey="name" stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip
                                        formatter={(value) => [`${value} min`, 'Time Spent']}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Line type="monotone" dataKey="minutes" stroke="#2E4F4A" strokeWidth={2.5} dot={{ fill: '#2E4F4A', r: 3.5 }} activeDot={{ r: 5.5, fill: '#B8924A' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Surah Coverage Donut */}
                    <div className="prog-chart-card">
                        <div className="prog-chart-title">
                            <BookOpen size={16} /> Surah Coverage
                        </div>
                        <div className="prog-chart-wrap" style={{ position: 'relative' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={surahData}
                                        innerRadius={65}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {surahData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="prog-donut-center">
                                <div className="prog-donut-pct">
                                    {Math.round((uniqueSurahsRead / TOTAL_SURAHS) * 100)}%
                                </div>
                                <div className="prog-donut-label">Explored</div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Breakdown */}
                    <div className="prog-chart-card">
                        <div className="prog-chart-title">
                            <Layers size={16} /> Activity Breakdown
                        </div>
                        <div className="prog-chart-wrap">
                            <ResponsiveContainer>
                                <BarChart data={activityByType}>
                                    <XAxis dataKey="name" stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip
                                        formatter={(value) => [`${value} min`, 'Total']}
                                        cursor={{ fill: 'rgba(46,79,74,0.06)' }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="minutes" fill="#2E4F4A" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Weekly Trend */}
                    <div className="prog-chart-card">
                        <div className="prog-chart-title">
                            <TrendingUp size={16} /> Weekly Trend
                        </div>
                        <div className="prog-chart-wrap">
                            <ResponsiveContainer>
                                <BarChart data={weeklyTrend}>
                                    <XAxis dataKey="name" stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#8E9B97" fontSize={11} tickLine={false} axisLine={false} unit="m" />
                                    <Tooltip
                                        formatter={(value) => [`${value} min`, 'Total']}
                                        cursor={{ fill: 'rgba(46,79,74,0.06)' }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="minutes" fill="#B8924A" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* ─── 30-Day Heatmap ─── */}
                <div className="prog-heatmap">
                    <div className="prog-section-header">
                        <div className="prog-section-title">
                            <CalendarDays size={16} /> Activity Heatmap
                        </div>
                        <span className="prog-section-badge">Last 30 days</span>
                    </div>
                    <div className="prog-heatmap-grid">
                        {heatmapData.map((day, i) => {
                            const d = new Date(day.date + 'T00:00:00');
                            const level = getHeatmapLevel(day.active, day.duration);
                            return (
                                <div
                                    key={i}
                                    className={`prog-heatmap-cell ${level}`}
                                    title={`${d.toDateString()} — ${day.active ? `${Math.round(day.duration / 60)}m` : 'No activity'}`}
                                />
                            );
                        })}
                    </div>
                    <div className="prog-heatmap-legend">
                        <span className="prog-heatmap-legend-label">Less</span>
                        <div className="prog-heatmap-legend-cell" style={{ background: 'var(--prog-bone)', opacity: 0.5 }} />
                        <div className="prog-heatmap-legend-cell" style={{ background: 'var(--prog-teal-soft)', border: '1px solid rgba(46,79,74,0.12)' }} />
                        <div className="prog-heatmap-legend-cell" style={{ background: 'rgba(46,79,74,0.35)' }} />
                        <div className="prog-heatmap-legend-cell" style={{ background: 'var(--prog-teal)' }} />
                        <span className="prog-heatmap-legend-label">More</span>
                    </div>
                </div>

                {/* ─── Bottom Summary Cards ─── */}
                <div className="prog-summary">
                    <div className="prog-summary-card">
                        <div className="prog-summary-icon gold">
                            <BookMarked size={20} />
                        </div>
                        <div>
                            <div className="prog-summary-value">{(bookmarks || []).length}</div>
                            <div className="prog-summary-label">Bookmarks</div>
                        </div>
                    </div>
                    <div className="prog-summary-card">
                        <div className="prog-summary-icon teal">
                            <Layers size={20} />
                        </div>
                        <div>
                            <div className="prog-summary-value">{(collections || []).length}</div>
                            <div className="prog-summary-label">Collections</div>
                        </div>
                    </div>
                    <div className="prog-summary-card">
                        <div className="prog-summary-icon green">
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <div className="prog-summary-value">{(recentlyRead || []).length}</div>
                            <div className="prog-summary-label">Recent Surahs</div>
                        </div>
                    </div>
                </div>

            </motion.div>
        </div>
    );
}
