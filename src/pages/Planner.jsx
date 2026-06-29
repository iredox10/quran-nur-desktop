import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

    adjustPlannerPace,
    getDifficultyIndicators,
    PLAN_TEMPLATES,
    buildRevisionPlanner,
    getPlannerAnalytics,
    getWeeklySummary
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

            {/* Plan Templates Library */}
            <div className="mx-auto w-full max-w-[520px] px-5 pt-8 md:max-w-[860px] md:px-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-ui text-[1.2rem] font-semibold tracking-tight text-[var(--plr-ink)]">Plan Templates</h2>
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-[var(--plr-ink-muted)]">Curated paths</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {PLAN_TEMPLATES.map((tmpl) => (
                        <div key={tmpl.id} className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border-[1.5px] border-[var(--plr-bone-dark)] bg-[var(--plr-cream)] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--plr-teal)] hover:shadow-[0_8px_24px_rgba(46,79,74,0.08)]"
                            onClick={() => {
                                setUnitType(tmpl.unitType);
                                setCustomTitle(tmpl.title);
                                setStartPage(tmpl.startUnit);
                                setEndPage(tmpl.endUnit);
                                setPagesPerDay(tmpl.recommendedPace);
                                setShowCustom(true);
                            }}>
                            <div className="absolute -right-4 -top-4 opacity-[0.03] transition-opacity duration-300 group-hover:opacity-[0.08]">
                                <BookIcon size={80} />
                            </div>
                            <h3 className="relative z-10 mb-1 font-ui text-[1.05rem] font-semibold text-[var(--plr-ink)]">{tmpl.title}</h3>
                            <p className="relative z-10 mb-4 font-body text-[0.82rem] leading-relaxed text-[var(--plr-ink-mid)]">{tmpl.description}</p>
                            <div className="relative z-10 mt-auto flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {tmpl.tags && tmpl.tags.length > 0 && (
                                        <span className="rounded-md bg-[rgba(46,79,74,0.08)] px-2 py-1 font-mono text-[0.65rem] font-medium tracking-[0.05em] text-[var(--plr-teal)]">{tmpl.tags[0]}</span>
                                    )}
                                </div>
                                <span className="font-mono text-[0.65rem] text-[var(--plr-ink-muted)]">
                                    {tmpl.recommendedPace} {PLANNER_UNITS[tmpl.unitType]?.plural || 'units'}/day
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
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
    const activePrayers = (prayerSettings?.activePrayers || PRAYER_NAMES).slice().sort((a, b) => PRAYER_NAMES.indexOf(a) - PRAYER_NAMES.indexOf(b));
    const pref = prayerSettings?.readPreference || 'after';
    
    if (!todayAssignment) return activePrayers.map(name => ({ name, time: null, count: 0, doneInSlot: 0, completedUpTo: 0, slotStart: 0, slotRoute: null, status: 'upcoming' }));
    
    const progress = getAssignmentProgress(planner, todayAssignment);
    const { completedRangeValues } = progress;
    const items = todayAssignment.items;
    const total = items.length;
    
    const numSlots = activePrayers.length || 1;
    
    const slots = activePrayers.map((name, i) => {
        const slotEnd = Math.ceil(((i + 1) / numSlots) * total);
        const slotStart = Math.ceil((i / numSlots) * total);
        const slotItems = items.slice(slotStart, slotEnd);
        const count = Math.max(slotEnd - slotStart, 0);
        const doneInSlot = slotItems.filter(item => completedRangeValues.includes(item.rangeValue)).length;
        const isComplete = count > 0 && doneInSlot >= count;
        const isCurrent = count > 0 && !isComplete && doneInSlot > 0;
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

        return { name, time: timeLabel, count, doneInSlot, completedUpTo: slotEnd, slotStartCount: slotStart, slotRoute, status: count === 0 ? 'empty' : isComplete ? 'completed' : isCurrent ? 'current' : 'upcoming' };
    });
    const firstIncomplete = slots.findIndex(s => s.status !== 'completed' && s.status !== 'empty');
    if (firstIncomplete !== -1 && slots[firstIncomplete].status === 'upcoming') {
        slots[firstIncomplete] = { ...slots[firstIncomplete], status: 'current' };
    }
    return slots;
}

