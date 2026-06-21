import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

const f = fsrs({});

import {
    DEFAULT_MUSHAF,
    getArabicFontByFamily,
    getArabicFontFamily,
    getCompatibleArabicFontId,
    getMushafById,
} from '../config/mushaf';
import { adjustPlannerPace, rebalancePlanner, redistributeMissedAssignments } from '../utils/planner';

const DEFAULT_ARABIC_FONT_ID = getCompatibleArabicFontId(DEFAULT_MUSHAF.id, DEFAULT_MUSHAF.defaultFontId);
const DEFAULT_ARABIC_FONT_FAMILY = getArabicFontFamily(DEFAULT_ARABIC_FONT_ID);

function updatePlannerCollection(state, updater) {
    const planners = state.planners || [];
    const activePlannerId = state.activePlannerId || planners[0]?.id || null;
    const activePlanner = planners.find((planner) => planner.id === activePlannerId) || null;
    return updater({ planners, activePlannerId, activePlanner });
}

function buildPlannerState(planners, activePlannerId) {
    const nextActivePlannerId = activePlannerId || planners[0]?.id || null;
    const activePlanner = planners.find((planner) => planner.id === nextActivePlannerId) || null;

    return {
        planners,
        activePlannerId: nextActivePlannerId,
        planner: activePlanner,
    };
}

function replaceActivePlanner(state, plannerUpdater) {
    return updatePlannerCollection(state, ({ planners, activePlannerId, activePlanner }) => {
        if (!activePlanner) {
            return {};
        }

        const nextPlanner = plannerUpdater(activePlanner);
        const nextPlanners = planners.map((planner) => planner.id === activePlannerId ? nextPlanner : planner);
        return buildPlannerState(nextPlanners, activePlannerId);
    });
}

const DEFAULT_POMODORO_PROFILES = [
    { id: 'pomodoro-1', name: 'Reading Focus', focusMinutes: 25, breakMinutes: 5 },
    { id: 'pomodoro-2', name: 'Deep Study', focusMinutes: 45, breakMinutes: 10 },
    { id: 'pomodoro-3', name: 'Hifz Sprint', focusMinutes: 15, breakMinutes: 3 },
];

function getActivePomodoroProfile(state) {
    const profiles = state.pomodoroProfiles?.length ? state.pomodoroProfiles : DEFAULT_POMODORO_PROFILES;
    const activeProfileId = state.activePomodoroProfileId || profiles[0]?.id || null;
    const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
    return { profiles, activeProfileId: activeProfile?.id || null, activeProfile };
}

function getPomodoroDurationSeconds(profile, mode) {
    if (!profile) return 0;
    return (mode === 'focus' ? profile.focusMinutes : profile.breakMinutes) * 60;
}

