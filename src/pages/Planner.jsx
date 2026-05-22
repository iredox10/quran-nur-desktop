import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import {
    PLANNER_UNITS,
    buildReadingPlanner,
    formatPlannerDate,
    formatPlannerDateLabel,
    getPlannerOverview,
    getPlannerSuccessMetrics,
    getAssignmentProgress,
    getAssignmentStatus,
    addDays,
} from '../utils/planner';
import { getChapters } from '../services/api/quranApi';
import './Planner.css';

/* ─── Icons as inline SVGs to avoid import overhead ─── */
const MoonIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
);
const SunIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
);
const GemIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
        <line x1="12" y1="22" x2="12" y2="2"/><polyline points="2 8.5 12 13.5 22 8.5"/>
    </svg>
);
const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);
const BookIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="set">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
);
const ClockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
);

/* ─── Circular progress SVG ─── */
function RingProgress({ percent, size = 200, stroke = 9, children }) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
        <div className="ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none"
                    stroke="#8B6B40"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }}
                />
            </svg>
            <div className="ring-inner">{children}</div>
        </div>
    );
}

/* ─── Pace computation helpers ─── */
const TOTAL_QURAN_PAGES = 604;

function getPaceStats(durationDays) {
    const dailyPages = Math.ceil(TOTAL_QURAN_PAGES / durationDays);
    const perPrayer = Math.ceil(dailyPages / 5);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { dailyPages, perPrayer, endLabel };
}

/** Returns the current prayer name based on local time (approximate). */
function getPrayerByTime() {
    const now = new Date();
    const t = now.getHours() * 60 + now.getMinutes();
    if (t >= 3 * 60 + 30 && t < 12 * 60) return 'Fajr';
    if (t >= 12 * 60 && t < 15 * 60 + 30) return 'Dhuhr';
    if (t >= 15 * 60 + 30 && t < 18 * 60) return 'Asr';
    if (t >= 18 * 60 && t < 20 * 60) return 'Maghrib';
    return 'Isha';
}

const PACES = [
    { id: 'ramadan',    icon: MoonIcon, title: 'Ramadan Pace',    duration: '30 DAYS',  durationDays: 30,  badge: null },
    { id: 'steady',     icon: SunIcon,  title: 'Steady Journey',  duration: '60 DAYS',  durationDays: 60,  badge: 'MOST BALANCED' },
    { id: 'devotional', icon: GemIcon,  title: 'Devotional Path', duration: '1 YEAR',   durationDays: 365, badge: null },
];