function ActiveView({ planner, planners, activePlannerId, onSwitchPlan, onDelete, setPlannerAssignmentProgress, togglePlannerDayComplete, chapters, onBack }) {
    const { prayerTimes, setPrayerTimes, location, setLocation, shiftPlannerSchedule, setPlanner, prayerSettings, plannerReflections, plannerBookmarks, rebalanceActivePlanner } = useAppStore();
    const overview = useMemo(() => getPlannerOverview(planner), [planner]);
    const metrics = useMemo(() => getPlannerSuccessMetrics(planner), [planner]);
    const difficulty = useMemo(() => getDifficultyIndicators(planner?.assignments), [planner]) || {};
    const analytics = useMemo(() => getPlannerAnalytics(planner), [planner]);
    const weeklySummary = useMemo(() => getWeeklySummary(planner), [planner]);
    const today = formatPlannerDate(new Date());

    const [showAdjustPace, setShowAdjustPace] = useState(false);
    const [newDuration, setNewDuration] = useState(planner.durationDays);
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('today');
    const [selectedDay, setSelectedDay] = useState(null);
    const [showRebalanceModal, setShowRebalanceModal] = useState(false);
    const [hasCheckedRebalance, setHasCheckedRebalance] = useState(false);

    useEffect(() => {
        if (!hasCheckedRebalance && overview?.firstIncomplete) {
            const firstIncompleteDate = overview.firstIncomplete.date;
            if (firstIncompleteDate < today) {
                setShowRebalanceModal(true);
            }
            setHasCheckedRebalance(true);
        }
    }, [overview, today, hasCheckedRebalance]);

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
    const nextReadRoute = overview?.firstIncomplete 
        ? `/planner/read/${overview.firstIncomplete.dayNumber}`
        : null;

    const todayDone = todayProgress?.readPagesCount ?? 0;
    const todayTotal = todayProgress?.totalPagesCount ?? 1;
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

    const handleShareProgress = async () => {
        if (!navigator.share) {
            alert('Sharing is not supported on this device/browser.');
            return;
        }
        try {
            await navigator.share({
                title: 'My Quran Reading Plan',
                text: `I've completed ${completedDays} days of my ${planner.durationDays}-day Quran reading plan on the Quran App! I'm currently on Day ${currentDay}.`,
                url: window.location.href,
            });
        } catch (e) {
            console.error('Share failed', e);
        }
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

    const planDone = overview?.isFinishedWindow && !nextAssignment;
    const ctaRoute = todayComplete ? (nextReadRoute || resumeRoute) : (resumeRoute || nextReadRoute);
    const ctaLabel = planDone
        ? 'Plan Complete ✓'
        : todayComplete && nextAssignment
            ? `Continue to Day ${nextAssignment.dayNumber}`
            : todayComplete ? 'All Caught Up'
                : hasStartedReading ? 'Resume Reading' : 'Open Al-Quran';

    return (
        <div className="relative min-h-dvh overflow-hidden font-body text-[var(--text-primary)]">
            <div className="pointer-events-none absolute inset-0 z-0" style={{
                background: `
                    radial-gradient(ellipse 80% 55% at 50% -10%, var(--accent-light) 0%, transparent 70%),
                    radial-gradient(ellipse 90% 60% at 80% 20%, rgba(198,168,124,0.1) 0%, transparent 60%)
                `
            }} aria-hidden="true" />
            <motion.div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col items-center px-5 pt-10 pb-24 md:px-8 md:pb-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                
                {/* --- GLOBAL HEADER (Always Visible) --- */}
                <div className="w-full max-w-[480px] md:max-w-[800px] mb-8">
                    <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
                        <div className="flex items-start gap-3 md:gap-4">
                            <button 
                                className="flex shrink-0 h-[42px] w-[42px] mt-1 cursor-pointer items-center justify-center rounded-full border border-[var(--plr-bone-dark)] bg-white/60 text-[var(--plr-teal)] shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:-translate-x-0.5" 
                                onClick={onBack} 
                                aria-label="Back to intention"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"/>
                                </svg>
                            </button>
                            <div className="text-left">
                            {planners && planners.length > 1 ? (
                                <div className="mb-2 relative inline-block">
                                    <select 
                                        value={activePlannerId || ''} 
                                        onChange={(e) => onSwitchPlan(e.target.value)}
                                        className="appearance-none bg-transparent border-none font-ui text-[clamp(1.6rem,5vw,2rem)] font-semibold tracking-tight text-[var(--text-primary)] pr-8 cursor-pointer outline-none md:text-left"
                                    >
                                        {planners.map(p => (
                                            <option key={p.id} value={p.id}>{p.title || `${p.durationDays} Day Plan`}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-primary)]">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            ) : (
                                <h1 className="mb-2 font-ui text-[clamp(1.7rem,5vw,2.2rem)] font-semibold tracking-tight text-[var(--text-primary)]">{planner.title || 'Quran Plan'}</h1>
                            )}
                            <div className="font-ui text-[1.1rem] font-medium text-[var(--accent-primary)] mb-1">Day {currentDay} of {planner.durationDays}</div>
                            <p className="font-body text-[0.9rem] text-[var(--text-secondary)]">{daySubtitle}</p>
                            </div>
                        </div>
                        
                        <div className="mt-4 md:mt-0 md:min-w-[200px]">
                            {planDone ? (
                                <button 
                                    className="w-full cursor-pointer rounded-full border-none bg-[var(--accent-primary)] p-[0.9rem] font-ui text-[1rem] font-semibold tracking-[0.02em] text-white shadow-md transition-all duration-200 hover:bg-[var(--accent-hover)]"
                                    onClick={() => {
                                        const rev = buildRevisionPlanner(planner, chapters); 
                                        if(rev) {
                                            const s = useAppStore.getState();
                                            s.setPlanner(rev);
                                        }
                                    }}
                                >
                                    Start Revision Plan
                                </button>
                            ) : !ctaRoute ? (
                                <button className="w-full cursor-pointer rounded-full border-none bg-[var(--bg-surface)] p-[0.9rem] font-ui text-[1rem] font-semibold tracking-[0.02em] text-[var(--text-muted)] shadow-sm disabled:opacity-70" disabled>{ctaLabel}</button>
                            ) : (
                                <Link to={ctaRoute} className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent-primary)] p-[0.9rem] font-ui text-[1rem] font-semibold tracking-[0.02em] text-white no-underline shadow-md transition-all duration-200 hover:bg-[var(--accent-hover)]">{ctaLabel}</Link>
                            )}
                        </div>
                    </div>

                    {/* Stats Header Cards */}
                    <div className="flex w-full gap-[0.7rem] md:gap-4">
                        {[
                            { label: 'Overall', val: `${overallPct}%`, icon: <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
                            { label: 'Finish by', val: completionDate, icon: <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
                            { label: 'Streak', val: `${streakDays} Day${streakDays !== 1 ? 's' : ''}`, icon: <svg className="h-4 w-4 opacity-50 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 7 9a8 8 0 0110.657 9.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 11a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
                        ].map(s => (
                            <div key={s.label} className="relative overflow-hidden flex flex-1 flex-col gap-[0.3rem] rounded-[16px] bg-[rgba(255,255,255,0.03)] p-3.5 md:p-5 border border-white/5 shadow-lg backdrop-blur-xl group transition-all duration-300 hover:bg-[rgba(255,255,255,0.06)] hover:-translate-y-0.5">
                                <div className="absolute -inset-px rounded-[16px] bg-gradient-to-b from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                <div className="absolute top-0 right-0 p-3 opacity-20 transition-opacity group-hover:opacity-100">{s.icon}</div>
                                <span className="relative z-10 font-mono text-[0.65rem] md:text-[0.75rem] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">{s.label}</span>
                                <span className="relative z-10 font-ui text-[1.4rem] md:text-[1.6rem] font-bold text-[var(--text-primary)] tracking-tight">{s.val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- TAB NAVIGATION --- */}
                <div className="relative flex w-full max-w-[480px] md:max-w-[800px] mb-10 p-[6px] bg-[var(--h-cream)] rounded-[20px] shadow-sm border-[1.5px] border-[var(--h-bone-dark)]">
                    {[ {id: 'today', label: 'Today'}, {id: 'progress', label: 'Progress'}, {id: 'journal', label: 'Journal'} ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`relative flex-1 py-2.5 md:py-3 px-4 rounded-[14px] font-ui text-[1rem] md:text-[1.05rem] font-semibold transition-colors duration-300 z-10 border-none bg-transparent cursor-pointer ${
                                    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}>
                                {isActive && (
                                    <motion.div layoutId="activeTab" className="absolute inset-0 bg-[var(--bg-primary)] rounded-[14px] shadow-sm border border-[var(--border-color)] z-[-1]" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
                                )}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* --- TAB CONTENTS --- */}
                <div className="w-full max-w-[480px] md:max-w-[800px]">
                    {/* --- DASHBOARD TAB (Merged Today + Journey) --- */}
                    {activeTab === 'today' && (
                        <div className="flex flex-col gap-10">
                            {/* Top Section: Daily Focus */}
                            <div className="flex flex-col md:flex-row gap-10">
                                <div className="flex-1 flex justify-center md:justify-start items-center relative">
                                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none blur-[60px] opacity-20 bg-[var(--accent-primary)] rounded-full w-[220px] h-[220px] mx-auto md:mx-0" />
                                    <div className="relative drop-shadow-[0_0_20px_rgba(198,168,124,0.3)]">
                                        <RingProgress percent={todayPct} size={240} stroke={12} color="var(--accent-primary)" emptyColor="rgba(198,168,124,0.1)">
                                            <span className="font-ui text-[3.5rem] font-bold tracking-tighter text-[var(--accent-primary)] drop-shadow-sm">{todayPct}%</span>
                                            <span className="font-mono text-[0.65rem] font-medium tracking-[0.15em] text-[var(--text-secondary)] mt-2 uppercase">{ringLabel}</span>
                                        </RingProgress>
                                    </div>
                                </div>

                                <div className="flex-1 w-full">
                                    <div className="mb-5 flex items-center justify-between">
                                        <h2 className="font-ui text-[1.5rem] font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                                            <span className="w-2 h-6 rounded-full bg-[var(--accent-primary)] inline-block shadow-[0_0_8px_var(--accent-primary)]" />
                                            Daily Ritual
                                        </h2>
                                        <div className="flex gap-2">
                                            {navigator.share && (
                                                <button onClick={handleShareProgress} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] text-[var(--text-secondary)] hover:bg-[var(--h-bone)] hover:text-[var(--text-primary)] transition-colors" title="Share Progress">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                                    </svg>
                                                </button>
                                            )}
                                            <button onClick={() => setShowSettings(true)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] text-[var(--text-secondary)] hover:bg-[var(--h-bone)] hover:text-[var(--text-primary)] transition-colors" title="Settings">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-[0.8rem]">
                                        {prayerSlots.map((slot, i) => {
                                            const isCurrent = slot.status === 'current';
                                            const isCompleted = slot.status === 'completed';
                                            const isUpcoming = slot.status === 'upcoming';
                                            const isEmpty = slot.status === 'empty';
                                            return (
                                            <motion.div key={slot.name}
                                                className={`relative overflow-hidden flex items-center gap-[0.85rem] rounded-[18px] px-4 py-4 shadow-sm transition-all duration-300 ${
                                                    isCurrent
                                                        ? 'bg-[var(--bg-surface)] border border-[var(--accent-primary)] shadow-[0_8px_30px_rgba(198,168,124,0.25)] scale-[1.02]'
                                                        : isCompleted
                                                            ? 'bg-[rgba(16,185,129,0.03)] border border-[#10b981]/20 opacity-80 scale-95 py-2.5'
                                                            : isEmpty
                                                                ? 'bg-[rgba(250,247,240,0.5)] border-[1.5px] border-[var(--h-bone-dark)] opacity-70 scale-95 py-2.5'
                                                                : 'bg-[var(--h-white)] border-[1.5px] border-[var(--h-bone-dark)]'
                                                }`}
                                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.05 * i, duration: 0.4, type: 'spring', bounce: 0.3 }}
                                            >
                                                {isCurrent && (
                                                    <div className="absolute inset-0 pointer-events-none border-[2px] border-[var(--accent-primary)] rounded-[18px] opacity-30 animate-pulse" />
                                                )}
                                                <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-colors duration-200 text-white ${
                                                    isCompleted ? 'bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.4)]' : isCurrent ? 'bg-[var(--accent-primary)] shadow-[0_0_15px_rgba(198,168,124,0.5)]' : isEmpty ? 'bg-transparent border border-[var(--h-bone-dark)] text-[var(--text-muted)] opacity-50' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                                                }`}>
                                                    {isCompleted && <CheckIcon size={20} />}
                                                    {isCurrent && <BookIcon />}
                                                    {isUpcoming && <ClockIcon />}
                                                    {isEmpty && <div className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />}
                                                </div>
                                                <div className="flex min-w-0 flex-1 flex-col gap-[0.25rem]">
                                                    <span className={`font-ui text-[1.1rem] font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2 ${isCompleted ? 'line-through opacity-50' : ''}`}>
                                                        {slot.name}
                                                        {slot.time && <span className="text-[0.7rem] font-mono text-[var(--text-secondary)] bg-[var(--h-bone)] border-[1.5px] border-[var(--h-bone-dark)] px-1.5 py-0.5 rounded-[6px] no-underline opacity-90 inline-block">{slot.time}</span>}
                                                    </span>
                                                    <span className={`font-mono text-[0.75rem] uppercase tracking-[0.05em] font-medium leading-[1.3] ${isCurrent ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                                                        {isCompleted && `${slot.doneInSlot}/${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} ✓`}
                                                        {isCurrent && `${slot.doneInSlot} of ${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} read`}
                                                        {isUpcoming && `${slot.count} ${PLANNER_UNITS[planner.unitType]?.plural} · pending`}
                                                        {isEmpty && `No reading required`}
                                                    </span>
                                                </div>
                                                <div className="shrink-0 z-10">
                                                    {isCompleted && (
                                                        <button className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-[#10b981]/30 bg-[rgba(16,185,129,0.12)] text-[#10b981] transition-all duration-[0.18s] hover:scale-110 hover:bg-[rgba(220,38,38,0.1)] hover:border-red-500/30 hover:text-[#dc2626]"
                                                            onClick={() => handleUndoPrayer(slot)} title="Undo this prayer">
                                                            <CheckIcon size={16} />
                                                        </button>
                                                    )}
                                                    {isCurrent && slot.slotRoute && (
                                                        <Link to={hasStartedReading ? (resumeRoute || slot.slotRoute) : slot.slotRoute}
                                                            className="inline-flex cursor-pointer items-center rounded-full border-none bg-[var(--accent-primary)] px-[20px] py-[10px] font-ui text-[0.95rem] font-bold text-white no-underline transition-all duration-200 hover:bg-[var(--accent-hover)] hover:shadow-lg hover:-translate-y-0.5">
                                                            {hasStartedReading ? 'Resume' : 'Start'}
                                                        </Link>
                                                    )}
                                                    {isUpcoming && (
                                                        <button className="flex h-[32px] w-[32px] items-center justify-center cursor-pointer border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] hover:bg-[var(--h-bone)] transition-colors rounded-full" onClick={() => handleMarkPrayer(slot)} title="Mark done">
                                                            <div className="h-3 w-3 rounded-full border-[1.5px] border-[var(--text-muted)]" />
                                                        </button>
                                                    )}
                                                    {isEmpty && (
                                                        <div className="flex h-[32px] w-[32px] items-center justify-center">
                                                            <span className="text-[1.5rem] font-light text-[var(--text-muted)] opacity-30">-</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* --- PROGRESS TAB --- */}
                    {activeTab === 'progress' && (
                        <div className="flex flex-col gap-10">
                                <div className="flex flex-col mb-2">
                                    <div className="mb-4 flex items-baseline justify-between px-2">
                                        <h2 className="font-ui text-[1.4rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                            <span className="w-1.5 h-5 rounded-full bg-[var(--text-muted)] inline-block" />
                                            Timeline
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-[0.7rem] uppercase tracking-[0.05em] text-[var(--text-muted)] hidden md:inline-block">({completedDays}/{planner.durationDays} done)</span>
                                            <button onClick={() => setShowRebalanceModal(true)} className="cursor-pointer border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--h-bone)] shadow-sm transition-all duration-200 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Rebalance</button>
                                            <button onClick={() => setShowAdjustPace(true)} className="cursor-pointer border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--h-bone)] shadow-sm transition-all duration-200 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg> Adjust</button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-[8px] rounded-[24px] border border-white/5 bg-[rgba(255,255,255,0.02)] p-6 shadow-inner backdrop-blur-xl md:gap-[10px]">
                                        {planner.assignments.map(a => {
                                            const status = getAssignmentStatus(planner, a, today);
                                            const progress = getAssignmentProgress(planner, a);
                                            const isToday = a.date === today;
                                            const pct = progress.totalPagesCount ? Math.round((progress.readPagesCount / progress.totalPagesCount) * 100) : 0;
                                            const statusStyles = {
                                                completed: 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-hover)] text-white shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),_0_2px_8px_rgba(198,168,124,0.4)] border-none',
                                                today: 'bg-[var(--bg-primary)] text-[var(--accent-primary)] border-[2px] border-[var(--accent-primary)] shadow-[0_0_15px_rgba(198,168,124,0.25)]',
                                                partial: 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[1.5px] border-dashed border-[var(--accent-primary)]',
                                                overdue: 'bg-gradient-to-br from-red-500/10 to-red-600/5 text-[#dc2626] border border-red-500/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]',
                                                upcoming: 'bg-[var(--h-white)] border-[1.5px] border-[var(--h-bone-dark)] text-[var(--text-muted)]',
                                            };
                                            return (
                                                <motion.div key={a.dayNumber}
                                                    onClick={() => setSelectedDay(selectedDay?.dayNumber === a.dayNumber ? null : a)}
                                                    className={`relative flex h-[36px] w-[36px] cursor-pointer flex-col items-center justify-center rounded-full transition-all duration-200 md:h-[42px] md:w-[42px] overflow-hidden ${
                                                        selectedDay?.dayNumber === a.dayNumber ? 'ring-[2.5px] ring-[var(--text-primary)] ring-offset-2 ring-offset-[#fdfbf6] ' : ''
                                                    }${statusStyles[status] || statusStyles.upcoming}`}
                                                    title={`Day ${a.dayNumber}: ${a.title} — ${status === 'completed' ? '✓ Done' : status === 'today' || status === 'partial' ? `${pct}%` : status}`}
                                                    whileHover={{ scale: 1.15, y: -2 }} whileTap={{ scale: 0.9 }}>
                                                    <span className={`relative z-10 font-mono text-[0.6rem] font-bold ${status === 'completed' ? 'text-white/90' : ''}`}>{a.dayNumber}</span>
                                                    {difficulty[a.dayNumber] && difficulty[a.dayNumber].level !== 'moderate' && (
                                                        <span className={`absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--bg-primary)] shadow-sm ${
                                                            difficulty[a.dayNumber].level === 'heavy' ? 'bg-[#dc2626]' : 'bg-[#10b981]'
                                                        }`} title={difficulty[a.dayNumber].level === 'heavy' ? 'Heavier reading day' : 'Lighter reading day'} />
                                                    )}
                                                    {status === 'completed' && (
                                                        <svg className="absolute bottom-[2px] right-[2px] text-white opacity-100 drop-shadow-md" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"/>
                                                        </svg>
                                                    )}
                                                    {status !== 'completed' && pct > 0 && (
                                                        <div className="pointer-events-none absolute inset-0 rounded-full opacity-20" style={{ background: `conic-gradient(var(--accent-primary) ${pct}%, transparent ${pct}%)` }} />
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 flex flex-wrap justify-center gap-4">
                                        {[
                                            { label: 'Done', color: 'var(--accent-primary)' },
                                            { label: 'Today', color: 'var(--accent-hover)' },
                                            { label: 'Partial', color: 'var(--text-primary)' },
                                            { label: 'Missed', color: '#dc2626' },
                                            { label: 'Upcoming', color: 'var(--text-muted)' },
                                        ].map(item => (
                                            <span key={item.label} className="flex items-center gap-1 font-mono text-[0.6rem] tracking-[0.04em] text-[var(--text-muted)]">
                                                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>
                                    <AnimatePresence>
                                        {selectedDay && (() => {
                                            const sStatus = getAssignmentStatus(planner, selectedDay, today);
                                            const sProg = getAssignmentProgress(planner, selectedDay);
                                            const sPct = sProg.totalPagesCount ? Math.round((sProg.readPagesCount / sProg.totalPagesCount) * 100) : 0;
                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-4 flex flex-col items-center overflow-hidden"
                                                >
                                                    <div className="rounded-2xl bg-[var(--h-cream)] border-[1.5px] border-[var(--h-bone-dark)] px-5 py-3 shadow-sm w-full max-w-sm text-center">
                                                        <h4 className="font-ui text-[1rem] font-bold text-[var(--text-primary)] mb-1">Day {selectedDay.dayNumber}: {selectedDay.title}</h4>
                                                        <p className="font-mono text-[0.75rem] text-[var(--text-muted)] tracking-wide">
                                                            {sStatus === 'completed' ? '✓ Completed' : sStatus === 'today' ? `Today's plan (${sPct}%)` : sStatus === 'partial' ? `Partially finished (${sPct}%)` : sStatus === 'overdue' ? 'Missed completely' : 'Upcoming'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })()}
                                    </AnimatePresence>
                                </div>
                                <div className="flex flex-col rounded-[24px] bg-[rgba(255,255,255,0.02)] border border-white/5 p-6 shadow-inner backdrop-blur-xl">
                                    <h3 className="mb-5 font-ui text-[1.25rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                        Performance Insights
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-3 mb-2">
                                        <div className="group flex flex-col gap-1 bg-[var(--h-cream)] border-[1.5px] border-[var(--h-bone-dark)] p-4 rounded-[18px] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-[#10b981]/30">
                                            <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">On-Time Completion</span>
                                            <span className="font-ui text-[1.8rem] font-bold text-[#10b981] tracking-tight">{analytics.onTimeRate}%</span>
                                        </div>
                                        <div className="group flex flex-col gap-1 bg-[var(--h-cream)] border-[1.5px] border-[var(--h-bone-dark)] p-4 rounded-[18px] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--h-teal)]">
                                            <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">Catch-ups Used</span>
                                            <span className="font-ui text-[1.8rem] font-bold text-[var(--accent-primary)] tracking-tight">{analytics.catchUpDaysCount}</span>
                                        </div>
                                        <div className="group flex flex-col gap-1 bg-[var(--h-cream)] border-[1.5px] border-[var(--h-bone-dark)] p-4 rounded-[18px] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--h-teal)]">
                                            <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">Current Pace</span>
                                            <span className="font-ui text-[1.8rem] font-bold text-[var(--text-primary)] tracking-tight">{Math.round(analytics.avgUnitsPerDay)} <span className="text-[1rem] text-[var(--text-muted)] font-medium">u/day</span></span>
                                        </div>
                                    </div>
                                </div>

                                
                                {weeklySummary && weeklySummary.length > 0 && (
                                    <div className="flex flex-col rounded-[24px] bg-[rgba(255,255,255,0.02)] border border-white/5 p-6 shadow-inner backdrop-blur-xl">
                                        <h4 className="mb-5 font-ui text-[1.25rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            Weekly Progress
                                        </h4>
                                        <div className="flex flex-col gap-3">
                                            {weeklySummary.slice(-4).map((week, i) => {
                                                const pct = Math.min(100, Math.round((week.completedUnits / week.totalUnits) * 100));
                                                const isComplete = pct === 100;
                                                return (
                                                <div key={i} className="group flex items-center justify-between bg-[var(--h-cream)] border-[1.5px] border-[var(--h-bone-dark)] px-5 py-4 rounded-[16px] shadow-sm transition-colors hover:border-[var(--h-teal)]">
                                                    <span className="font-ui text-[0.95rem] font-bold text-[var(--text-primary)]">{week.label}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className={`font-mono text-[0.75rem] font-medium ${isComplete ? 'text-[#10b981]' : 'text-[var(--text-secondary)]'}`}>{week.completedUnits} / {week.totalUnits}</span>
                                                        <div className="w-[120px] h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden shadow-inner">
                                                            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isComplete ? 'bg-[#10b981] shadow-[0_0_10px_#10b981]' : 'bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent-primary)]'}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {overview?.overdueDays > 0 && (
                                    <div className="mt-2 flex flex-col gap-4 rounded-[24px] bg-gradient-to-b from-[rgba(220,38,38,0.05)] to-[rgba(220,38,38,0.02)] border border-red-500/20 p-6 shadow-inner relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500 pointer-events-none">
                                            <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        </div>
                                        <div>
                                            <h4 className="font-ui text-[1.25rem] font-bold text-[#dc2626] flex items-center gap-2 relative z-10">
                                                <span className="flex h-2.5 w-2.5 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                </span>
                                                Action Required
                                            </h4>
                                            <p className="font-body text-[0.9rem] text-[var(--text-secondary)] mt-1 mb-0 relative z-10">You have fallen {overview.overdueDays} day{overview.overdueDays > 1 ? 's' : ''} behind schedule.</p>
                                        </div>
                                        <div className="flex flex-col gap-2 relative z-10">
                                            <button onClick={() => rebalanceActivePlanner('extend')} className="w-full cursor-pointer rounded-xl border border-red-500/30 bg-[rgba(255,255,255,0.02)] backdrop-blur-md p-[1rem] font-ui text-[0.95rem] font-bold text-[#dc2626] shadow-sm transition-all duration-300 hover:bg-[rgba(220,38,38,0.08)] hover:-translate-y-0.5 flex justify-between items-center">
                                                Shift Deadlines (Extend Plan)
                                                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                            </button>
                                            <button onClick={() => rebalanceActivePlanner('spread')} className="w-full cursor-pointer rounded-xl border-none bg-[rgba(220,38,38,0.12)] p-[1rem] font-ui text-[0.95rem] font-bold text-[#dc2626] shadow-none transition-all duration-300 hover:bg-[rgba(220,38,38,0.18)] hover:-translate-y-0.5 flex justify-between items-center" title="Keep the same end date, distribute missed reading across remaining days">
                                                Redistribute Missed Pages
                                                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                    )}

                    {/* --- JOURNAL TAB --- */}
                    {activeTab === 'journal' && (
                        <div className="flex flex-col gap-10">
                            {/* Reflections Section */}
                            <div className="flex flex-col rounded-[24px] bg-[rgba(255,255,255,0.02)] border border-white/5 p-6 shadow-inner backdrop-blur-xl">
                                <div className="mb-5 flex items-baseline justify-between px-2">
                                    <h3 className="font-ui text-[1.4rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <span className="w-1.5 h-5 rounded-full bg-[var(--accent-primary)] inline-block" />
                                        Daily Reflections
                                    </h3>
                                </div>
                                <div className="flex flex-col gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                                    {plannerReflections && plannerReflections[planner.id] && Object.keys(plannerReflections[planner.id]).length > 0 ? (
                                        Object.entries(plannerReflections[planner.id])
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([dayId, ref]) => (
                                                <div key={dayId} className="group relative rounded-[20px] bg-[var(--h-cream)] p-5 shadow-sm border-[1.5px] border-[var(--h-bone-dark)] transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                                                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                                                    </div>
                                                    <div className="flex items-center gap-3 mb-3 relative z-10">
                                                        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] font-mono text-[0.65rem] font-bold">{dayId}</span>
                                                        <span className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-[var(--text-muted)]">Reflection</span>
                                                    </div>
                                                    <p className="font-body text-[0.95rem] text-[var(--text-primary)] m-0 leading-relaxed relative z-10">"{ref.text}"</p>
                                                </div>
                                            ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center border-[2px] border-dashed border-[var(--h-bone-dark)] rounded-[20px]">
                                            <BookIcon />
                                            <p className="mt-3 text-[var(--text-muted)] font-body text-[0.9rem] max-w-[200px]">No reflections yet. Complete a day to write one!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bookmarks / Highlights Section */}
                            <div className="flex flex-col rounded-[24px] bg-[rgba(255,255,255,0.02)] border border-white/5 p-6 shadow-inner backdrop-blur-xl">
                                <div className="mb-5 flex items-baseline justify-between px-2">
                                    <h3 className="font-ui text-[1.4rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <span className="w-1.5 h-5 rounded-full bg-[var(--accent-hover)] inline-block" />
                                        Plan Highlights
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {plannerBookmarks && plannerBookmarks[planner.id] && plannerBookmarks[planner.id].length > 0 ? (
                                        plannerBookmarks[planner.id]
                                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                            .map(b => (
                                                <Link key={b.verseKey} to={`/surah/${b.verseKey.split(':')[0]}?ayah=${b.verseKey.split(':')[1]}`} className="group flex flex-col justify-between rounded-[16px] bg-[var(--h-cream)] p-4 shadow-sm border-[1.5px] border-[var(--h-bone-dark)] no-underline transition-all duration-300 hover:border-[var(--h-teal)] hover:shadow-md hover:-translate-y-0.5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-ui text-[1.05rem] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-hover)] transition-colors">{b.surahName}</span>
                                                        <GemIcon className="text-[var(--accent-hover)] opacity-50 group-hover:opacity-100 transition-opacity w-4 h-4" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[0.7rem] bg-[rgba(198,168,124,0.1)] text-[var(--accent-primary)] px-2.5 py-1 rounded-[6px]">{b.verseKey}</span>
                                                        <span className="font-body text-[0.7rem] text-[var(--text-muted)] truncate flex-1">Tap to read verse →</span>
                                                    </div>
                                                </Link>
                                            ))
                                    ) : (
                                        <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-12 text-center border-[2px] border-dashed border-[var(--h-bone-dark)] rounded-[20px]">
                                            <GemIcon className="text-[var(--text-muted)] opacity-50 w-6 h-6" />
                                            <p className="mt-3 text-[var(--text-muted)] font-body text-[0.9rem] max-w-[200px]">No highlighted verses. Use the bookmark icon while reading!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="mt-12 mb-4 w-full flex justify-center">
                    <button className="group inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-5 py-2.5 font-body text-[0.85rem] text-[var(--text-muted)] shadow-sm transition-all duration-300 hover:border-red-500/30 hover:bg-[rgba(220,38,38,0.05)] hover:text-[#dc2626] hover:-translate-y-0.5" onClick={onDelete} title="Delete plan">
                        <svg className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Delete plan
                    </button>
                </div>

            </motion.div>

            {/* MODALS */}
            <AnimatePresence>
                {showAdjustPace && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(0,0,0,0.4)] p-0 sm:items-center sm:p-4 backdrop-blur-md"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowAdjustPace(false); }}>
                        <motion.div className="w-full sm:max-w-[400px] rounded-t-[32px] sm:rounded-[24px] bg-[var(--bg-primary)] border border-white/10 p-6 sm:p-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-2xl relative overflow-hidden"
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
                            {/* Glass overlay effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                            
                            <div className="flex items-center justify-center w-full mb-6 sm:hidden">
                                <div className="w-12 h-1.5 bg-[var(--h-bone-dark)] rounded-full" />
                            </div>

                            <div className="relative z-10">
                                <h2 className="mb-2 font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">Adjust Pace</h2>
                                <p className="mb-8 font-body text-[0.95rem] leading-relaxed text-[var(--text-secondary)]">
                                    Change how many days you want to complete your remaining plan in. This will re-calculate your daily assignments.
                                </p>
                                <div className="mb-8 flex flex-col gap-3">
                                    <label className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">New Total Days</label>
                                    <div className="relative group">
                                        <input type="number" min="1" max="1000" className="w-full rounded-[16px] border-[2px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-5 py-4 font-ui text-[1.5rem] font-bold text-[var(--text-primary)] outline-none transition-all duration-300 focus:border-[var(--h-teal)] focus:shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.1)]"
                                            value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 1)} />
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[0.8rem] text-[var(--text-muted)] pointer-events-none">DAYS</div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button className="flex-1 cursor-pointer rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] p-4 font-ui text-[1rem] font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--h-bone)] hover:text-[var(--text-primary)]" onClick={() => setShowAdjustPace(false)}>Cancel</button>
                                    <button className="flex-1 cursor-pointer rounded-[16px] border-none bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent-primary)] p-4 font-ui text-[1rem] font-bold text-white shadow-lg transition-all hover:opacity-90 hover:shadow-[0_5px_20px_rgba(198,168,124,0.3)] hover:-translate-y-0.5" onClick={() => {
                                        const updated = adjustPlannerPace(planner, newDuration);
                                        setPlanner(updated);
                                        setShowAdjustPace(false);
                                    }}>Apply</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSettings && (
                    <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(0,0,0,0.4)] p-0 sm:items-center sm:p-4 backdrop-blur-md"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
                        <motion.div className="w-full sm:max-w-[400px] rounded-t-[32px] sm:rounded-[24px] bg-[var(--bg-primary)] border border-white/10 p-6 sm:p-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-2xl relative overflow-hidden"
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
                            {/* Glass overlay effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                            
                            <div className="flex items-center justify-center w-full mb-6 sm:hidden">
                                <div className="w-12 h-1.5 bg-[var(--h-bone-dark)] rounded-full" />
                            </div>

                            <div className="relative z-10">
                                <h2 className="mb-8 font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">Planner Settings</h2>
                                
                                <div className="flex flex-col gap-6 mb-8">
                                    <div className="flex flex-col gap-3">
                                        <h3 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">Daily Prayers</h3>
                                        <p className="font-body text-[0.85rem] text-[var(--text-secondary)] mb-1">Select which prayers you want to distribute reading across.</p>
                                        <div className="flex flex-wrap gap-2">
                                            {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(p => {
                                                const isActive = useAppStore.getState().prayerSettings?.activePrayers?.includes(p) ?? true;
                                                return (
                                                    <button key={p} className={`cursor-pointer rounded-[12px] border-[1.5px] px-4 py-2 font-ui text-[0.9rem] font-bold transition-all duration-200 hover:-translate-y-0.5 ${
                                                        isActive ? 'border-[var(--h-teal)] bg-[var(--h-teal)] text-white shadow-md' : 'border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] text-[var(--text-muted)] hover:border-[var(--h-teal)] hover:text-[var(--text-primary)]'
                                                    }`} onClick={() => {
                                                        const s = useAppStore.getState();
                                                        const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                                                        const current = s.prayerSettings?.activePrayers || PRAYER_ORDER;
                                                        const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
                                                        if(next.length === 0) return; // Must have at least 1
                                                        const sortedNext = next.sort((a, b) => PRAYER_ORDER.indexOf(a) - PRAYER_ORDER.indexOf(b));
                                                        s.updatePrayerSettings({ activePrayers: sortedNext });
                                                    }}>
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <h3 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">Reading Preference</h3>
                                        <div className="relative">
                                            <select className="w-full appearance-none rounded-[16px] border-[2px] border-[var(--h-bone-dark)] bg-[var(--h-white)] px-4 py-3.5 font-ui text-[1rem] font-medium text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--h-teal)] cursor-pointer"
                                                value={useAppStore.getState().prayerSettings?.readPreference || 'after'}
                                                onChange={e => useAppStore.getState().updatePrayerSettings({ readPreference: e.target.value })}>
                                                <option value="after">Read After Prayer</option>
                                                <option value="before">Read Before Prayer</option>
                                                <option value="split">Split Before & After</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t-[1.5px] border-[var(--h-bone-dark)] pt-5 mt-2">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">Intention Prompts</h3>
                                            <p className="font-body text-[0.85rem] text-[var(--text-secondary)]">Show a mindfulness prompt before reading.</p>
                                        </div>
                                        <button className={`relative h-7 w-12 cursor-pointer rounded-full border-none transition-colors duration-300 ${
                                            useAppStore.getState().intentionPromptEnabled ? 'bg-[#10b981]' : 'bg-[var(--h-white)] border-[2px] border-[var(--h-bone-dark)]'
                                        }`} onClick={() => useAppStore.getState().toggleIntentionPrompt()}>
                                            <div className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                                                useAppStore.getState().intentionPromptEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                        </button>
                                    </div>
                                </div>

                                <button className="w-full cursor-pointer rounded-[16px] border-[1.5px] border-[var(--h-bone-dark)] bg-[var(--h-white)] p-4 font-ui text-[1rem] font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--h-bone)] hover:border-[var(--h-teal)] hover:-translate-y-0.5" onClick={() => setShowSettings(false)}>Done</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showRebalanceModal && (
                    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="w-full max-w-[420px] rounded-[32px] bg-[var(--h-white)] p-6 shadow-xl ring-1 ring-[var(--h-bone)]" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                            <div className="flex flex-col">
                                <div className="mb-6 flex items-center justify-between">
                                    <h2 className="font-ui text-[1.4rem] font-bold text-[var(--text-primary)]">Rebalance Plan</h2>
                                    <button onClick={() => setShowRebalanceModal(false)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--h-bone)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--h-bone-dark)] hover:text-[var(--text-primary)]">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <p className="mb-6 font-body text-[0.95rem] leading-[1.6] text-[var(--text-secondary)]">You missed some pages from past assignments. How would you like to catch up?</p>
                                
                                <div className="flex flex-col gap-4">
                                    <button onClick={() => { rebalanceActivePlanner('extend'); setShowRebalanceModal(false); }} className="group relative flex cursor-pointer flex-col gap-2 rounded-[20px] border-[2px] border-[var(--h-bone)] bg-[var(--h-white)] p-5 text-left transition-all duration-300 hover:border-[var(--h-teal)] hover:bg-[var(--h-bone)] hover:shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-ui text-[1.05rem] font-bold text-[var(--text-primary)]">Extend Plan</span>
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--h-bone-dark)] text-[var(--h-teal)] transition-colors group-hover:bg-[var(--h-teal)] group-hover:text-white">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                            </span>
                                        </div>
                                        <p className="font-body text-[0.85rem] leading-snug text-[var(--text-secondary)]">Keep your daily reading amount exactly the same, but add extra days to the end of your plan.</p>
                                    </button>

                                    <button onClick={() => { rebalanceActivePlanner('spread'); setShowRebalanceModal(false); }} className="group relative flex cursor-pointer flex-col gap-2 rounded-[20px] border-[2px] border-[var(--h-bone)] bg-[var(--h-white)] p-5 text-left transition-all duration-300 hover:border-[var(--h-teal)] hover:bg-[var(--h-bone)] hover:shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-ui text-[1.05rem] font-bold text-[var(--text-primary)]">Spread Pages</span>
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--h-bone-dark)] text-[var(--h-teal)] transition-colors group-hover:bg-[var(--h-teal)] group-hover:text-white">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                            </span>
                                        </div>
                                        <p className="font-body text-[0.85rem] leading-snug text-[var(--text-secondary)]">Keep your original deadline, but evenly distribute the missed pages across your remaining days.</p>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
function ActiveViewWrapper({ planner, planners, activePlannerId, onSwitchPlan, onDelete, onBack, setPlannerAssignmentProgress, togglePlannerDayComplete, chapters }) {
    return (
        <ActiveView
            planner={planner}
            planners={planners}
            activePlannerId={activePlannerId}
            onSwitchPlan={onSwitchPlan}
            onDelete={onDelete}
            onBack={onBack}
            setPlannerAssignmentProgress={setPlannerAssignmentProgress}
            togglePlannerDayComplete={togglePlannerDayComplete}
            chapters={chapters}
        />
    );
}

export default function Planner() {
    const navigate = useNavigate();
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
                            planners={planners}
                            activePlannerId={activePlannerId}
                            onSwitchPlan={(id) => setActivePlanner(id)}
                            onDelete={() => setConfirmDelete(true)}
                            onBack={() => setView('intention')}
                            setPlannerAssignmentProgress={setPlannerAssignmentProgress}
                            togglePlannerDayComplete={togglePlannerDayComplete}
                            chapters={chapters}
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
