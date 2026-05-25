import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { MapPin, CalendarPlus } from 'lucide-react';
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
    redistributeMissedAssignments,
    adjustPlannerPace
} from '../utils/planner';
import { getChapters } from '../services/api/quranApi';

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

function RingProgress({ percent, size = 200, stroke = 9, children }) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="#8B6B40" strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">{children}</div>
        </div>
    );
}

const TOTAL_QURAN_PAGES = 604;

function getPaceStats(durationDays, excludeDays = [], startDateStr = null) {
    const dailyPages = Math.ceil(TOTAL_QURAN_PAGES / durationDays);
    const perPrayer = Math.ceil(dailyPages / 5);
    let endDate = startDateStr ? new Date(`${startDateStr}T00:00:00`) : new Date();
    let daysFound = 0;
    
    // Add days sequentially, skipping excluded days
    while (daysFound < durationDays) {
        if (!excludeDays.includes(endDate.getDay())) {
            daysFound++;
        }
        if (daysFound < durationDays) {
            endDate.setDate(endDate.getDate() + 1);
        }
    }
    
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { dailyPages, perPrayer, endLabel };
}

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

function PaceRing({ durationDays, selected, startDate }) {
    const { dailyPages } = getPaceStats(durationDays, [], startDate);
    const size = 104;
    const stroke = 7;
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const ratio = durationDays <= 30 ? 0.88 : durationDays <= 60 ? 0.72 : 0.45;
    const filled = circ * ratio;
    const gap = circ - filled;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size, margin: '0.2rem 0 0.5rem' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" style={{ transform: 'rotate(135deg)' }}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--plr-ring-bg)" strokeWidth={stroke} />
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={selected ? 'var(--plr-gold)' : 'var(--plr-ring-stroke)'}
                    strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${filled} ${gap}`} />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-ui text-[2rem] font-semibold leading-none text-[var(--plr-ink)]">{dailyPages}</span>
                <span className="mt-[3px] font-mono text-[0.48rem] tracking-[0.08em] text-[var(--plr-ink-muted)]">PAGES / DAY</span>
            </div>
        </div>
    );
}

function IntentionView({ onBegin, onViewActive, chapters, hasExistingPlan, planners, activePlannerId, onSwitchPlan, onDeletePlan }) {
    const [selected, setSelected] = useState('steady');
    const [showCustom, setShowCustom] = useState(false);
    const [unitType, setUnitType] = useState('page');
    const [startDate, setStartDate] = useState(formatPlannerDate(new Date()));
    const [pagesPerDay, setPagesPerDay] = useState(10);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(604);
    const [customTitle, setCustomTitle] = useState('');
    const [excludeDays, setExcludeDays] = useState([]);
    const [showArchives, setShowArchives] = useState(false);
    const { archivedPlanners } = useAppStore();

    const unitMeta = PLANNER_UNITS[unitType];
    const maxUnit = unitMeta?.max || 604;
    const safeEndPage = Math.min(Number(endPage) || maxUnit, maxUnit);
    const totalUnits = Math.max(safeEndPage - (Number(startPage) || 1) + 1, 1);
    const computedDuration = Math.ceil(totalUnits / Math.max(Number(pagesPerDay) || 1, 1));

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
                unitType: unit, durationDays: days, startDate, startUnit: sUnit, endUnit: eUnit, customTitle: title, excludeDays: showCustom ? excludeDays : []
            }, chapters || []);
            onBegin(built);
        } catch (e) {
            console.error('Planner build failed:', e);
            alert(`Could not build plan: ${e.message}`);
        }
    };

    const activeDays = showCustom ? computedDuration : PACES.find(p => p.id === selected)?.durationDays || 60;
    const activeStats = getPaceStats(activeDays, showCustom ? excludeDays : [], showCustom ? startDate : undefined);

    return (
        <div className="flex min-h-dvh flex-col overflow-hidden bg-[var(--plr-paper)] pb-8 font-body text-[var(--plr-ink)]">
            {hasExistingPlan && onViewActive && (
                <motion.button className="mx-auto mt-5 flex w-[calc(100%-2.5rem)] max-w-[480px] cursor-pointer items-center justify-between rounded-xl border-none bg-[var(--plr-teal)] px-5 py-4 text-[0.95rem] italic text-white shadow-[0_6px_20px_rgba(46,79,74,0.22)] transition-all duration-200 hover:bg-[var(--plr-teal-mid)] hover:shadow-[0_8px_24px_rgba(46,79,74,0.3)]"
                    onClick={onViewActive} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <span>Continue my active plan</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </motion.button>
            )}

            <motion.div className="px-6 pb-4 pt-6 text-center md:px-8 md:pt-14" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
                <span className="mb-2 block font-mono text-[0.62rem] tracking-[0.2em] text-[var(--plr-teal)] uppercase">THE FIRST STEP</span>
                <h1 className="mb-[0.6rem] font-ui text-[clamp(1.7rem,6vw,2.8rem)] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--plr-ink)]">Set Your Intention</h1>
                <p className="mx-auto max-w-[480px] font-body text-[0.92rem] leading-[1.65] text-[var(--plr-ink-mid)] md:max-w-[560px]">
                    Choose a pace that resonates with your soul. Whether intensive or slow, the journey of the Quran is a dialogue of devotion.
                </p>
            </motion.div>

            <div className="mx-auto flex w-full max-w-[520px] gap-4 overflow-x-auto px-5 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:max-w-[860px] md:justify-center md:gap-5 md:overflow-x-visible md:px-8 [@media(min-width:480px)_and_(max-width:767px)]:max-w-[560px] [@media(min-width:480px)_and_(max-width:767px)]:flex-wrap [@media(min-width:480px)_and_(max-width:767px)]:justify-center [@media(min-width:480px)_and_(max-width:767px)]:overflow-x-visible"
                style={{ scrollSnapType: 'x mandatory' }}>
                {PACES.map((pace, i) => {
                    const Icon = pace.icon;
                    const isSelected = selected === pace.id;
                    const stats = getPaceStats(pace.durationDays, [], startDate);
                    return (
                        <motion.div key={pace.id} className={`flex min-w-[260px] shrink-0 cursor-pointer flex-col items-center gap-[0.4rem] rounded-[14px] border-[1.5px] bg-[var(--plr-cream)] px-5 py-6 text-center shadow-[0_3px_14px_rgba(43,63,60,0.04)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--plr-gold)] hover:shadow-[0_6px_24px_rgba(184,146,74,0.12)] ${
                            isSelected ? 'border-[var(--plr-gold)] shadow-[0_8px_28px_rgba(184,146,74,0.16)]' : 'border-[var(--plr-bone-dark)]'
                        } md:max-w-[260px] md:flex-1 md:shrink md:px-6 md:pb-6 md:pt-8 [@media(min-width:480px)_and_(max-width:767px)]:max-w-[240px] [@media(min-width:480px)_and_(max-width:767px)]:basis-[45%] [@media(min-width:480px)_and_(max-width:767px)]:shrink`}
                            onClick={() => { setSelected(pace.id); setShowCustom(false); }}
                            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }} layout
                            style={{ scrollSnapAlign: 'center' }}
                        >
                            {pace.badge && <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[20px] bg-[var(--plr-teal)] px-3.5 py-[5px] font-mono text-[0.6rem] font-normal tracking-[0.12em] text-white shadow-[0_2px_8px_rgba(46,79,74,0.22)]">{pace.badge}</div>}

                            <PaceRing durationDays={pace.durationDays} selected={isSelected} startDate={startDate} />

                            <p className="font-ui text-[1.05rem] font-semibold tracking-[0.01em] text-[var(--plr-ink)]">{pace.title}</p>
                            <p className="font-mono text-[0.68rem] tracking-[0.03em] text-[var(--plr-ink-mid)]">{stats.dailyPages} pages per day</p>

                            <div className="mt-1 flex items-center gap-1.5 font-body text-[0.82rem] italic text-[var(--plr-ink-mid)]">
                                <Icon />
                                <span>{stats.perPrayer} pages per prayer</span>
                            </div>

                            <motion.button
                                className={`mt-2 hidden w-full cursor-pointer rounded-[10px] border-[1.5px] px-5 py-3 font-mono text-[0.72rem] font-medium uppercase tracking-[0.1em] transition-all duration-200 md:block ${
                                    isSelected
                                        ? 'border-[var(--plr-teal)] bg-[var(--plr-teal)] text-white shadow-[0_4px_16px_rgba(46,79,74,0.22)] hover:bg-[var(--plr-teal-mid)]'
                                        : 'border-[var(--plr-bone-dark)] bg-transparent text-[var(--plr-ink-mid)] hover:border-[var(--plr-teal)] hover:text-[var(--plr-teal)]'
                                }`}
                                whileTap={{ scale: 0.96 }}
                                onClick={e => { e.stopPropagation(); setSelected(pace.id); setShowCustom(false); if (isSelected) handleBegin(); }}
                            >
                                {isSelected ? 'Begin Journey' : 'Select Path'}
                            </motion.button>

                            <AnimatePresence>
                                {isSelected && !showCustom && (
                                    <motion.div className="mt-1.5 flex w-full flex-col items-center gap-2.5 border-t border-[var(--plr-bone-dark)] pt-2 md:hidden"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                                        <div className="flex flex-wrap justify-center gap-[0.3rem] font-mono text-[0.68rem] tracking-[0.03em] text-[var(--plr-ink-mid)]">
                                            <span>{stats.dailyPages} pages/day</span>
                                            <span className="text-[var(--plr-bone-dark)]">·</span>
                                            <span>Done by {stats.endLabel}</span>
                                        </div>
                                        <motion.button className="w-full cursor-pointer rounded-xl border-none bg-[var(--plr-teal)] px-6 py-[0.85rem] font-mono text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white shadow-[0_4px_16px_rgba(46,79,74,0.22)] transition-colors hover:bg-[var(--plr-teal-mid)]" whileTap={{ scale: 0.96 }} onClick={e => { e.stopPropagation(); handleBegin(); }}>
                                            BEGIN MY JOURNEY
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mx-auto mt-6 w-full max-w-[480px] px-5 pb-8">
                <div className="mb-3 flex items-center justify-between border-b border-[var(--plr-bone-dark)] pb-2">
                    <h2 className="font-ui text-[1.15rem] font-semibold text-[var(--plr-ink)] m-0">My Plans</h2>
                    <div className="flex items-center gap-4">
                        {archivedPlanners && archivedPlanners.length > 0 && (
                            <button className="cursor-pointer border-none bg-transparent text-[0.75rem] font-medium tracking-[0.05em] text-[var(--plr-teal)] hover:underline" onClick={() => setShowArchives(true)}>
                                Archives ({archivedPlanners.length})
                            </button>
                        )}
                        <button className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[var(--plr-bone-dark)] bg-transparent text-[var(--plr-teal)] transition-all duration-200 hover:border-[var(--plr-teal)] hover:bg-[var(--plr-teal)] hover:text-white hover:shadow-[0_4px_14px_rgba(46,79,74,0.2)]" onClick={() => setShowCustom(true)} title="Create custom plan">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                {planners && planners.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                        {planners.map(p => {
                            const overview = getPlannerOverview(p);
                            const pct = overview ? Math.round(overview.completionRatio * 100) : 0;
                            const isActive = p.id === activePlannerId;
                            return (
                                <motion.div key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] bg-[var(--plr-cream)] px-4 py-[0.85rem] transition-all duration-200 hover:border-[var(--plr-teal)] ${
                                    isActive ? 'border-[var(--plr-gold)] shadow-[0_3px_12px_rgba(184,146,74,0.12)]' : 'border-[var(--plr-bone-dark)]'
                                }`}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                    <div className="min-w-0 flex-1" onClick={() => { onSwitchPlan(p.id); onViewActive?.(); }}>
                                        <p className="truncate font-body text-[0.92rem] font-semibold text-[var(--plr-ink)]">{p.title || 'Unnamed Plan'}</p>
                                        <p className="mt-0.5 font-mono text-[0.62rem] tracking-[0.04em] text-[var(--plr-ink-muted)]">
                                            {p.durationDays} days · {p.unitType} · {pct}% complete
                                        </p>
                                        <div className="mt-1.5 h-[3px] overflow-hidden rounded-sm bg-[var(--plr-bone-dark)]">
                                            <div className="h-full min-w-[2px] rounded-sm bg-[var(--plr-teal)] transition-all duration-300" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {isActive && <span className="rounded-[10px] bg-[rgba(184,146,74,0.14)] px-2 py-0.5 font-mono text-[0.55rem] font-medium uppercase tracking-[0.1em] text-[var(--plr-gold)]">Active</span>}
                                        <button className="flex cursor-pointer items-center rounded-md border-none bg-transparent p-1 text-[var(--plr-ink-muted)] transition-all duration-200 hover:bg-[rgba(192,57,43,0.08)] hover:text-[#c0392b]" onClick={() => onDeletePlan(p.id)}
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
                ) : (
                    <p className="py-6 text-center font-body text-[0.85rem] italic leading-[1.6] text-[var(--plr-ink-muted)]">No plans yet. Select a path above or tap + to create a custom plan.</p>
                )}
            </div>

            <AnimatePresence>
                {showCustom && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowCustom(false); }}
                    >
                        <motion.div className="flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] bg-[var(--plr-cream)] shadow-[0_24px_80px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)]"
                            initial={{ opacity: 0, y: 40, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 30, scale: 0.96 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                            <div className="flex items-center justify-between border-b border-[var(--plr-bone-dark)] px-6 py-5">
                                <h2 className="font-ui text-xl font-semibold text-[var(--plr-ink)]">Create Custom Plan</h2>
                                <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--plr-bone)] text-[var(--plr-ink-mid)] transition-all duration-150 hover:bg-[var(--plr-bone-dark)] hover:text-[var(--plr-ink)]" onClick={() => setShowCustom(false)} aria-label="Close">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                <div className="mb-5 flex flex-col gap-2">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Plan name (optional)</label>
                                    <input type="text" className="w-full rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-4 py-3 font-body text-[0.95rem] text-[var(--plr-ink)] outline-none transition-all duration-200 focus:border-[var(--plr-gold)] placeholder:text-[var(--plr-ink-muted)] placeholder:opacity-60" value={customTitle}
                                        onChange={e => setCustomTitle(e.target.value)} placeholder="e.g. Morning Routine, Juz Amma..." />
                                </div>
                                <div className="mb-5 flex flex-col gap-2">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Reading unit</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(PLANNER_UNITS).map(([key, meta]) => (
                                            <button key={key} className={`cursor-pointer rounded-[20px] border-[1.5px] px-4 py-[7px] font-body text-[0.85rem] transition-all duration-200 ${
                                                unitType === key
                                                    ? 'border-[var(--plr-teal)] bg-[var(--plr-teal)] text-white'
                                                    : 'border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] text-[var(--plr-ink-mid)]'
                                            }`}
                                                onClick={() => { setUnitType(key); setStartPage(1); setEndPage(meta.max); }}>
                                                {meta.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-5 flex flex-col gap-2">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">{unitMeta.label} range</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-1 flex-col gap-1">
                                            <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--plr-ink-muted)]">From</span>
                                            <input type="number" className="w-full appearance-none rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-3 py-2.5 text-center font-body text-base text-[var(--plr-ink)] outline-none transition-all duration-200 focus:border-[var(--plr-gold)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" min={1} max={safeEndPage}
                                                value={startPage}
                                                onChange={e => setStartPage(e.target.value === '' ? '' : Number(e.target.value))}
                                                onBlur={() => setStartPage(prev => Math.max(1, Math.min(Number(prev) || 1, safeEndPage)))} />
                                        </div>
                                        <span className="shrink-0 pt-4 text-[1.1rem] text-[var(--plr-ink-muted)]">→</span>
                                        <div className="flex flex-1 flex-col gap-1">
                                            <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--plr-ink-muted)]">To</span>
                                            <input type="number" className="w-full appearance-none rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-3 py-2.5 text-center font-body text-base text-[var(--plr-ink)] outline-none transition-all duration-200 focus:border-[var(--plr-gold)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" min={startPage} max={maxUnit}
                                                value={endPage}
                                                onChange={e => setEndPage(e.target.value === '' ? '' : Number(e.target.value))}
                                                onBlur={() => setEndPage(prev => Math.max(Number(startPage) || 1, Math.min(Number(prev) || maxUnit, maxUnit)))} />
                                        </div>
                                    </div>
                                    <p className="mt-0.5 text-center font-mono text-[0.65rem] text-[var(--plr-ink-muted)]">{Math.max((Number(safeEndPage) || 0) - (Number(startPage) || 0) + 1, 0)} {unitMeta.plural} selected</p>
                                </div>
                                <div className="mb-5 flex flex-col gap-2">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">{unitMeta.plural} per day</label>
                                    <div className="flex items-center gap-3">
                                        <input type="number" className="w-[70px] shrink-0 appearance-none rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-3 py-2.5 text-center font-body text-base text-[var(--plr-ink)] outline-none transition-all duration-200 focus:border-[var(--plr-gold)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" min={1} max={totalUnits}
                                            value={pagesPerDay}
                                            onChange={e => setPagesPerDay(e.target.value === '' ? '' : Number(e.target.value))}
                                            onBlur={() => setPagesPerDay(prev => Math.max(1, Math.min(Number(prev) || 1, totalUnits)))} />
                                        <input type="range" min={1} max={Math.min(totalUnits, 50)} value={Math.min(Number(pagesPerDay) || 1, 50)}
                                            onChange={e => setPagesPerDay(Number(e.target.value))}
                                            className="h-[5px] w-full cursor-pointer appearance-none rounded-[3px] bg-[var(--plr-bone-dark)] outline-none [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--plr-teal)] [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.2)]" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 mb-5">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Start date</label>
                                    <input type="date" className="w-full rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-4 py-3 font-body text-[0.95rem] text-[var(--plr-ink)] outline-none transition-all duration-200 focus:border-[var(--plr-gold)]" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="mb-1 flex flex-col gap-2">
                                    <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Days Off (Optional)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                                            const isSelected = excludeDays.includes(idx);
                                            return (
                                                <button key={day} className={`cursor-pointer rounded-[20px] border-[1.5px] px-3 py-1 font-body text-[0.8rem] transition-all duration-200 ${
                                                    isSelected ? 'border-[var(--plr-teal)] bg-[var(--plr-teal)] text-white' : 'border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] text-[var(--plr-ink-mid)]'
                                                }`} onClick={() => setExcludeDays(prev => isSelected ? prev.filter(d => d !== idx) : [...prev, idx])}>
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-1 font-body text-[0.75rem] text-[var(--plr-ink-muted)]">Reading assignments will skip these days.</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-3 border-t border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] px-6 py-4 pb-5">
                                <div className="flex flex-wrap justify-center gap-1 font-mono text-[0.68rem] tracking-[0.03em] text-[var(--plr-ink-mid)]">
                                    <span>{pagesPerDay} {unitMeta.plural}/day</span>
                                    <span className="text-[var(--plr-bone-dark)]">·</span>
                                    <span>{computedDuration} days</span>
                                    <span className="text-[var(--plr-bone-dark)]">·</span>
                                    <span>Done by {activeStats.endLabel}</span>
                                </div>
                                <motion.button className="w-full cursor-pointer rounded-xl border-none bg-[var(--plr-teal)] px-6 py-[0.85rem] font-mono text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white shadow-[0_4px_16px_rgba(46,79,74,0.22)] transition-colors hover:bg-[var(--plr-teal-mid)]" whileTap={{ scale: 0.96 }}
                                    onClick={() => { handleBegin(); setShowCustom(false); }}>
                                    CREATE PLAN
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mx-auto max-w-[480px] px-6 pt-10 pb-6 text-center">
                <p className="font-body text-[0.95rem] italic leading-[1.65] text-[var(--plr-ink-mid)] mb-1">"The best of deeds are those that are consistent, even if they are few."</p>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--plr-ink-muted)]">Prophetic Wisdom</span>
            </div>

            <AnimatePresence>
                {showArchives && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowArchives(false); }}
                    >
                        <motion.div className="flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] bg-[var(--plr-cream)] shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
                            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}>
                            <div className="flex items-center justify-between border-b border-[var(--plr-bone-dark)] px-6 py-5">
                                <h2 className="font-ui text-xl font-semibold text-[var(--plr-ink)]">Past Plans Archive</h2>
                                <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--plr-bone)] text-[var(--plr-ink-mid)] hover:bg-[var(--plr-bone-dark)]" onClick={() => setShowArchives(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                {!archivedPlanners || archivedPlanners.length === 0 ? (
                                    <p className="text-center font-body text-[0.85rem] italic text-[var(--plr-ink-muted)]">No archived plans yet.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {archivedPlanners.map(p => {
                                            const isCompleted = p.completedDays?.length === p.durationDays;
                                            return (
                                                <div key={p.id + p.archivedAt} className="rounded-xl border-[1.5px] border-[var(--plr-bone-dark)] bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-body text-[0.95rem] font-semibold text-[var(--plr-ink)]">{p.title || 'Plan'}</h3>
                                                        <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-medium tracking-[0.05em] uppercase ${isCompleted ? 'bg-[rgba(184,146,74,0.15)] text-[var(--plr-gold)]' : 'bg-[var(--plr-bone)] text-[var(--plr-ink-muted)]'}`}>
                                                            {isCompleted ? 'Completed' : 'Ended'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 font-mono text-[0.65rem] tracking-[0.03em] text-[var(--plr-ink-muted)]">
                                                        {p.durationDays} days · {p.completedDays?.length || 0} days finished
                                                    </p>
                                                    <p className="mt-1.5 font-body text-[0.75rem] text-[var(--plr-ink-mid)] italic">
                                                        Archived on {formatPlannerDateLabel(p.archivedAt.split('T')[0])}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function buildPrayerSlots(planner, todayAssignment, prayerTimes, prayerSettings) {
    const activePrayers = prayerSettings?.activePrayers || PRAYER_NAMES;
    const pref = prayerSettings?.readPreference || 'after';
    
    if (!todayAssignment) return activePrayers.map(name => ({ name, time: null, count: 0, doneInSlot: 0, completedUpTo: 0, slotStart: 0, slotRoute: null, status: 'upcoming' }));
    
    const progress = getAssignmentProgress(planner, todayAssignment);
    const { completedRangeValues } = progress;
    const items = todayAssignment.items;
    const total = items.length;
    
    const numSlots = activePrayers.length || 1;
    
    const slots = activePrayers.map((name, i) => {
        const slotEnd = Math.floor(((i + 1) / numSlots) * total);
        const slotStart = Math.floor((i / numSlots) * total);
        const slotItems = items.slice(slotStart, slotEnd);
        const count = Math.max(slotEnd - slotStart, total > 0 ? 0 : 1);
        const doneInSlot = slotItems.filter(item => completedRangeValues.includes(item.rangeValue)).length;
        const isComplete = doneInSlot >= count && count > 0;
        const isCurrent = !isComplete && doneInSlot > 0;
        const slotRoute = `/planner/read/${todayAssignment.dayNumber}`;
        
        let timeLabel = null;
        if (prayerTimes?.timings?.[name]) {
            const [h, m] = prayerTimes.timings[name].split(':');
            const hNum = parseInt(h, 10);
            const ampm = hNum >= 12 ? 'PM' : 'AM';
            const h12 = hNum % 12 || 12;
            let timeStr = `${h12}:${m} ${ampm}`;
            if (pref === 'before') timeStr = `Before ${timeStr}`;
            else if (pref === 'after') timeStr = `After ${timeStr}`;
            else timeStr = `Around ${timeStr}`;
            timeLabel = timeStr;
        }

        return { name, time: timeLabel, count, doneInSlot, completedUpTo: slotEnd, slotStartCount: slotStart, slotRoute, status: isComplete ? 'completed' : isCurrent ? 'current' : 'upcoming' };
    });
    const firstIncomplete = slots.findIndex(s => s.status !== 'completed');
    if (firstIncomplete !== -1 && slots[firstIncomplete].status === 'upcoming') {
        slots[firstIncomplete] = { ...slots[firstIncomplete], status: 'current' };
    }
    return slots;
}

function ActiveView({ planner, onDelete, setPlannerAssignmentProgress, togglePlannerDayComplete }) {
    const { prayerTimes, setPrayerTimes, location, setLocation, shiftPlannerSchedule, setPlanner, prayerSettings } = useAppStore();
    const overview = useMemo(() => getPlannerOverview(planner), [planner]);
    const metrics = useMemo(() => getPlannerSuccessMetrics(planner), [planner]);
    const today = formatPlannerDate(new Date());

    const [showAdjustPace, setShowAdjustPace] = useState(false);
    const [newDuration, setNewDuration] = useState(planner.durationDays);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (location && (!prayerTimes || prayerTimes.date !== today)) {
            fetch(`https://api.aladhan.com/v1/timings?latitude=${location.lat}&longitude=${location.lng}&method=2`)
                .then(r => r.json())
                .then(data => {
                    if (data.code === 200) {
                        setPrayerTimes({ date: today, timings: data.data.timings });
                    }
                })
                .catch(e => console.error("Prayer API error", e));
        }
    }, [location, prayerTimes, today, setPrayerTimes]);

    const requestLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => alert("Could not access location for prayer times.")
            );
        }
    };

    const handleExportCalendar = () => {
        if (!planner) return;
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//QuranApp//Planner//EN\n";
        planner.assignments.forEach(a => {
            const dateStr = a.date.replace(/-/g, '');
            icsContent += `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${dateStr}\nDTEND;VALUE=DATE:${dateStr}\nSUMMARY:Quran Plan - Day ${a.dayNumber}\nDESCRIPTION:Read ${a.items.length} ${PLANNER_UNITS[planner.unitType]?.plural}\nEND:VEVENT\n`;
        });
        icsContent += "END:VCALENDAR";
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quran_plan.ics`;
        link.click();
    };

    const todayAssignment = useMemo(() => {
        if (!planner) return null;
        return planner.assignments.find(a => a.date === today) || planner.assignments[overview?.currentDayNumber - 1] || null;
    }, [planner, today, overview]);

    const prayerSlots = useMemo(() => buildPrayerSlots(planner, todayAssignment, prayerTimes, prayerSettings), [planner, todayAssignment, prayerTimes, prayerSettings]);

    const unitsLabel = planner ? PLANNER_UNITS[planner.unitType]?.plural : 'Pages';
    const completionDate = planner ? new Date(`${addDays(planner.startDate, planner.durationDays - 1)}T00:00:00`)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const streakDays = metrics?.consistencyStreak ?? 0;
    const currentDay = overview?.currentDayNumber ?? 1;

    const todayProgress = useMemo(() => todayAssignment ? getAssignmentProgress(planner, todayAssignment) : null, [planner, todayAssignment]);
    const todayComplete = todayProgress?.isComplete ?? false;

    const nextAssignment = useMemo(() => {
        if (!planner || !todayComplete) return null;
        return planner.assignments.find(a => {
            if (todayAssignment && a.dayNumber <= todayAssignment.dayNumber) return false;
            return !getAssignmentProgress(planner, a).isComplete;
        }) || null;
    }, [planner, todayComplete, todayAssignment]);

    const nextAssignmentProgress = nextAssignment ? getAssignmentProgress(planner, nextAssignment) : null;
    const nextReadRoute = todayComplete
        ? (nextAssignment ? `/planner/read/${nextAssignment.dayNumber}` : null)
        : (todayAssignment ? `/planner/read/${todayAssignment.dayNumber}` : null);

    const todayDone = todayProgress?.completedCount ?? 0;
    const todayTotal = todayProgress?.totalCount ?? 1;
    const todayPct = Math.round((todayDone / todayTotal) * 100);

    const resumeRoute = nextReadRoute;
    const hasStartedReading = todayDone > 0 || !!planner?.lastReadPage;

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

    const nextPrayer = prayerSlots.find(s => s.status === 'current' || s.status === 'upcoming');
    const daySubtitle = (() => {
        if (overview?.isFinishedWindow && !nextAssignment) return 'Plan complete! 🎉';
        if (!todayAssignment) return 'Starting soon…';
        if (todayComplete && nextAssignment) return `Day ${currentDay} complete! 🎉 · Day ${nextAssignment.dayNumber} ready`;
        if (todayComplete) return `Day ${currentDay} complete! 🎉`;
        if (todayDone > 0 && todayDone < todayTotal && nextPrayer) return `${todayDone} of ${todayTotal} ${unitsLabel} read · ${nextPrayer.name} next`;
        if (nextPrayer) return `${todayTotal} ${unitsLabel} today · start with ${nextPrayer.name}`;
        return 'All done for today! ✓';
    })();

    const ringLabel = `${todayDone} OF ${todayTotal} ${PLANNER_UNITS[planner.unitType]?.label.toUpperCase()}S TODAY`;

    return (
        <div className="relative min-h-dvh overflow-hidden font-body text-[var(--plr-ink)]">
            <div className="pointer-events-none absolute inset-0 z-0" style={{
                background: `
                    radial-gradient(ellipse 80% 55% at 50% -10%, rgba(178,160,110,0.55) 0%, transparent 70%),
                    radial-gradient(ellipse 90% 60% at 80% 20%, rgba(200,184,130,0.3) 0%, transparent 60%),
                    linear-gradient(175deg, #9A9483 0%, #B8A882 18%, #D4C49A 36%, #E8DEBA 55%, #F2EDD8 72%, #F7F3E8 100%)
                `
            }} aria-hidden="true" />
            <motion.div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col items-center px-5 pt-10 pb-24 md:px-8 md:pb-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                <div className="flex w-full flex-col items-center gap-0 md:flex-row md:items-start md:gap-10">
                    <div className="w-full max-w-[480px] md:sticky md:top-8 md:max-w-[340px] md:shrink-0 md:basis-[340px]">
                        <div className="mb-8 text-center">
                            <h1 className="mb-[0.55rem] font-ui text-[clamp(1.9rem,6vw,2.4rem)] font-semibold leading-none tracking-[-0.01em] text-[var(--plr-teal)]">Day {currentDay} of {planner.durationDays}</h1>
                            <p className="font-body text-[0.9rem] text-[var(--plr-ink-mid)]">{daySubtitle}</p>
                        </div>

                        <div className="mb-8 flex justify-center">
                            <RingProgress percent={todayPct} size={200} stroke={9}>
                                <span className="font-ui text-[2.6rem] font-semibold leading-none text-[var(--plr-teal)]">{todayPct}%</span>
                                <span className="font-mono text-[0.58rem] font-normal tracking-[0.1em] text-[#7A6540]">{ringLabel}</span>
                            </RingProgress>
                        </div>

                        <div className="mb-8 flex w-full gap-[0.9rem]">
                            {[
                                { label: 'Overall', val: `${completedDays}/${planner.durationDays} Days (${overallPct}%)` },
                                { label: 'Finish by', val: completionDate },
                                { label: 'Streak', val: `${streakDays} Day${streakDays !== 1 ? 's' : ''}` },
                            ].map(s => (
                                <div key={s.label} className="flex flex-1 flex-col gap-[0.4rem] rounded-xl bg-[rgba(250,247,240,0.82)] p-[1.1rem] shadow-[0_2px_12px_rgba(43,63,60,0.05)] backdrop-blur-md">
                                    <span className="font-body text-[0.78rem] leading-[1.3] text-[var(--plr-ink-muted)]">{s.label}</span>
                                    <span className="font-ui text-[1.45rem] font-semibold leading-none text-[var(--plr-ink)]">{s.val}</span>
                                </div>
                            ))}
                        </div>

                        <div className="hidden py-4 md:block md:w-full md:text-center">
                            {(() => {
                                const planDone = overview?.isFinishedWindow && !nextAssignment;
                                const ctaRoute = todayComplete ? (nextReadRoute || resumeRoute) : (resumeRoute || nextReadRoute);
                                const ctaLabel = planDone
                                    ? 'Plan Complete ✓'
                                    : todayComplete && nextAssignment
                                        ? `Continue to Day ${nextAssignment.dayNumber}`
                                        : todayComplete ? 'All Caught Up'
                                            : hasStartedReading ? 'Resume Reading' : 'Open Al-Quran';
                                if (planDone || !ctaRoute) {
                                    return <button className="w-full cursor-pointer rounded-[40px] border-none bg-[var(--plr-teal)] p-[1.1rem] font-ui text-[1.05rem] font-semibold tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(46,79,74,0.24)] transition-all duration-200 hover:bg-[var(--plr-teal-mid)] hover:shadow-[0_10px_28px_rgba(46,79,74,0.3)] disabled:opacity-70" disabled>{ctaLabel}</button>;
                                }
                                return (
                                    <>
                                        <Link to={ctaRoute} className="inline-flex w-full items-center justify-center rounded-[40px] bg-[var(--plr-teal)] p-[1.1rem] font-ui text-[1.05rem] font-semibold tracking-[0.02em] text-white no-underline shadow-[0_8px_22px_rgba(46,79,74,0.24)] transition-all duration-200 hover:bg-[var(--plr-teal-mid)] hover:shadow-[0_10px_28px_rgba(46,79,74,0.3)]">{ctaLabel}</Link>
                                        {overview?.overdueDays > 0 && (
                                            <div className="mt-4 flex flex-col gap-2">
                                                <button onClick={() => shiftPlannerSchedule(planner.id, overview.overdueDays)} className="w-full cursor-pointer rounded-[40px] border-2 border-[var(--plr-error)] bg-transparent p-[0.95rem] font-ui text-[0.95rem] font-bold text-[var(--plr-error)] shadow-[0_4px_12px_rgba(192,57,43,0.1)] transition-all duration-200 hover:bg-[var(--plr-error-light)]">
                                                    Catch Up (Shift {overview.overdueDays} Days)
                                                </button>
                                                <button onClick={() => {
                                                    const updated = redistributeMissedAssignments(planner);
                                                    if (updated) setPlanner(updated);
                                                }} className="w-full cursor-pointer rounded-[40px] border-none bg-[rgba(192,57,43,0.12)] p-[0.95rem] font-ui text-[0.95rem] font-bold text-[#c0392b] shadow-none transition-all duration-200 hover:bg-[rgba(192,57,43,0.18)]" title="Keep the same end date, distribute missed reading across remaining days">
                                                    Redistribute Missed Pages
                                                </button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="w-full max-w-[480px] md:min-w-0 md:flex-1 md:max-w-full">
                        <div className="mx-auto mb-5 w-full max-w-[480px] px-0 md:max-w-full md:px-0">
                            <div className="mb-3 flex items-baseline justify-between">
                                <h2 className="font-ui text-[1.1rem] font-semibold text-[var(--plr-ink)]">Timeline</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowAdjustPace(true)} className="cursor-pointer border-none bg-transparent text-[0.7rem] font-medium tracking-[0.05em] text-[var(--plr-teal)] hover:underline">Adjust Pace</button>
                                    <span className="font-mono text-[0.62rem] tracking-[0.05em] text-[var(--plr-ink-muted)] hidden md:inline-block">· {completedDays} of {planner.durationDays} done</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-[6px] rounded-[14px] border border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] p-3 md:gap-[7px]">
                                {planner.assignments.map(a => {
                                    const status = getAssignmentStatus(planner, a, today);
                                    const progress = getAssignmentProgress(planner, a);
                                    const isToday = a.date === today;
                                    const pct = progress.totalCount ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0;
                                    const statusStyles = {
                                        completed: 'bg-[var(--plr-teal)] text-white',
                                        today: 'shadow-[0_0_0_2px_var(--plr-gold)] bg-[rgba(184,146,74,0.12)] text-[var(--plr-gold)]',
                                        overdue: 'shadow-[0_0_0_1.5px_rgba(192,57,43,0.3)] bg-[rgba(192,57,43,0.1)] text-[#c0392b]',
                                        upcoming: 'bg-[var(--plr-bone)] text-[var(--plr-ink-muted)]',
                                    };
                                    return (
                                        <motion.div key={a.dayNumber}
                                            className={`relative flex h-8 w-8 cursor-default flex-col items-center justify-center rounded-full transition-all duration-200 md:h-[34px] md:w-[34px] ${statusStyles[status] || statusStyles.upcoming}`}
                                            title={`Day ${a.dayNumber}: ${a.title} — ${status === 'completed' ? '✓ Done' : status === 'today' ? `${pct}%` : status}`}
                                            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                                            <span className="relative z-10 font-mono text-[0.55rem] font-medium leading-none">{a.dayNumber}</span>
                                            {status === 'completed' && (
                                                <svg className="absolute bottom-px right-px opacity-85" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"/>
                                                </svg>
                                            )}
                                            {isToday && status !== 'completed' && pct > 0 && (
                                                <div className="pointer-events-none absolute inset-0 rounded-full opacity-25" style={{ background: `conic-gradient(var(--plr-gold) ${pct}%, transparent ${pct}%)` }} />
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <div className="mt-2.5 flex flex-wrap justify-center gap-4">
                                {[
                                    { label: 'Done', color: 'var(--plr-teal)' },
                                    { label: 'Today', color: 'var(--plr-gold)' },
                                    { label: 'Missed', color: '#c0392b' },
                                    { label: 'Upcoming', color: 'var(--plr-bone-dark)' },
                                ].map(item => (
                                    <span key={item.label} className="flex items-center gap-1 font-mono text-[0.58rem] tracking-[0.04em] text-[var(--plr-ink-muted)]">
                                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                                        {item.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="mb-6 w-full max-w-[480px] md:max-w-full md:px-0">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="font-ui text-[1.35rem] font-semibold tracking-[0.01em] text-[var(--plr-ink)]">Daily Ritual</h2>
                                <div className="flex gap-2">
                                    <button onClick={handleExportCalendar} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--plr-bone-dark)] bg-transparent text-[var(--plr-ink-muted)] hover:bg-[var(--plr-bone)] hover:text-[var(--plr-ink)] transition-colors" title="Export Calendar">
                                        <CalendarPlus size={16} />
                                    </button>
                                    {!location && (
                                        <button onClick={requestLocation} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--plr-bone-dark)] bg-transparent text-[var(--plr-ink-muted)] hover:bg-[var(--plr-bone)] hover:text-[var(--plr-ink)] transition-colors" title="Use Location for Prayer Times">
                                            <MapPin size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => setShowSettings(true)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--plr-bone-dark)] bg-transparent text-[var(--plr-ink-muted)] hover:bg-[var(--plr-bone)] hover:text-[var(--plr-ink)] transition-colors" title="Settings">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-[0.7rem]">
                                {prayerSlots.map((slot, i) => (
                                    <motion.div key={slot.name}
                                        className={`flex items-center gap-[0.85rem] rounded-xl px-4 py-4 shadow-[0_2px_10px_rgba(43,63,60,0.04)] transition-shadow ${
                                            slot.status === 'current'
                                                ? 'bg-[rgba(232,224,206,0.75)] shadow-[0_4px_18px_rgba(184,146,74,0.12)]'
                                                : 'bg-[rgba(250,247,240,0.88)] backdrop-blur-md'
                                        }`}
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.05 * i, duration: 0.35 }}
                                    >
                                        <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition-colors duration-200 text-white ${
                                            slot.status === 'completed' ? 'bg-[var(--plr-check-bg)]' : slot.status === 'current' ? 'bg-[var(--plr-book-bg)]' : 'bg-[var(--plr-clock-bg)] text-[var(--plr-ink-muted)]'
                                        }`}>
                                            {slot.status === 'completed' && <CheckIcon size={18} />}
                                            {slot.status === 'current' && <BookIcon />}
                                            {slot.status === 'upcoming' && <ClockIcon />}
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col gap-[0.18rem]">
                                            <span className={`font-ui text-base font-semibold tracking-[0.01em] text-[var(--plr-ink)] flex items-center gap-2 ${slot.status === 'completed' ? 'line-through opacity-55' : ''}`}>
                                                {slot.name}
                                                {slot.time && <span className="text-[0.7rem] font-mono text-[var(--plr-ink-muted)] bg-[var(--plr-bone)] px-1.5 py-0.5 rounded-sm no-underline opacity-80 inline-block">{slot.time}</span>}
                                            </span>
                                            <span className={`font-body text-[0.78rem] leading-[1.3] ${slot.status === 'current' ? 'text-[#7A6540]' : 'text-[var(--plr-ink-muted)]'}`}>
                                                {slot.status === 'completed' && `${slot.doneInSlot}/${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} ✓`}
                                                {slot.status === 'current' && `${slot.doneInSlot} of ${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} read`}
                                                {slot.status === 'upcoming' && `${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} · not started`}
                                            </span>
                                        </div>
                                        <div className="shrink-0">
                                            {slot.status === 'completed' && (
                                                <button className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(77,122,114,0.12)] text-[var(--plr-check-bg)] transition-all duration-[0.18s] hover:scale-110 hover:bg-[rgba(192,57,43,0.1)] hover:text-[#c0392b]"
                                                    onClick={() => handleUndoPrayer(slot)} title="Undo this prayer">
                                                    <CheckIcon size={14} />
                                                </button>
                                            )}
                                            {slot.status === 'current' && slot.slotRoute && (
                                                <Link to={hasStartedReading ? (resumeRoute || slot.slotRoute) : slot.slotRoute}
                                                    className="inline-flex cursor-pointer items-center rounded-[20px] border-none bg-[var(--plr-teal)] px-[18px] py-[7px] font-body text-[0.82rem] italic text-white no-underline transition-all duration-200 hover:bg-[var(--plr-teal-mid)]">
                                                    {hasStartedReading ? 'Resume' : 'Start'}
                                                </Link>
                                            )}
                                            {slot.status === 'upcoming' && (
                                                <button className="flex cursor-pointer items-center border-none bg-transparent p-0.5" onClick={() => handleMarkPrayer(slot)} title="Mark done">
                                                    <div className="h-5 w-5 rounded-full border-[1.5px] border-[rgba(43,63,60,0.25)]" />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex w-full flex-col items-center gap-[0.9rem] mt-2">
                    <p className="px-2 text-center font-body text-[0.82rem] italic leading-[1.55] text-[var(--plr-ink-muted)]">"Recite what has been revealed to you of the Book…" (29:45)</p>
                    <button className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-1.5 font-body text-[0.78rem] text-[var(--plr-ink-muted)] opacity-50 transition-all duration-200 hover:opacity-100 hover:text-[#c0392b]" onClick={onDelete}
                        title="Delete plan" aria-label="Delete plan">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Delete plan
                    </button>
                </div>
            </motion.div>

            <AnimatePresence>
                {showAdjustPace && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowAdjustPace(false); }}>
                        <motion.div className="w-full max-w-[400px] rounded-[20px] bg-[var(--plr-cream)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
                            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}>
                            <h2 className="mb-4 font-ui text-xl font-semibold text-[var(--plr-ink)]">Adjust Pace</h2>
                            <p className="mb-5 font-body text-[0.85rem] leading-relaxed text-[var(--plr-ink-mid)]">
                                Change how many days you want to complete your remaining plan in. This will re-calculate your daily assignments.
                            </p>
                            <div className="mb-6 flex flex-col gap-2">
                                <label className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">New Total Days</label>
                                <input type="number" min="1" max="1000" className="w-full rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-white px-4 py-3 font-body text-[1.1rem] text-[var(--plr-ink)] outline-none focus:border-[var(--plr-teal)]"
                                    value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="flex gap-3">
                                <button className="flex-1 cursor-pointer rounded-xl border border-[var(--plr-bone-dark)] bg-transparent p-3 font-body font-medium text-[var(--plr-ink-mid)] transition-colors hover:bg-[var(--plr-bone)]" onClick={() => setShowAdjustPace(false)}>Cancel</button>
                                <button className="flex-1 cursor-pointer rounded-xl border-none bg-[var(--plr-teal)] p-3 font-body font-medium text-white transition-colors hover:bg-[var(--plr-teal-mid)]" onClick={() => {
                                    const updated = adjustPlannerPace(planner, newDuration);
                                    setPlanner(updated);
                                    setShowAdjustPace(false);
                                }}>Apply Changes</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSettings && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,35,32,0.45)] p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
                        <motion.div className="w-full max-w-[400px] rounded-[20px] bg-[var(--plr-cream)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
                            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}>
                            <h2 className="mb-4 font-ui text-xl font-semibold text-[var(--plr-ink)]">Planner Settings</h2>
                            
                            <div className="flex flex-col gap-5 mb-6">
                                <div className="flex flex-col gap-2">
                                    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Daily Prayers</h3>
                                    <p className="font-body text-[0.8rem] text-[var(--plr-ink-mid)] mb-1">Select which prayers you want to distribute reading across.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(p => {
                                            const isActive = useAppStore.getState().prayerSettings?.activePrayers?.includes(p) ?? true;
                                            return (
                                                <button key={p} className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 font-body text-[0.8rem] transition-colors ${
                                                    isActive ? 'border-[var(--plr-teal)] bg-[var(--plr-teal)] text-white' : 'border-[var(--plr-bone-dark)] text-[var(--plr-ink-muted)]'
                                                }`} onClick={() => {
                                                    const s = useAppStore.getState();
                                                    const current = s.prayerSettings?.activePrayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                                                    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
                                                    if(next.length === 0) return; // Must have at least 1
                                                    s.updatePrayerSettings({ activePrayers: next });
                                                }}>
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Reading Preference</h3>
                                    <select className="w-full rounded-[10px] border-[1.5px] border-[var(--plr-bone-dark)] bg-white px-3 py-2 font-body text-[0.9rem] text-[var(--plr-ink)] outline-none"
                                        value={useAppStore.getState().prayerSettings?.readPreference || 'after'}
                                        onChange={e => useAppStore.getState().updatePrayerSettings({ readPreference: e.target.value })}>
                                        <option value="after">Read After Prayer</option>
                                        <option value="before">Read Before Prayer</option>
                                        <option value="split">Split Before & After</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between border-t border-[var(--plr-bone-dark)] pt-4">
                                    <div className="flex flex-col">
                                        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Intention Prompts</h3>
                                        <p className="font-body text-[0.8rem] text-[var(--plr-ink-mid)]">Show a mindfulness prompt before reading.</p>
                                    </div>
                                    <button className={`relative h-6 w-11 cursor-pointer rounded-full border-none transition-colors ${
                                        useAppStore.getState().intentionPromptEnabled ? 'bg-[var(--plr-teal)]' : 'bg-[var(--plr-bone-dark)]'
                                    }`} onClick={() => useAppStore.getState().toggleIntentionPrompt()}>
                                        <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                                            useAppStore.getState().intentionPromptEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                            </div>

                            <button className="w-full cursor-pointer rounded-xl border border-[var(--plr-bone-dark)] bg-[var(--plr-bone)] p-3 font-body font-medium text-[var(--plr-ink)] transition-colors hover:bg-[var(--plr-bone-dark)]" onClick={() => setShowSettings(false)}>Done</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ActiveViewWrapper({ planner, onDelete, onBack, setPlannerAssignmentProgress, togglePlannerDayComplete }) {
    return (
        <div style={{ position: 'relative' }}>
            <button className="absolute left-5 top-6 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(250,247,240,0.7)] text-[var(--plr-teal)] shadow-[0_2px_10px_rgba(43,63,60,0.1)] backdrop-blur-md transition-all duration-200 hover:bg-[rgba(250,247,240,0.95)] hover:-translate-x-0.5" onClick={onBack} aria-label="Back to intention">
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
        const existing = (planners || []).find(p => p.title && built.title && p.title === built.title);
        if (existing) {
            if (!window.confirm(`You already have a "${built.title}" plan. Replace it with a new one?`)) {
                return;
            }
            deletePlanner(existing.id);
        }
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
                    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(43,63,60,0.45)] p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setConfirmDelete(false)}>
                        <motion.div className="w-full max-w-[360px] rounded-[18px] bg-[var(--plr-cream)] p-8 shadow-[0_24px_60px_rgba(43,63,60,0.22)]" initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 16 }} onClick={e => e.stopPropagation()}>
                            <h3 className="mb-3 font-ui text-[1.4rem] font-semibold text-[var(--plr-ink)]">Delete this plan?</h3>
                            <p className="mb-7 font-body text-[0.9rem] leading-[1.6] text-[var(--plr-ink-mid)]">All progress will be permanently lost. This cannot be undone.</p>
                            <div className="flex gap-3">
                                <button className="flex-1 cursor-pointer rounded-[30px] border-[1.5px] border-[var(--plr-bone-dark)] bg-transparent p-[0.85rem] font-body text-[0.9rem] text-[var(--plr-ink-mid)] transition-all duration-200 hover:bg-[var(--plr-bone)]" onClick={() => setConfirmDelete(false)}>Cancel</button>
                                <button className="flex-1 cursor-pointer rounded-[30px] border-none bg-[#c0392b] p-[0.85rem] font-body text-[0.9rem] font-semibold text-white transition-all duration-200 hover:bg-[#a93226]" onClick={handleDelete}>Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