/* ─── Pace card circle — arc length proportional to pages/day ─── */
function PaceRing({ durationDays, selected }) {
    const { dailyPages } = getPaceStats(durationDays);
    const size = 104;
    const stroke = 7;
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const ratio = durationDays <= 30 ? 0.88 : durationDays <= 60 ? 0.72 : 0.45;
    const filled = circ * ratio;
    const gap = circ - filled;
    return (
        <div className="pace-ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(135deg)' }}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--plr-ring-bg)" strokeWidth={stroke} />
                <circle
                    cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={selected ? 'var(--plr-gold)' : 'var(--plr-ring-stroke)'}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${gap}`}
                />
            </svg>
            <div className="pace-ring-label">
                <span className="pace-pages-num">{dailyPages}</span>
                <span className="pace-pages-sub">PAGES / DAY</span>
            </div>
        </div>
    );
}


/* ════════════════════════════════════════════════════════
   INTENTION VIEW  (no active planner)
════════════════════════════════════════════════════════ */
function IntentionView({ onBegin, onViewActive, chapters, hasExistingPlan, planners, activePlannerId, onSwitchPlan, onDeletePlan }) {
    const [selected, setSelected] = useState('steady');
    const [showCustom, setShowCustom] = useState(false);
    const [unitType, setUnitType] = useState('page');
    const [startDate, setStartDate] = useState(formatPlannerDate(new Date()));
    const [pagesPerDay, setPagesPerDay] = useState(10);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(604);
    const [customTitle, setCustomTitle] = useState('');

    const unitMeta = PLANNER_UNITS[unitType];
    const maxUnit = unitMeta?.max || 604;
    const safeEndPage = Math.min(endPage, maxUnit);
    const totalUnits = Math.max(safeEndPage - startPage + 1, 1);
    // Auto-calculate duration from pages per day
    const computedDuration = Math.ceil(totalUnits / Math.max(pagesPerDay, 1));

    const handleBegin = () => {
        const pace = PACES.find(p => p.id === selected);
        if (!pace) return;
        const days = showCustom ? computedDuration : pace.durationDays;
        const unit = showCustom ? unitType : 'page';
        const sUnit = showCustom ? startPage : 1;
        const eUnit = showCustom ? safeEndPage : PLANNER_UNITS[unit].max;
        const title = showCustom ? (customTitle.trim() || '') : pace.title;
        try {
            const built = buildReadingPlanner({
                unitType: unit,
                durationDays: days,
                startDate,
                startUnit: sUnit,
                endUnit: eUnit,
                customTitle: title,
            }, chapters || []);
            onBegin(built);
        } catch (e) {
            console.error('Planner build failed:', e);
            alert(`Could not build plan: ${e.message}`);
        }
    };

    // Compute stats for the currently selected/active duration
    const activeDays = showCustom ? computedDuration : PACES.find(p => p.id === selected)?.durationDays || 60;
    const activeStats = getPaceStats(activeDays);

    return (
        <div className="plr-intention">
            {/* Continue Plan banner */}
            {hasExistingPlan && onViewActive && (
                <motion.button
                    className="plr-continue-banner"
                    onClick={onViewActive}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                >
                    <span>Continue my active plan</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </motion.button>
            )}

            <motion.div className="plr-int-header" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
                <h1 className="plr-int-title">Set Your Intention</h1>
                <p className="plr-int-sub">Choose a pace that aligns with your rhythm.</p>
            </motion.div>

            <div className="plr-pace-list">
                {PACES.map((pace, i) => {
                    const Icon = pace.icon;
                    const isSelected = selected === pace.id;
                    const stats = getPaceStats(pace.durationDays);
                    return (
                        <motion.div key={pace.id} className={`plr-pace-card ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => { setSelected(pace.id); setShowCustom(false); }}
                            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
                            layout
                        >
                            {pace.badge && <div className="plr-pace-badge">{pace.badge}</div>}
                            <div className="plr-pace-icon-wrap"><Icon /></div>
                            <p className="plr-pace-name">{pace.title}</p>
                            <p className="plr-pace-duration">{pace.duration}</p>
                            <PaceRing durationDays={pace.durationDays} selected={isSelected} />
                            <p className="plr-pace-quote">"{stats.perPrayer} pages per prayer"</p>

                            {/* Inline CTA — visible inside selected card */}
                            <AnimatePresence>
                                {isSelected && !showCustom && (
                                    <motion.div className="plr-card-cta"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                                    >
                                        <div className="plr-card-stats">
                                            <span>{stats.dailyPages} pages/day</span>
                                            <span className="plr-card-stats-dot">·</span>
                                            <span>Done by {stats.endLabel}</span>
                                        </div>
                                        <motion.button className="plr-card-begin-btn" whileTap={{ scale: 0.96 }} onClick={e => { e.stopPropagation(); handleBegin(); }}>
                                            BEGIN MY JOURNEY
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Customise toggle */}
            <div className="plr-custom-toggle-row">
                <button className="plr-custom-toggle-btn" onClick={() => setShowCustom(v => !v)}>
                    {showCustom ? '− Hide custom options' : '+ Create custom plan'}
                </button>
            </div>

            <AnimatePresence>
                {showCustom && (
                    <motion.div className="plr-custom-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        {/* Plan title */}
                        <div className="plr-form-group">
                            <label className="plr-form-label">Plan name (optional)</label>
                            <input type="text" className="plr-text-input" value={customTitle}
                                onChange={e => setCustomTitle(e.target.value)}
                                placeholder="e.g. Morning Routine, Juz Amma..." />
                        </div>
                        {/* Unit type */}
                        <div className="plr-form-group">
                            <label className="plr-form-label">Reading unit</label>
                            <div className="plr-unit-pills">
                                {Object.entries(PLANNER_UNITS).map(([key, meta]) => (
                                    <button key={key} className={`plr-unit-pill ${unitType === key ? 'active' : ''}`}
                                        onClick={() => { setUnitType(key); setStartPage(1); setEndPage(meta.max); }}>
                                        {meta.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Page range */}
                        <div className="plr-form-group">
                            <label className="plr-form-label">{unitMeta.label} range</label>
                            <div className="plr-range-inputs">
                                <div className="plr-range-field">
                                    <span className="plr-range-field-label">From</span>
                                    <input type="number" className="plr-num-input" min={1} max={safeEndPage}
                                        value={startPage} onChange={e => setStartPage(Math.max(1, Math.min(Number(e.target.value) || 1, safeEndPage)))} />
                                </div>
                                <span className="plr-range-arrow">→</span>
                                <div className="plr-range-field">
                                    <span className="plr-range-field-label">To</span>
                                    <input type="number" className="plr-num-input" min={startPage} max={maxUnit}
                                        value={safeEndPage} onChange={e => setEndPage(Math.max(startPage, Math.min(Number(e.target.value) || maxUnit, maxUnit)))} />
                                </div>
                            </div>
                            <p className="plr-range-hint">{Math.max(safeEndPage - startPage + 1, 0)} {unitMeta.plural} selected</p>
                        </div>
                        {/* Pages per day */}
                        <div className="plr-form-group">
                            <label className="plr-form-label">{unitMeta.plural} per day</label>
                            <div className="plr-perday-row">
                                <input type="number" className="plr-num-input plr-num-perday" min={1} max={totalUnits}
                                    value={pagesPerDay} onChange={e => setPagesPerDay(Math.max(1, Math.min(Number(e.target.value) || 1, totalUnits)))} />
                                <input type="range" min={1} max={Math.min(totalUnits, 50)} value={Math.min(pagesPerDay, 50)}
                                    onChange={e => setPagesPerDay(Number(e.target.value))} className="plr-range plr-range-perday" />
                            </div>
                        </div>
                        {/* Start date */}
                        <div className="plr-form-group">
                            <label className="plr-form-label">Start date</label>
                            <input type="date" className="plr-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>

                        {/* Custom plan stats + CTA */}
                        <div className="plr-custom-cta-row">
                            <div className="plr-card-stats">
                                <span>{pagesPerDay} {unitMeta.plural}/day</span>
                                <span className="plr-card-stats-dot">·</span>
                                <span>{computedDuration} days</span>
                                <span className="plr-card-stats-dot">·</span>
                                <span>Done by {activeStats.endLabel}</span>
                            </div>
                            <motion.button className="plr-card-begin-btn" whileTap={{ scale: 0.96 }} onClick={handleBegin}>
                                CREATE CUSTOM PLAN
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Existing plans list */}
            {planners && planners.length > 0 && (
                <div className="plr-plans-section">
                    <h2 className="plr-plans-title">My Plans</h2>
                    <div className="plr-plans-list">
                        {planners.map(p => {
                            const overview = getPlannerOverview(p);
                            const pct = overview ? Math.round(overview.completionRatio * 100) : 0;
                            const isActive = p.id === activePlannerId;
                            return (
                                <motion.div key={p.id} className={`plr-plan-item ${isActive ? 'is-active' : ''}`}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                    <div className="plr-plan-info" onClick={() => { onSwitchPlan(p.id); onViewActive?.(); }}>
                                        <p className="plr-plan-name">{p.title || 'Unnamed Plan'}</p>
                                        <p className="plr-plan-meta">
                                            {p.durationDays} days · {p.unitType} · {pct}% complete
                                        </p>
                                        <div className="plr-plan-bar">
                                            <div className="plr-plan-bar-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <div className="plr-plan-actions">
                                        {isActive && <span className="plr-plan-active-badge">Active</span>}
                                        <button className="plr-plan-delete-btn" onClick={() => onDeletePlan(p.id)}
                                            title="Delete this plan" aria-label="Delete plan">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                            </svg>
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function buildPrayerSlots(planner, todayAssignment) {
    if (!todayAssignment) return PRAYER_NAMES.map(name => ({ name, count: 0, doneInSlot: 0, completedUpTo: 0, slotStart: 0, slotRoute: null, status: 'upcoming' }));
    const progress = getAssignmentProgress(planner, todayAssignment);
    const { completedRangeValues } = progress;
    const items = todayAssignment.items;
    const total = items.length;
    const done = progress.completedCount;
    const slots = PRAYER_NAMES.map((name, i) => {
        const slotEnd = Math.floor(((i + 1) / 5) * total);
        const slotStart = Math.floor((i / 5) * total);
        const slotItems = items.slice(slotStart, slotEnd);
        const count = Math.max(slotEnd - slotStart, total > 0 ? 0 : 1);
        // Count how many items within THIS slot are completed
        const doneInSlot = slotItems.filter(item => completedRangeValues.includes(item.rangeValue)).length;
        const isComplete = doneInSlot >= count && count > 0;
        const isCurrent = !isComplete && doneInSlot > 0;
        // First unread item in this slot (for linking)
        const firstUnread = slotItems.find(item => !completedRangeValues.includes(item.rangeValue));
        const slotRoute = (firstUnread || slotItems[0])?.route || null;
        return { name, count, doneInSlot, completedUpTo: slotEnd, slotStartCount: slotStart, slotRoute, status: isComplete ? 'completed' : isCurrent ? 'current' : 'upcoming' };
    });
    const firstIncomplete = slots.findIndex(s => s.status !== 'completed');
    if (firstIncomplete !== -1 && slots[firstIncomplete].status === 'upcoming') {
        // If no progress yet, use time-based detection; otherwise use positional
        const timePrayer = done === 0 ? getPrayerByTime() : null;
        if (timePrayer) {
            // Find the matching slot index by name
            const timeIdx = slots.findIndex(s => s.name === timePrayer);
            const targetIdx = timeIdx >= firstIncomplete ? timeIdx : firstIncomplete;
            slots[targetIdx] = { ...slots[targetIdx], status: 'current' };
        } else {
            slots[firstIncomplete] = { ...slots[firstIncomplete], status: 'current' };
        }
    }
    return slots;
}

/* ════════════════════════════════════════════════════════
   ACTIVE PLANNER VIEW
════════════════════════════════════════════════════════ */
function ActiveView({ planner, onDelete, setPlannerAssignmentProgress, togglePlannerDayComplete }) {
    const overview = useMemo(() => getPlannerOverview(planner), [planner]);
    const metrics = useMemo(() => getPlannerSuccessMetrics(planner), [planner]);
    const today = formatPlannerDate(new Date());

    const todayAssignment = useMemo(() => {
        if (!planner) return null;
        return planner.assignments.find(a => a.date === today) || planner.assignments[overview?.currentDayNumber - 1] || null;
    }, [planner, today, overview]);

    const prayerSlots = useMemo(() => buildPrayerSlots(planner, todayAssignment), [planner, todayAssignment]);

    const unitsLabel = planner ? PLANNER_UNITS[planner.unitType]?.plural : 'Pages';
    const completionDate = planner ? new Date(`${addDays(planner.startDate, planner.durationDays - 1)}T00:00:00`)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const streakDays = metrics?.consistencyStreak ?? 0;
    const currentDay = overview?.currentDayNumber ?? 1;

    const todayProgress = useMemo(() => todayAssignment ? getAssignmentProgress(planner, todayAssignment) : null, [planner, todayAssignment]);
    const nextReadRoute = todayProgress?.nextItem?.route || todayAssignment?.primaryRoute || null;

    // Ring shows TODAY's page progress (not overall day-completion)
    const todayDone = todayProgress?.completedCount ?? 0;
    const todayTotal = todayProgress?.totalCount ?? 1;
    const todayPct = Math.round((todayDone / todayTotal) * 100);

    // Resume: prefer lastReadPage if user was reading, else fallback to next unread
    const resumeRoute = planner?.lastReadPage ? `/page/${planner.lastReadPage}` : nextReadRoute;
    const hasStartedReading = todayDone > 0 || !!planner?.lastReadPage;

    // Overall plan progress for stats row
    const overallPct = overview ? Math.round(overview.completionRatio * 100) : 0;
    const completedDays = overview?.completedCount ?? 0;

    const handleMarkPrayer = (slot) => {
        if (!todayAssignment) return;
        const newCount = slot.completedUpTo;
        setPlannerAssignmentProgress(todayAssignment.dayNumber, newCount);
    };

    const handleUndoPrayer = (slot) => {
        if (!todayAssignment || slot.status !== 'completed') return;
        setPlannerAssignmentProgress(todayAssignment.dayNumber, slot.slotStartCount);
    };

    // Dynamic subtitle
    const nextPrayer = prayerSlots.find(s => s.status === 'current' || s.status === 'upcoming');
    const daySubtitle = (() => {
        if (overview?.isFinishedWindow) return 'Plan complete! 🎉';
        if (!todayAssignment) return 'Starting soon…';
        if (todayDone > 0 && todayDone < todayTotal && nextPrayer) return `${todayDone} of ${todayTotal} ${unitsLabel} read · ${nextPrayer.name} next`;
        if (nextPrayer) return `${todayTotal} ${unitsLabel} today · start with ${nextPrayer.name}`;
        return 'All done for today! ✓';
    })();

    const ringLabel = `${todayDone} OF ${todayTotal} ${PLANNER_UNITS[planner.unitType]?.label.toUpperCase()}S TODAY`;

    return (
        <div className="plr-active">
            <div className="plr-active-bg" aria-hidden="true" />
            <motion.div className="plr-active-inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>

                {/* Day header */}
                <div className="plr-day-header">
                    <h1 className="plr-day-title">Day {currentDay} of {planner.durationDays}</h1>
                    <p className="plr-day-sub">{daySubtitle}</p>
                </div>

                {/* Ring */}
                <div className="plr-ring-section">
                    <RingProgress percent={todayPct} size={200} stroke={9}>
                        <span className="plr-pct">{todayPct}%</span>
                        <span className="plr-juz-label">{ringLabel}</span>
                    </RingProgress>
                </div>

                {/* Stats */}
                <div className="plr-stat-row">
                    <div className="plr-stat-pill">
                        <span className="plr-stat-label">Overall</span>
                        <span className="plr-stat-val">{completedDays}/{planner.durationDays} Days ({overallPct}%)</span>
                    </div>
                    <div className="plr-stat-pill">
                        <span className="plr-stat-label">Finish by</span>
                        <span className="plr-stat-val">{completionDate}</span>
                    </div>
                    <div className="plr-stat-pill">
                        <span className="plr-stat-label">Streak</span>
                        <span className="plr-stat-val">{streakDays} Day{streakDays !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Daily Ritual */}
                <div className="plr-ritual-section">
                    <div className="plr-ritual-header">
                        <h2 className="plr-ritual-title">Daily Ritual</h2>
                        <span className="plr-ritual-status">
                            <span className="plr-ritual-dot" />
                            {todayAssignment && getAssignmentProgress(planner, todayAssignment).isComplete ? 'Complete' : 'In Progress'}
                        </span>
                    </div>

                    <div className="plr-prayers">
                        {prayerSlots.map((slot, i) => (
                            <motion.div key={slot.name}
                                className={`plr-prayer-card plr-prayer-${slot.status}`}
                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 * i, duration: 0.35 }}
                            >
                                <div className={`plr-prayer-icon plr-prayer-icon-${slot.status}`}>
                                    {slot.status === 'completed' && <CheckIcon size={18} />}
                                    {slot.status === 'current' && <BookIcon />}
                                    {slot.status === 'upcoming' && <ClockIcon />}
                                </div>
                                <div className="plr-prayer-info">
                                    <span className={`plr-prayer-name ${slot.status === 'completed' ? 'is-done' : ''}`}>{slot.name}</span>
                                    <span className="plr-prayer-meta">
                                        {slot.status === 'completed' && `${slot.doneInSlot}/${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} ✓`}
                                        {slot.status === 'current' && `${slot.doneInSlot} of ${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} read`}
                                        {slot.status === 'upcoming' && `${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} · not started`}
                                    </span>
                                </div>
                                <div className="plr-prayer-action">
                                    {slot.status === 'completed' && (
                                        <button
                                            className="plr-check-badge"
                                            onClick={() => handleUndoPrayer(slot)}
                                            title="Undo this prayer"
                                        >
                                            <CheckIcon size={14} />
                                        </button>
                                    )}
                                    {slot.status === 'current' && slot.slotRoute && (
                                        <Link to={hasStartedReading ? (resumeRoute || slot.slotRoute) : slot.slotRoute} className="plr-start-btn">
                                            {hasStartedReading ? 'Resume' : 'Start'}
                                        </Link>
                                    )}
                                    {slot.status === 'upcoming' && (
                                        <button className="plr-mark-btn" onClick={() => handleMarkPrayer(slot)} title="Mark done">
                                            <div className="plr-empty-ring" />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="plr-active-footer">
                    {(resumeRoute || nextReadRoute) ? (
                        <Link to={resumeRoute || nextReadRoute} className="plr-open-btn">
                            {hasStartedReading ? 'Resume Reading' : 'Open Al-Quran'}
                        </Link>
                    ) : (
                        <button className="plr-open-btn" disabled>Open Al-Quran</button>
                    )}
                    <p className="plr-ayah-quote">"Recite what has been revealed to you of the Book…" (29:45)</p>
                    <button className="plr-delete-link" onClick={onDelete}
                        title="Delete plan" aria-label="Delete plan">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Delete plan
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════
   ACTIVE VIEW — add back button
════════════════════════════════════════════════════════ */
function ActiveViewWrapper({ planner, onDelete, onBack, setPlannerAssignmentProgress, togglePlannerDayComplete }) {
    return (
        <div style={{ position: 'relative' }}>
            <button className="plr-back-btn" onClick={onBack} aria-label="Back to intention">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
            </button>
            <ActiveView
                planner={planner}
                onDelete={onDelete}
                setPlannerAssignmentProgress={setPlannerAssignmentProgress}
                togglePlannerDayComplete={togglePlannerDayComplete}
            />
        </div>
    );
}
export default function Planner() {
    const {
        setNavHeaderTitle, planner, planners, activePlannerId,
        setPlanner, setActivePlanner, deletePlanner,
        setPlannerAssignmentProgress, togglePlannerDayComplete,
    } = useAppStore();

    const { data: chapters = [] } = useQuery({ queryKey: ['chapters'], queryFn: getChapters, staleTime: Infinity });
    // If user has an active plan with any progress, go straight to the active dashboard
    const hasProgress = planner && (
        (planner.completedDays && planner.completedDays.length > 0) ||
        (planner.assignmentProgress && Object.keys(planner.assignmentProgress).length > 0) ||
        planner.lastReadPage
    );
    const [view, setView] = useState(hasProgress ? 'active' : 'intention');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setNavHeaderTitle('Planner');
        return () => setNavHeaderTitle(null);
    }, [setNavHeaderTitle]);

    const handleBegin = (built) => {
        // Add new plan (don't delete existing ones — support multiple plans)
        setPlanner(built);
        setView('active');
    };

    const handleDelete = () => {
        deletePlanner(planner.id);
        setConfirmDelete(false);
        setView('intention');
    };

    const handleDeletePlan = (id) => {
        if (window.confirm('Delete this plan? All progress will be lost.')) {
            deletePlanner(id);
            // If we deleted the active plan and there are none left, go to intention
            const remaining = (planners || []).filter(p => p.id !== id);
            if (!remaining.length) {
                setView('intention');
            }
        }
    };

    return (
        <>
            <AnimatePresence mode="wait">
                {view === 'active' && planner ? (
                    <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ActiveViewWrapper
                            planner={planner}
                            onDelete={() => setConfirmDelete(true)}
                            onBack={() => setView('intention')}
                            setPlannerAssignmentProgress={setPlannerAssignmentProgress}
                            togglePlannerDayComplete={togglePlannerDayComplete}
                        />
                    </motion.div>
                ) : (
                    <motion.div key="intention" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <IntentionView
                            onBegin={handleBegin}
                            onViewActive={() => setView('active')}
                            hasExistingPlan={!!planner}
                            chapters={chapters}
                            planners={planners || []}
                            activePlannerId={activePlannerId}
                            onSwitchPlan={(id) => { setActivePlanner(id); setView('active'); }}
                            onDeletePlan={handleDeletePlan}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmDelete && (
                    <motion.div className="plr-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setConfirmDelete(false)}>
                        <motion.div className="plr-modal" initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 16 }} onClick={e => e.stopPropagation()}>
                            <h3 className="plr-modal-title">Delete this plan?</h3>
                            <p className="plr-modal-body">All progress will be permanently lost. This cannot be undone.</p>
                            <div className="plr-modal-actions">
                                <button className="plr-modal-cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
                                <button className="plr-modal-confirm" onClick={handleDelete}>Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}