export const useAppStore = create(
    persist(
        (set, get) => ({
            theme: 'light', // 'light' or 'dark'
            translationId: 85, // Default: M.A.S. Abdel Haleem (85)
            reciterId: 7, // Default: Mishary
            fontSize: 2, // 1, 2, 3, 4
            translationFontSize: 2, // 1, 2, 3, 4
            readingMode: false, // false = translation, true = arabic only
            mushafId: DEFAULT_MUSHAF.id,
            arabicFontId: DEFAULT_ARABIC_FONT_ID,
            arabicFont: DEFAULT_ARABIC_FONT_FAMILY,
            tajweedEnabled: false, // Show tajweed color rules
            tafsirId: 169, // Default: Ibn Kathir (Abridged) English
            offlineDataStatus: 'idle', // 'idle', 'syncing', 'completed', 'error'
            downloadedSurahs: [], // Array of chapter IDs with offline audio
            offlinePackStatus: {},

            isSettingsOpen: false, // Global settings state

            bookmark: null, // { verseKey, surahName }
            bookmarks: [], // Array of { verseKey, surahName, chapterId }
            memorizedAyahs: [], // Array of verse keys '1:1'
            memorizedSurahs: [], // Array of chapter IDs
            hifdhHistory: {}, // { [itemId]: { lastReviewed: timestamp, strength: 'strong'|'good'|'weak' } }
            hifdhGoals: [], // Array of { id, targetType, targetId, targetDate, createdAt }
            collections: [], // Array of { id, name, items: [{ verseKey, surahName, chapterId }] }
            recentlyRead: [], // Array of { chapterId, chapterName, verseKey, timestamp }
            readingSessions: [], // Array of { date (YYYY-MM-DD), duration (seconds), type: 'reading'|'memorizing'|'listening', chapterId }
            planners: [],
            activePlannerId: null,
            planner: null,
            plannerReflections: {}, // { [plannerId]: { [dayNumber]: { text, createdAt } } }
            plannerBookmarks: {}, // { [plannerId]: [{ verseKey, surahName, note, createdAt }] }
            plannerSessionTimers: {}, // { [plannerId]: { [dayNumber]: { startedAt, totalSeconds } } }
            pomodoroProfiles: DEFAULT_POMODORO_PROFILES,
            activePomodoroProfileId: DEFAULT_POMODORO_PROFILES[0].id,
            pomodoroHistory: [], // Array of { date, duration, mode, completedAt }
            pomodoroMode: 'focus',
            pomodoroSound: 'allahu-akbar',
            pomodoroAutoStartBreaks: false,
            pomodoroAutoStartFocus: false,
            pomodoroDailyGoal: 4,
            pomodoroIsRunning: false,
            pomodoroSecondsLeft: DEFAULT_POMODORO_PROFILES[0].focusMinutes * 60,
            pomodoroCompletedFocusCount: 0,
            showGlobalPomodoro: false,

            saukaProgress: {}, // { [assignmentId]: pageNumber }
            setSaukaProgress: (assignmentId, pageNumber) => set((state) => ({
                saukaProgress: { ...state.saukaProgress, [assignmentId]: pageNumber }
            })),
            clearSaukaProgress: (assignmentId) => set((state) => {
                const newProgress = { ...state.saukaProgress };
                delete newProgress[assignmentId];
                return { saukaProgress: newProgress };
            }),

            dailyReadingGoal: 20, // minutes per day
            setDailyReadingGoal: (minutes) => set({ dailyReadingGoal: minutes }),

            setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
            toggleTheme: () => set((state) => ({
                theme: state.theme === 'light' ? 'dark' : 'light'
            })),

            currentUser: null,
            setCurrentUser: (user) => set({ currentUser: user }),

            setTranslation: (id) => set({ translationId: id }),
            setReciter: (id) => set({ reciterId: id }),
            setFontSize: (size) => set({ fontSize: size }),
            setTranslationFontSize: (size) => set({ translationFontSize: size }),
            setReadingMode: (mode) => set({ readingMode: mode }),
            setSelectedMushaf: (mushafId) => set((state) => {
                const mushaf = getMushafById(mushafId);
                const nextFontId = getCompatibleArabicFontId(mushaf.id, state.arabicFontId || getArabicFontByFamily(state.arabicFont)?.id);

                return {
                    mushafId: mushaf.id,
                    arabicFontId: nextFontId,
                    arabicFont: getArabicFontFamily(nextFontId, mushaf.defaultFontId),
                    tajweedEnabled: mushaf.supportsTajweedToggle ? state.tajweedEnabled : false,
                };
            }),
            setArabicFont: (fontId) => set((state) => {
                const nextFontId = getCompatibleArabicFontId(state.mushafId, fontId);
                return {
                    arabicFontId: nextFontId,
                    arabicFont: getArabicFontFamily(nextFontId),
                };
            }),
            setTajweed: (enabled) => set((state) => {
                const mushaf = getMushafById(state.mushafId);
                return { tajweedEnabled: mushaf.supportsTajweedToggle ? enabled : false };
            }),
            setTafsirId: (id) => set({ tafsirId: id }),
            setOfflineStatus: (status) => set({ offlineDataStatus: status }),
            setOfflinePackStatus: (packId, updates) => set((state) => ({
                offlinePackStatus: {
                    ...(state.offlinePackStatus || {}),
                    [packId]: {
                        ...(state.offlinePackStatus?.[packId] || {}),
                        ...updates,
                    },
                },
            })),
            addDownloadedSurah: (id) => set((state) => ({
                downloadedSurahs: state.downloadedSurahs.includes(id) ? state.downloadedSurahs : [...state.downloadedSurahs, id]
            })),

            setBookmark: (verseKey, surahName, chapterId = null) => set((state) => ({
                bookmark: state.bookmark?.verseKey === verseKey ? null : { verseKey, surahName, chapterId }
            })),

            toggleBookmark: (verseKey, surahName, chapterId = null) => set((state) => {
                const exists = state.bookmarks?.find(b => b.verseKey === verseKey);
                if (exists) {
                    return { bookmarks: state.bookmarks.filter(b => b.verseKey !== verseKey) };
                } else {
                    return { bookmarks: [...(state.bookmarks || []), { verseKey, surahName, chapterId }] };
                }
            }),

            toggleMemorizedAyah: (verseKey) => set((state) => {
                const isMemorized = (state.memorizedAyahs || []).includes(verseKey);
                if (isMemorized) {
                    return { memorizedAyahs: state.memorizedAyahs.filter(k => k !== verseKey) };
                } else {
                    return { memorizedAyahs: [...(state.memorizedAyahs || []), verseKey] };
                }
            }),

            
            logHifdhReview: (itemId, ratingValue = Rating.Good) => set((state) => {
                const history = { ...(state.hifdhHistory || {}) };
                const transitions = { ...(state.transitionLinks || {}) };
                
                // If we have an old 'strength' based object, we convert or start fresh
                let card;
                if (history[itemId] && history[itemId].card) {
                    card = history[itemId].card;
                } else {
                    card = createEmptyCard(new Date());
                }
                
                const now = new Date();
                const recordLog = f.next(card, now, ratingValue);
                const newCard = recordLog.card;

                history[itemId] = { 
                    ...history[itemId],
                    card: newCard,
                    lastReviewed: Date.now(), 
                    strength: ratingValue === Rating.Easy ? 'strong' : (ratingValue === Rating.Again ? 'weak' : 'medium')
                };

                if (ratingValue === Rating.Again) {
                    transitions[itemId] = true;
                } else if (ratingValue === Rating.Easy || ratingValue === Rating.Good) {
                    delete transitions[itemId];
                }

                return { hifdhHistory: history, transitionLinks: transitions };
            }),

            addHifdhGoal: (goal) => set((state) => ({
                hifdhGoals: [...(state.hifdhGoals || []), { ...goal, id: Date.now(), createdAt: Date.now() }]
            })),

            deleteHifdhGoal: (id) => set((state) => ({
                hifdhGoals: (state.hifdhGoals || []).filter(g => g.id !== id)
            })),

            toggleMemorizedSurah: (chapterId) => set((state) => {
                const isMemorized = (state.memorizedSurahs || []).includes(chapterId);
                if (isMemorized) {
                    return { memorizedSurahs: state.memorizedSurahs.filter(id => id !== chapterId) };
                } else {
                    return { memorizedSurahs: [...(state.memorizedSurahs || []), chapterId] };
                }
            }),

            addCollection: (name, id = null) => set((state) => ({
                collections: [...(state.collections || []), { id: id || Date.now(), name, items: [] }]
            })),

            deleteCollection: (id) => set((state) => ({
                collections: (state.collections || []).filter(c => c.id !== id)
            })),

            addToCollection: (collectionId, verseKey, surahName, chapterId = null) => set((state) => ({
                collections: (state.collections || []).map(c => {
                    if (c.id === collectionId) {
                        const exists = c.items.find(item => item.verseKey === verseKey);
                        if (!exists) {
                            return { ...c, items: [...c.items, { verseKey, surahName, chapterId }] };
                        }
                    }
                    return c;
                })
            })),

            removeFromCollection: (collectionId, verseKey) => set((state) => ({
                collections: (state.collections || []).map(c => {
                    if (c.id === collectionId) {
                        return { ...c, items: c.items.filter(item => item.verseKey !== verseKey) };
                    }
                    return c;
                })
            })),

            addRecentlyRead: (chapterId, chapterName, verseKey = null) => set((state) => {
                const filtered = (state.recentlyRead || []).filter(r => r.chapterId !== chapterId);
                const newList = [{ chapterId, chapterName, verseKey, timestamp: Date.now() }, ...filtered].slice(0, 5);
                return { recentlyRead: newList };
            }),

            logReadingSession: (duration, type = 'reading', chapterId = null) => set((state) => {
                const today = new Date().toISOString().split('T')[0];
                const session = { date: today, duration, type, chapterId, timestamp: Date.now() };
                const sessions = [...(state.readingSessions || []), session].slice(-500); // Keep last 500
                return { readingSessions: sessions };
            }),
            addPomodoroProfile: (profile) => set((state) => {
                const nextProfile = {
                    id: profile.id || `pomodoro-${Date.now()}`,
                    name: profile.name?.trim() || `Pomodoro ${((state.pomodoroProfiles || []).length + 1)}`,
                    focusMinutes: Number(profile.focusMinutes) || 25,
                    breakMinutes: Number(profile.breakMinutes) || 5,
                };
                const profiles = [...(state.pomodoroProfiles || DEFAULT_POMODORO_PROFILES), nextProfile];
                return {
                    pomodoroProfiles: profiles,
                    activePomodoroProfileId: nextProfile.id,
                    pomodoroMode: 'focus',
                    pomodoroIsRunning: false,
                    pomodoroSecondsLeft: nextProfile.focusMinutes * 60,
                };
            }),
            updatePomodoroProfile: (profileId, updates) => set((state) => {
                const profiles = (state.pomodoroProfiles || DEFAULT_POMODORO_PROFILES).map((profile) =>
                    profile.id === profileId
                        ? {
                            ...profile,
                            ...updates,
                            name: updates.name !== undefined ? (updates.name?.trim() || profile.name) : profile.name,
                            focusMinutes: updates.focusMinutes !== undefined ? Number(updates.focusMinutes) || profile.focusMinutes : profile.focusMinutes,
                            breakMinutes: updates.breakMinutes !== undefined ? Number(updates.breakMinutes) || profile.breakMinutes : profile.breakMinutes,
                        }
                        : profile
                );
                const activeProfile = profiles.find((profile) => profile.id === state.activePomodoroProfileId) || profiles[0] || null;
                return {
                    pomodoroProfiles: profiles,
                    pomodoroSecondsLeft: state.pomodoroIsRunning
                        ? state.pomodoroSecondsLeft
                        : getPomodoroDurationSeconds(activeProfile, state.pomodoroMode),
                };
            }),
            deletePomodoroProfile: (profileId) => set((state) => {
                const existingProfiles = state.pomodoroProfiles || DEFAULT_POMODORO_PROFILES;
                const profiles = existingProfiles.filter((profile) => profile.id !== profileId);
                const fallbackProfiles = profiles.length ? profiles : [DEFAULT_POMODORO_PROFILES[0]];
                const nextActiveProfile = fallbackProfiles.find((profile) => profile.id === state.activePomodoroProfileId) || fallbackProfiles[0];
                return {
                    pomodoroProfiles: fallbackProfiles,
                    activePomodoroProfileId: nextActiveProfile.id,
                    pomodoroIsRunning: false,
                    pomodoroMode: 'focus',
                    pomodoroSecondsLeft: nextActiveProfile.focusMinutes * 60,
                };
            }),
            setActivePomodoroProfile: (profileId) => set((state) => {
                const profiles = state.pomodoroProfiles || DEFAULT_POMODORO_PROFILES;
                const activeProfile = profiles.find((profile) => profile.id === profileId) || profiles[0] || null;
                return {
                    activePomodoroProfileId: activeProfile?.id || null,
                    pomodoroIsRunning: false,
                    pomodoroMode: 'focus',
                    pomodoroSecondsLeft: activeProfile ? activeProfile.focusMinutes * 60 : 0,
                };
            }),
            logPomodoroSession: (duration, mode = 'focus') => set((state) => {
                const today = new Date().toISOString().split('T')[0];
                const session = { date: today, duration, mode, completedAt: Date.now() };
                const history = [...(state.pomodoroHistory || []), session].slice(-500);
                const readingSessions = mode === 'focus'
                    ? [...(state.readingSessions || []), { date: today, duration, type: 'pomodoro', chapterId: null, timestamp: Date.now() }].slice(-500)
                    : state.readingSessions || [];

                return {
                    pomodoroHistory: history,
                    readingSessions,
                };
            }),
            setPomodoroMode: (mode) => set((state) => ({
                activePomodoroProfileId: getActivePomodoroProfile(state).activeProfileId,
                pomodoroMode: mode,
                pomodoroIsRunning: false,
                pomodoroSecondsLeft: getPomodoroDurationSeconds(getActivePomodoroProfile(state).activeProfile, mode),
            })),
            setPomodoroSecondsLeft: (seconds) => set({ pomodoroSecondsLeft: seconds }),
            togglePomodoroRunning: () => set((state) => ({
                pomodoroIsRunning: !state.pomodoroIsRunning,
                showGlobalPomodoro: !state.pomodoroIsRunning ? true : state.showGlobalPomodoro,
            })),
            setShowGlobalPomodoro: (val) => set({ showGlobalPomodoro: val }),
            resetPomodoroSession: () => set((state) => ({
                pomodoroIsRunning: false,
                pomodoroSecondsLeft: getPomodoroDurationSeconds(getActivePomodoroProfile(state).activeProfile, state.pomodoroMode),
            })),
            switchPomodoroMode: () => set((state) => {
                const nextMode = state.pomodoroMode === 'focus' ? 'break' : 'focus';
                return {
                    pomodoroMode: nextMode,
                    pomodoroIsRunning: false,
                    pomodoroSecondsLeft: getPomodoroDurationSeconds(getActivePomodoroProfile(state).activeProfile, nextMode),
                };
            }),
            setPomodoroSound: (sound) => set({ pomodoroSound: sound }),
            setPomodoroAutoStartBreaks: (val) => set({ pomodoroAutoStartBreaks: val }),
            setPomodoroAutoStartFocus: (val) => set({ pomodoroAutoStartFocus: val }),
            setPomodoroDailyGoal: (val) => set({ pomodoroDailyGoal: val }),
            tickPomodoro: () => {
                const state = get();
                if (!state.pomodoroIsRunning) {
                    return;
                }

                const { activeProfile } = getActivePomodoroProfile(state);

                if (state.pomodoroSecondsLeft <= 1) {
                    const today = new Date().toISOString().split('T')[0];
                    const duration = getPomodoroDurationSeconds(activeProfile, state.pomodoroMode);
                    const session = { date: today, duration, mode: state.pomodoroMode, completedAt: Date.now() };
                    const history = [...(state.pomodoroHistory || []), session].slice(-500);
                    const readingSessions = state.pomodoroMode === 'focus'
                        ? [...(state.readingSessions || []), { date: today, duration, type: 'pomodoro', chapterId: null, timestamp: Date.now() }].slice(-500)
                        : state.readingSessions || [];
                    const nextMode = state.pomodoroMode === 'focus' ? 'break' : 'focus';

                    if (state.pomodoroSound && state.pomodoroSound !== 'silent') {
                        try {
                            const audioUrl = state.pomodoroSound === 'allahu-akbar' ? '/allahu-akbar.mp3' :
                                state.pomodoroSound === 'bismillah' ? '/bismillah.mp3' :
                                    state.pomodoroSound === 'alhamdulillah' ? '/alhamdulillah.mp3' :
                                        'data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAAAP//AAD//wAA//8AAP//AAD//wAA';
                            const audio = new Audio(audioUrl);
                            audio.play().catch(() => { });
                        } catch {
                            // ignore audio failures
                        }
                    }

                    if (navigator.vibrate) {
                        navigator.vibrate([200, 120, 200]);
                    }

                    set({
                        pomodoroHistory: history,
                        readingSessions,
                        pomodoroMode: nextMode,
                        pomodoroIsRunning: state.pomodoroMode === 'focus' ? !!state.pomodoroAutoStartBreaks : !!state.pomodoroAutoStartFocus,
                        pomodoroSecondsLeft: getPomodoroDurationSeconds(activeProfile, nextMode),
                        pomodoroCompletedFocusCount: state.pomodoroMode === 'focus'
                            ? state.pomodoroCompletedFocusCount + 1
                            : state.pomodoroCompletedFocusCount,
                    });
                    return;
                }

                set({ pomodoroSecondsLeft: state.pomodoroSecondsLeft - 1 });
            },

            addPlannerReflection: (plannerId, dayNumber, text) => set((state) => {
                const reflections = { ...state.plannerReflections };
                if (!reflections[plannerId]) reflections[plannerId] = {};
                reflections[plannerId][dayNumber] = { text, createdAt: new Date().toISOString() };
                return { plannerReflections: reflections };
            }),

            addPlannerBookmark: (plannerId, verseKey, surahName, note) => set((state) => {
                const bookmarks = { ...state.plannerBookmarks };
                if (!bookmarks[plannerId]) bookmarks[plannerId] = [];
                const existing = bookmarks[plannerId].find(b => b.verseKey === verseKey);
                if (!existing) {
                    bookmarks[plannerId] = [...bookmarks[plannerId], { verseKey, surahName, note, createdAt: new Date().toISOString() }];
                } else if (note) {
                    existing.note = note;
                }
                return { plannerBookmarks: bookmarks };
            }),

            removePlannerBookmark: (plannerId, verseKey) => set((state) => {
                const bookmarks = { ...state.plannerBookmarks };
                if (bookmarks[plannerId]) {
                    bookmarks[plannerId] = bookmarks[plannerId].filter(b => b.verseKey !== verseKey);
                }
                return { plannerBookmarks: bookmarks };
            }),

            startPlannerTimer: (plannerId, dayNumber) => set((state) => {
                const timers = { ...state.plannerSessionTimers };
                if (!timers[plannerId]) timers[plannerId] = {};
                if (!timers[plannerId][dayNumber]) {
                    timers[plannerId][dayNumber] = { totalSeconds: 0 };
                }
                timers[plannerId][dayNumber].startedAt = Date.now();
                return { plannerSessionTimers: timers };
            }),

            stopPlannerTimer: (plannerId, dayNumber, additionalSeconds) => set((state) => {
                const timers = { ...state.plannerSessionTimers };
                if (!timers[plannerId]) timers[plannerId] = {};
                if (!timers[plannerId][dayNumber]) {
                    timers[plannerId][dayNumber] = { totalSeconds: 0 };
                }
                timers[plannerId][dayNumber].totalSeconds += additionalSeconds;
                timers[plannerId][dayNumber].startedAt = null;
                return { plannerSessionTimers: timers };
            }),

            setPlanner: (planner) => set((state) => {
                const planners = state.planners || [];
                const existingIndex = planners.findIndex((item) => item.id === planner.id);
                const nextPlanners = existingIndex >= 0
                    ? planners.map((item, index) => index === existingIndex ? planner : item)
                    : [planner, ...planners];
                return buildPlannerState(nextPlanners, planner.id);
            }),
            setReadingPreferences: (prefs) => set((state) => ({ readingPreferences: { ...state.readingPreferences, ...prefs } })),
            updatePrayerSettings: (prefs) => set((state) => ({ prayerSettings: { ...state.prayerSettings, ...prefs } })),
            toggleIntentionPrompt: () => set((state) => ({ intentionPromptEnabled: !state.intentionPromptEnabled })),
            adjustActivePlannerPace: (newDurationDays) => set((state) => replaceActivePlanner(state, (activePlanner) => adjustPlannerPace(activePlanner, newDurationDays))),
            rebalanceActivePlanner: (strategy) => set((state) => replaceActivePlanner(state, (activePlanner) => rebalancePlanner(activePlanner, strategy))),
            redistributeMissedAssignments: () => set((state) => replaceActivePlanner(state, (activePlanner) => redistributeMissedAssignments(activePlanner) || activePlanner)),
            setActivePlanner: (plannerId) => set((state) => buildPlannerState(state.planners || [], plannerId)),
            deletePlanner: (plannerId) => set((state) => {
                const nextPlanners = (state.planners || []).filter((planner) => planner.id !== plannerId);
                const nextActivePlannerId = state.activePlannerId === plannerId ? nextPlanners[0]?.id || null : state.activePlannerId;
                return buildPlannerState(nextPlanners, nextActivePlannerId);
            }),
            clearPlanner: () => set((state) => {
                if (!state.activePlannerId) {
                    return {};
                }

                const nextPlanners = (state.planners || []).filter((planner) => planner.id !== state.activePlannerId);
                return buildPlannerState(nextPlanners, nextPlanners[0]?.id || null);
            }),
            togglePlannerDayComplete: (dayNumber) => set((state) => replaceActivePlanner(state, (activePlanner) => {
                const assignment = activePlanner.assignments.find((item) => item.dayNumber === dayNumber);
                if (!assignment) {
                    return activePlanner;
                }

                const totalItems = assignment.items.length;
                const assignmentProgress = { ...(activePlanner.assignmentProgress || {}) };
                const assignmentCompletedItems = { ...(activePlanner.assignmentCompletedItems || {}) };
                const assignmentCompletedAt = { ...(activePlanner.assignmentCompletedAt || {}) };
                const isComplete = activePlanner.completedDays.includes(dayNumber);
                assignmentProgress[dayNumber] = isComplete ? 0 : totalItems;
                assignmentCompletedItems[dayNumber] = isComplete ? [] : assignment.items.map((item) => item.rangeValue);
                if (isComplete) {
                    delete assignmentCompletedAt[dayNumber];
                } else {
                    assignmentCompletedAt[dayNumber] = new Date().toISOString().split('T')[0];
                }

                const completedDays = activePlanner.assignments
                    .filter((item) => (assignmentProgress[item.dayNumber] || 0) >= item.items.length)
                    .map((item) => item.dayNumber)
                    .sort((a, b) => a - b);

                return {
                    ...activePlanner,
                    assignmentProgress,
                    assignmentCompletedItems,
                    assignmentCompletedAt,
                    completedDays,
                };
            })),
            setPlannerAssignmentProgress: (dayNumber, completedCount) => set((state) => replaceActivePlanner(state, (activePlanner) => {
                const assignment = activePlanner.assignments.find((item) => item.dayNumber === dayNumber);
                if (!assignment) {
                    return activePlanner;
                }

                const totalItems = assignment.items.length;
                const safeCompletedCount = Math.max(0, Math.min(Number(completedCount) || 0, totalItems));
                const assignmentProgress = {
                    ...(activePlanner.assignmentProgress || {}),
                    [dayNumber]: safeCompletedCount,
                };
                const assignmentCompletedItems = { ...(activePlanner.assignmentCompletedItems || {}) };
                assignmentCompletedItems[dayNumber] = assignment.items.slice(0, safeCompletedCount).map((item) => item.rangeValue);
                const assignmentCompletedAt = { ...(activePlanner.assignmentCompletedAt || {}) };

                if (safeCompletedCount >= totalItems) {
                    assignmentCompletedAt[dayNumber] = assignmentCompletedAt[dayNumber] || new Date().toISOString().split('T')[0];
                } else {
                    delete assignmentCompletedAt[dayNumber];
                }

                const completedDays = activePlanner.assignments
                    .filter((item) => (assignmentProgress[item.dayNumber] || 0) >= item.items.length)
                    .map((item) => item.dayNumber)
                    .sort((a, b) => a - b);

                return {
                    ...activePlanner,
                    assignmentProgress,
                    assignmentCompletedItems,
                    assignmentCompletedAt,
                    completedDays,
                };
            })),
            markPlannerPageRead: (dayNumber, pageNumber) => set((state) => replaceActivePlanner(state, (activePlanner) => {
                const assignment = activePlanner.assignments.find((item) => item.dayNumber === dayNumber);
                if (!assignment) return activePlanner;

                const assignmentReadPages = { ...(activePlanner.assignmentReadPages || {}) };
                const existing = Array.isArray(assignmentReadPages[dayNumber]) ? assignmentReadPages[dayNumber] : [];
                if (!existing.includes(pageNumber)) {
                    assignmentReadPages[dayNumber] = [...existing, pageNumber];
                } else {
                    return activePlanner;
                }
                
                return { ...activePlanner, assignmentReadPages };
            })),
            markPlannerItemComplete: (dayNumber, rangeValue) => set((state) => replaceActivePlanner(state, (activePlanner) => {
                const assignment = activePlanner.assignments.find((item) => item.dayNumber === dayNumber);
                if (!assignment) {
                    return activePlanner;
                }

                const assignmentCompletedItems = { ...(activePlanner.assignmentCompletedItems || {}) };
                const existing = Array.isArray(assignmentCompletedItems[dayNumber]) ? assignmentCompletedItems[dayNumber] : [];
                const nextCompletedItems = Array.from(new Set([...existing, rangeValue])).filter((value) =>
                    assignment.items.some((item) => item.rangeValue === value)
                );

                assignmentCompletedItems[dayNumber] = nextCompletedItems;

                const assignmentProgress = {
                    ...(activePlanner.assignmentProgress || {}),
                    [dayNumber]: nextCompletedItems.length,
                };

                const assignmentCompletedAt = { ...(activePlanner.assignmentCompletedAt || {}) };
                if (nextCompletedItems.length >= assignment.items.length) {
                    assignmentCompletedAt[dayNumber] = assignmentCompletedAt[dayNumber] || new Date().toISOString().split('T')[0];
                }

                const completedDays = activePlanner.assignments
                    .filter((item) => {
                        const completedItems = assignmentCompletedItems[item.dayNumber] || [];
                        return completedItems.length >= item.items.length;
                    })
                    .map((item) => item.dayNumber)
                    .sort((a, b) => a - b);

                return {
                    ...activePlanner,
                    assignmentProgress,
                    assignmentCompletedItems,
                    assignmentCompletedAt,
                    completedDays,
                };
            })),

            setPlannerLastPosition: (pageNumber, verseKey) => set((state) => replaceActivePlanner(state, (activePlanner) => ({
                ...activePlanner,
                lastReadPage: pageNumber,
                lastReadVerseKey: verseKey !== undefined ? verseKey : activePlanner.lastReadVerseKey,
            }))),

            // Advanced Audio State
            currentAudioUrl: null, // Legacy single file support
            audioPlaylist: [], // Array of { url, verseKey, verseNumber }
            audioTrackIndex: 0,
            isPlaying: false,

            // Advanced Audio Settings (Persisted)
            audioSettings: {
                startRange: null,
                endRange: null,
                reciterId: 7,
                repeatSelection: 1, // 1 = play once, -1 = infinite loop
                repeatAya: 1, // 1 = play once, -1 = infinite
                delayBetweenAyas: 0, // seconds
                playbackSpeed: 1.0,
                scrollWhilePlaying: true,
            },

            // Auto-scroll (transient)
            autoScroll: false,
            isAutoScrollPaused: false,
            autoScrollSpeed: 3, // 1-7
            setAutoScroll: (val) => set({ autoScroll: val, isAutoScrollPaused: false }),
            setIsAutoScrollPaused: (val) => set({ isAutoScrollPaused: val }),
            setAutoScrollSpeed: (speed) => set({ autoScrollSpeed: speed }),

            navHeaderTitle: null,
            setNavHeaderTitle: (title) => set({ navHeaderTitle: title }),

            setAudio: (url) => set({ currentAudioUrl: url, audioPlaylist: [] }),
            setAudioPlaylist: (playlist, startIndex = 0) => set({
                audioPlaylist: playlist,
                audioTrackIndex: startIndex,
                currentAudioUrl: null,
            }),
            setAudioTrackIndex: (index) => set({ audioTrackIndex: index }),
            updateAudioSettings: (newSettings) => set((state) => ({
                audioSettings: { ...state.audioSettings, ...newSettings }
            })),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            stopAudio: () => set({ isPlaying: false, currentAudioUrl: null, audioPlaylist: [] }),

            // Player visibility
            isPlayerVisible: false,
            setIsPlayerVisible: (val) => set({ isPlayerVisible: val }),

            // Trigger to tell Surah.jsx to start playing (cross-component signal)
            playTriggerCount: 0,
            incrementPlayTrigger: () => set((state) => ({ playTriggerCount: state.playTriggerCount + 1 })),

            // Custom Offline Audio Base URL
            customAudioBaseUrl: '',
            setCustomAudioBaseUrl: (val) => set({ customAudioBaseUrl: val }),

            // Native File System Handle for Offline Audio
            localAudioDirHandle: null,
            setLocalAudioDirHandle: (handle) => set({ localAudioDirHandle: handle }),

            lastSyncAt: 0,
            setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

            prayerTimes: null,
            setPrayerTimes: (times) => set({ prayerTimes: times }),
            location: null,
            setLocation: (loc) => set({ location: loc }),

            shiftPlannerSchedule: (planId, daysToShift) => set((state) => updatePlannerCollection(state, ({ planners, activePlannerId, activePlanner }) => {
                const targetId = planId || activePlannerId;
                const nextPlanners = planners.map((p) => {
                    if (p.id === targetId) {
                        const currentStart = new Date(p.startDate);
                        currentStart.setDate(currentStart.getDate() + daysToShift);
                        
                        const newAssignments = p.assignments.map(a => {
                            const d = new Date(currentStart);
                            d.setDate(d.getDate() + (a.dayNumber - 1));
                            return { ...a, date: d.toISOString().split('T')[0] };
                        });

                        return {
                            ...p,
                            startDate: currentStart.toISOString().split('T')[0],
                            assignments: newAssignments
                        };
                    }
                    return p;
                });
                return buildPlannerState(nextPlanners, activePlannerId);
            })),

            updatePlanner: (planId, updates) => set((state) => updatePlannerCollection(state, ({ planners, activePlannerId }) => {
                const targetId = planId || activePlannerId;
                const nextPlanners = planners.map(p => p.id === targetId ? { ...p, ...updates } : p);
                return buildPlannerState(nextPlanners, activePlannerId);
            })),

            archivePlanner: (planId) => set((state) => {
                const targetId = planId || state.activePlannerId;
                const plannerToArchive = state.planners?.find(p => p.id === targetId) || state.planner;
                
                if (!plannerToArchive) return state;

                const archivedPlanners = [...(state.archivedPlanners || []), { ...plannerToArchive, archivedAt: new Date().toISOString() }];
                
                return updatePlannerCollection(state, ({ planners, activePlannerId }) => {
                    const nextPlanners = planners.filter(p => p.id !== targetId);
                    const nextActiveId = activePlannerId === targetId ? (nextPlanners[0]?.id || null) : activePlannerId;
                    return { ...buildPlannerState(nextPlanners, nextActiveId), archivedPlanners };
                });
            }),

            archivedPlanners: [],
            setArchivedPlanners: (planners) => set({ archivedPlanners: planners }),

            prayerSettings: { activePrayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], readPreference: 'After' },
            updatePrayerSettings: (settings) => set((state) => ({ prayerSettings: { ...state.prayerSettings, ...settings } })),

            intentionPromptEnabled: true,
            setIntentionPromptEnabled: (enabled) => set({ intentionPromptEnabled: enabled }),

        }),
        {
            name: 'quran-app-storage',
            merge: (persistedState, currentState) => {
                const merged = {
                    ...currentState,
                    ...(persistedState || {}),
                };

                const planners = merged.planners || (merged.planner ? [merged.planner] : []);
                const activePlannerId = merged.activePlannerId || planners[0]?.id || null;
                const planner = planners.find((item) => item.id === activePlannerId) || planners[0] || null;

                return {
                    ...merged,
                    planners,
                    activePlannerId: planner?.id || null,
                    planner,
                    pomodoroProfiles: merged.pomodoroProfiles || DEFAULT_POMODORO_PROFILES,
                    activePomodoroProfileId: merged.activePomodoroProfileId || merged.pomodoroProfiles?.[0]?.id || DEFAULT_POMODORO_PROFILES[0].id,
                };
            },
            partialize: (state) => getSyncableState(state), // Persist settings and user data
        }
    )
);

export function getSyncableState(state) {
    return {
        theme: state.theme,
        translationId: state.translationId,
        reciterId: state.reciterId,
        fontSize: state.fontSize,
        translationFontSize: state.translationFontSize || 2,
        readingMode: state.readingMode,
        mushafId: state.mushafId || DEFAULT_MUSHAF.id,
        arabicFontId: state.arabicFontId || DEFAULT_ARABIC_FONT_ID,
        arabicFont: state.arabicFont,
        tajweedEnabled: state.tajweedEnabled,
        tafsirId: state.tafsirId,
        bookmark: state.bookmark,
        bookmarks: state.bookmarks || [],
        memorizedAyahs: state.memorizedAyahs || [],
        memorizedSurahs: state.memorizedSurahs || [],
        hifdhHistory: state.hifdhHistory || {},
        hifdhGoals: state.hifdhGoals || [],
        collections: state.collections || [],
        recentlyRead: state.recentlyRead || [],
        readingSessions: state.readingSessions || [],
        pomodoroProfiles: state.pomodoroProfiles || DEFAULT_POMODORO_PROFILES,
        activePomodoroProfileId: state.activePomodoroProfileId || state.pomodoroProfiles?.[0]?.id || DEFAULT_POMODORO_PROFILES[0].id,
        pomodoroHistory: state.pomodoroHistory || [],
        pomodoroMode: state.pomodoroMode || 'focus',
        pomodoroIsRunning: state.pomodoroIsRunning || false,
        pomodoroSecondsLeft: state.pomodoroSecondsLeft || DEFAULT_POMODORO_PROFILES[0].focusMinutes * 60,
        pomodoroCompletedFocusCount: state.pomodoroCompletedFocusCount || 0,
        planners: state.planners || (state.planner ? [state.planner] : []),
        activePlannerId: state.activePlannerId || state.planner?.id || state.planners?.[0]?.id || null,
        planner: state.planner || null,
        offlineDataStatus: state.offlineDataStatus,
        offlinePackStatus: state.offlinePackStatus || {},
        downloadedSurahs: state.downloadedSurahs || [],
        customAudioBaseUrl: state.customAudioBaseUrl || '',
        audioSettings: state.audioSettings || {
            startRange: null, endRange: null, reciterId: 7,
            repeatSelection: 1, repeatAya: 1, delayBetweenAyas: 0,
            playbackSpeed: 1.0, scrollWhilePlaying: true
        },
        lastSyncAt: state.lastSyncAt || 0,
        dailyReadingGoal: state.dailyReadingGoal || 20,
        prayerTimes: state.prayerTimes || null,
        location: state.location || null,
        archivedPlanners: state.archivedPlanners || [],
        prayerSettings: state.prayerSettings || { activePrayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], readPreference: 'After' },
        intentionPromptEnabled: state.intentionPromptEnabled ?? true,
        plannerReflections: state.plannerReflections || {},
        plannerBookmarks: state.plannerBookmarks || {},
        plannerSessionTimers: state.plannerSessionTimers || {},
        saukaProgress: state.saukaProgress || {}
    };
}
