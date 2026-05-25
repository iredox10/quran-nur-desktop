import { HIZB_STARTS, JUZ_STARTS, PAGE_GROUPS } from '../data/quranNavigation';

export const PLANNER_UNITS = {
  page: { label: 'Page', plural: 'Pages', max: 604 },
  juz: { label: 'Juz', plural: 'Ajza', max: 30 },
  hizb: { label: 'Hizb', plural: 'Ahzab', max: 60 },
  surah: { label: 'Surah', plural: 'Surahs', max: 114 },
};

export const PLAN_TEMPLATES = [
  { id: 'ramadan-last-10', title: 'Ramadan Last 10', durationDays: 10, unitType: 'juz', startUnit: 28, endUnit: 30, description: 'Complete the last 3 Ajza in the last 10 days' },
  { id: 'juz-amma', title: 'Juz Amma Focus', durationDays: 15, unitType: 'juz', startUnit: 30, endUnit: 30, description: 'Take 15 days to master the 30th Juz' },
  { id: 'al-kahf', title: 'Surah Al-Kahf Weekly', durationDays: 1, unitType: 'surah', startUnit: 18, endUnit: 18, description: 'The recommended Friday reading' },
  { id: 'tafsir-deep-dive', title: 'Tafsir Deep Dive', durationDays: 114, unitType: 'surah', startUnit: 1, endUnit: 114, description: 'One Surah per week (requires manually setting days off)' },
  { id: 'monthly-juz', title: 'Monthly Juz', durationDays: 30, unitType: 'juz', startUnit: 1, endUnit: 30, description: 'One Juz per month (set custom duration when creating)' },
  { id: 'quick-revision', title: 'Quick Revision', durationDays: 10, unitType: 'juz', startUnit: 1, endUnit: 30, description: 'Full Quran in 10 days for intense revision' }
];

export function getPlannerUnitItems(unitType, chapters) {
  return buildUnitSource(unitType, chapters);
}

function getLookupPageBounds(unitType, rangeValue, chapters = []) {
  if (unitType === 'page') {
    return { pageStart: rangeValue, pageEnd: rangeValue };
  }

  if (unitType === 'juz') {
    const current = JUZ_STARTS.find((item) => item.id === rangeValue);
    const next = JUZ_STARTS.find((item) => item.id === rangeValue + 1);
    if (!current) {
      return { pageStart: null, pageEnd: null };
    }

    return {
      pageStart: current.pageNumber,
      pageEnd: next ? next.pageNumber - 1 : 604,
    };
  }

  if (unitType === 'hizb') {
    const current = HIZB_STARTS.find((item) => item.id === rangeValue);
    const next = HIZB_STARTS.find((item) => item.id === rangeValue + 1);
    if (!current) {
      return { pageStart: null, pageEnd: null };
    }

    return {
      pageStart: current.pageNumber,
      pageEnd: next ? next.pageNumber - 1 : 604,
    };
  }

  const chapter = chapters.find((item) => item.id === rangeValue);
  if (!chapter?.pages?.length) {
    return { pageStart: null, pageEnd: null };
  }

  return {
    pageStart: chapter.pages[0],
    pageEnd: chapter.pages[1] || chapter.pages[0],
  };
}

function resolveItemPageBounds(item, unitType, chapters = []) {
  if (item?.pageStart && item?.pageEnd) {
    return { pageStart: item.pageStart, pageEnd: item.pageEnd };
  }

  return getLookupPageBounds(unitType, item?.rangeValue, chapters);
}

function resolveAssignmentPageBounds(assignment, chapters = []) {
  if (assignment?.pageStart && assignment?.pageEnd) {
    return { pageStart: assignment.pageStart, pageEnd: assignment.pageEnd };
  }

  const itemBounds = (assignment?.items || [])
    .map((item) => resolveItemPageBounds(item, assignment.unitType, chapters))
    .filter((item) => item.pageStart && item.pageEnd);

  if (!itemBounds.length) {
    return { pageStart: null, pageEnd: null };
  }

  return {
    pageStart: Math.min(...itemBounds.map((item) => item.pageStart)),
    pageEnd: Math.max(...itemBounds.map((item) => item.pageEnd)),
  };
}

export function formatPlannerDate(date) {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatPlannerDateLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function addDays(date, days) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return formatPlannerDate(next);
}

export function diffDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end - start) / 86400000);
}

export function getReadingDate(startDate, index, excludeDays = []) {
  let date = new Date(`${startDate}T00:00:00`);
  let daysFound = 0;
  
  while (excludeDays.includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
  }
  
  while (daysFound < index) {
    date.setDate(date.getDate() + 1);
    if (!excludeDays.includes(date.getDay())) {
      daysFound++;
    }
  }
  
  return formatPlannerDate(date);
}

function buildUnitSource(unitType, chapters) {
  if (unitType === 'page') {
    return PAGE_GROUPS.map((item) => ({
      id: item.id,
      title: `Page ${item.pageNumber}`,
      subtitle: 'Mushaf page view',
      route: `/page/${item.pageNumber}`,
      rangeValue: item.pageNumber,
      pageStart: item.pageNumber,
      pageEnd: item.pageNumber,
    }));
  }

  if (unitType === 'juz') {
    return JUZ_STARTS.map((item, index) => {
      const nextItem = JUZ_STARTS[index + 1];
      const pageStart = item.pageNumber;
      const pageEnd = nextItem ? nextItem.pageNumber - 1 : 604;

      return {
      id: item.id,
      title: `Juz ${item.id}`,
      subtitle: `Starts at ${item.verseKey}`,
      route: `/page/${item.pageNumber}`,
      rangeValue: item.id,
      pageStart,
      pageEnd,
      };
    });
  }

  if (unitType === 'hizb') {
    return HIZB_STARTS.map((item, index) => {
      const nextItem = HIZB_STARTS[index + 1];
      const pageStart = item.pageNumber;
      const pageEnd = nextItem ? nextItem.pageNumber - 1 : 604;

      return {
      id: item.id,
      title: `Hizb ${item.id}`,
      subtitle: `Starts at ${item.verseKey}`,
      route: `/page/${item.pageNumber}`,
      rangeValue: item.id,
      pageStart,
      pageEnd,
      };
    });
  }

  return (chapters || []).map((chapter) => ({
    id: chapter.id,
    title: chapter.name_simple,
    subtitle: chapter.translated_name.name,
    route: `/surah/${chapter.id}`,
    rangeValue: chapter.id,
    pageStart: chapter.pages?.[0] || null,
    pageEnd: chapter.pages?.[1] || chapter.pages?.[0] || null,
  }));
}

function splitIntoChunks(items, chunkCount) {
  const chunks = [];
  let cursor = 0;
  const baseSize = Math.floor(items.length / chunkCount);
  const remainder = items.length % chunkCount;

  for (let index = 0; index < chunkCount; index += 1) {
    const chunkSize = baseSize + (index < remainder ? 1 : 0);
    if (chunkSize <= 0) {
      break;
    }

    chunks.push(items.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }

  return chunks;
}

function buildAssignmentTitle(unitType, items) {
  const first = items[0];
  const last = items[items.length - 1];

  if (unitType === 'surah') {
    if (items.length === 1) {
      return first.title;
    }

    return `Surah ${first.id}-${last.id}`;
  }

  const unit = PLANNER_UNITS[unitType];
  if (first.rangeValue === last.rangeValue) {
    return `${unit.label} ${first.rangeValue}`;
  }

  return `${unit.plural} ${first.rangeValue}-${last.rangeValue}`;
}

function buildPlanTitle(unitType, items, customTitle) {
  if (customTitle?.trim()) {
    return customTitle.trim();
  }

  const first = items[0];
  const last = items[items.length - 1];
  const unit = PLANNER_UNITS[unitType];

  if (first.rangeValue === last.rangeValue) {
    return `${unit.label} ${first.rangeValue} Plan`;
  }

  return `${unit.plural} ${first.rangeValue}-${last.rangeValue} Plan`;
}

function buildAssignmentSubtitle(unitType, items) {
  const first = items[0];
  const last = items[items.length - 1];

  if (unitType === 'surah') {
    if (items.length === 1) {
      return `${first.subtitle} · ${first.title}`;
    }

    return `${first.title} to ${last.title}`;
  }

  if (items.length === 1) {
    return first.subtitle;
  }

  return `${first.subtitle} · ${last.subtitle}`;
}

export function buildReadingPlanner({ unitType, durationDays, startDate, startUnit, endUnit, customTitle, excludeDays = [] }, chapters) {
  const sourceItems = buildUnitSource(unitType, chapters);
  const unitMeta = PLANNER_UNITS[unitType];

  if (!unitMeta) {
    throw new Error('Unsupported planner unit');
  }

  const normalizedStartUnit = Math.max(1, Math.min(Number(startUnit) || 1, unitMeta.max));
  const normalizedEndUnit = Math.max(normalizedStartUnit, Math.min(Number(endUnit) || unitMeta.max, unitMeta.max));
  const scopedItems = sourceItems.filter((item) => item.rangeValue >= normalizedStartUnit && item.rangeValue <= normalizedEndUnit);

  if (!scopedItems.length) {
    throw new Error('Planner scope is empty');
  }

  const safeDuration = Math.max(1, Math.min(Number(durationDays) || 1, scopedItems.length));
  const chunks = splitIntoChunks(scopedItems, safeDuration);
  const planId = `plan-${Date.now()}`;

  const assignments = chunks.map((items, index) => ({
    dayNumber: index + 1,
    date: getReadingDate(startDate, index, excludeDays),
    unitType,
    title: buildAssignmentTitle(unitType, items),
    subtitle: buildAssignmentSubtitle(unitType, items),
    startUnit: items[0].rangeValue,
    endUnit: items[items.length - 1].rangeValue,
    primaryRoute: items[0].route,
    pageStart: items.reduce((min, item) => Math.min(min, item.pageStart ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY),
    pageEnd: items.reduce((max, item) => Math.max(max, item.pageEnd ?? 0), 0),
    items,
  }));

  return {
    id: planId,
    createdAt: new Date().toISOString(),
    unitType,
    title: buildPlanTitle(unitType, scopedItems, customTitle),
    durationDays: assignments.length,
    startDate,
    startUnit: normalizedStartUnit,
    endUnit: normalizedEndUnit,
    isCustomRange: normalizedStartUnit !== 1 || normalizedEndUnit !== unitMeta.max || Boolean(customTitle?.trim()),
    assignmentProgress: {},
    assignmentCompletedItems: {},
    assignmentCompletedAt: {},
    completedDays: [],
    assignments,
    excludeDays,
  };
}

export function adjustPlannerPace(planner, newDurationDays) {
  const completedAssignments = planner.assignments.filter(a => planner.completedDays?.includes(a.dayNumber));
  const uncompletedAssignments = planner.assignments.filter(a => !planner.completedDays?.includes(a.dayNumber));
  
  if (!uncompletedAssignments.length) return planner; 
  
  const uncompletedItems = uncompletedAssignments.flatMap(a => a.items);
  const chunks = splitIntoChunks(uncompletedItems, newDurationDays);
  
  const todayDate = formatPlannerDate(new Date());
  let newStartStr = todayDate;
  if (completedAssignments.length && completedAssignments[completedAssignments.length - 1].date >= todayDate) {
      newStartStr = addDays(completedAssignments[completedAssignments.length - 1].date, 1);
  } else if (!completedAssignments.length) {
      newStartStr = [planner.startDate, todayDate].sort()[1]; // max
  }

  const newAssignments = chunks.map((items, idx) => {
      const dayIndex = completedAssignments.length + idx;
      return {
          dayNumber: dayIndex + 1,
          date: getReadingDate(newStartStr, idx, planner.excludeDays || []),
          unitType: planner.unitType,
          title: buildAssignmentTitle(planner.unitType, items),
          subtitle: buildAssignmentSubtitle(planner.unitType, items),
          startUnit: items[0].rangeValue,
          endUnit: items[items.length - 1].rangeValue,
          primaryRoute: items[0].route,
          pageStart: items.reduce((min, item) => Math.min(min, item.pageStart ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY),
          pageEnd: items.reduce((max, item) => Math.max(max, item.pageEnd ?? 0), 0),
          items,
      };
  });
  
  return {
     ...planner,
     durationDays: completedAssignments.length + newAssignments.length,
     assignments: [...completedAssignments, ...newAssignments]
  };
}

export function redistributeMissedAssignments(planner) {
    const today = formatPlannerDate(new Date());
    const uncompletedAssignments = planner.assignments.filter(a => !planner.completedDays?.includes(a.dayNumber));
    if (!uncompletedAssignments.length) return planner;

    const originalEndDate = planner.assignments[planner.assignments.length - 1].date;
    
    if (today > originalEndDate) {
        return null;
    }

    const uncompletedItems = uncompletedAssignments.flatMap(a => a.items);
    
    let remainingDays = 0;
    let curr = today;
    while (curr <= originalEndDate) {
       const d = new Date(`${curr}T00:00:00`);
       if (!(planner.excludeDays || []).includes(d.getDay())) {
           remainingDays++;
       }
       curr = addDays(curr, 1);
    }
    
    if (remainingDays <= 0) remainingDays = 1;

    const chunks = splitIntoChunks(uncompletedItems, remainingDays);
    const completedAssignments = planner.assignments.filter(a => planner.completedDays?.includes(a.dayNumber));
    
    const newAssignments = chunks.map((items, idx) => {
      const dayIndex = completedAssignments.length + idx;
      return {
          dayNumber: dayIndex + 1,
          date: getReadingDate(today, idx, planner.excludeDays || []),
          unitType: planner.unitType,
          title: buildAssignmentTitle(planner.unitType, items),
          subtitle: buildAssignmentSubtitle(planner.unitType, items),
          startUnit: items[0].rangeValue,
          endUnit: items[items.length - 1].rangeValue,
          primaryRoute: items[0].route,
          pageStart: items.reduce((min, item) => Math.min(min, item.pageStart ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY),
          pageEnd: items.reduce((max, item) => Math.max(max, item.pageEnd ?? 0), 0),
          items,
      };
    });
    
    return {
       ...planner,
       assignments: [...completedAssignments, ...newAssignments]
    };
}

export function getPlannerPageContext(plan, pageNumber, chapters = []) {
  if (!plan) {
    return null;
  }

  const assignment = plan.assignments.find((item) => {
    const bounds = resolveAssignmentPageBounds(item, chapters);
    return bounds.pageStart && bounds.pageEnd && pageNumber >= bounds.pageStart && pageNumber <= bounds.pageEnd;
  });
  if (!assignment) {
    return null;
  }

  const assignmentBounds = resolveAssignmentPageBounds(assignment, chapters);
  const currentItemIndex = assignment.items.findIndex((item) => {
    const bounds = resolveItemPageBounds(item, assignment.unitType, chapters);
    return bounds.pageStart && bounds.pageEnd && pageNumber >= bounds.pageStart && pageNumber <= bounds.pageEnd;
  });
  const currentItem = assignment.items[currentItemIndex] || assignment.items[0] || null;
  const progress = getAssignmentProgress(plan, assignment);
  const currentItemBounds = currentItem ? resolveItemPageBounds(currentItem, assignment.unitType, chapters) : null;

  return {
    assignment,
    currentItem,
    currentItemIndex,
    progress,
    isCurrentItemComplete: currentItem ? progress.completedRangeValues.includes(currentItem.rangeValue) : false,
    isLastPageOfCurrentItem: currentItemBounds ? pageNumber >= currentItemBounds.pageEnd : false,
    isLastPageOfDay: assignmentBounds.pageEnd ? pageNumber >= assignmentBounds.pageEnd : false,
    assignmentPageStart: assignmentBounds.pageStart,
    assignmentPageEnd: assignmentBounds.pageEnd,
    currentItemPageStart: currentItemBounds?.pageStart || null,
    currentItemPageEnd: currentItemBounds?.pageEnd || null,
  };
}

export function getPlannerOverview(plan, today = formatPlannerDate(new Date())) {
  if (!plan) {
    return null;
  }

  const elapsedDays = diffDays(plan.startDate, today);
  const currentDayNumber = Math.min(Math.max(elapsedDays + 1, 1), plan.durationDays);
  const completedCount = plan.assignments.filter((assignment) => getAssignmentProgress(plan, assignment).isComplete).length;
  const remainingCount = Math.max(plan.durationDays - completedCount, 0);
  const firstIncomplete = plan.assignments.find((assignment) => !getAssignmentProgress(plan, assignment).isComplete);

  return {
    completedCount,
    remainingCount,
    currentDayNumber,
    isUpcoming: elapsedDays < 0,
    isFinishedWindow: elapsedDays >= plan.durationDays,
    completionRatio: plan.durationDays ? completedCount / plan.durationDays : 0,
    firstIncomplete: firstIncomplete || plan.assignments[plan.assignments.length - 1],
  };
}

export function getAssignmentStatus(plan, assignment, today = formatPlannerDate(new Date())) {
  const completed = getAssignmentProgress(plan, assignment).isComplete;
  if (completed) {
    return 'completed';
  }

  if (assignment.date < today) {
    return 'overdue';
  }

  if (assignment.date === today) {
    return 'today';
  }

  return 'upcoming';
}

export function getAssignmentProgress(plan, assignment) {
  const totalCount = assignment.items.length;
  const explicitCompletedItems = Array.isArray(plan?.assignmentCompletedItems?.[assignment.dayNumber])
    ? plan.assignmentCompletedItems[assignment.dayNumber]
    : null;
  const rawCompletedCount = plan?.assignmentProgress?.[assignment.dayNumber] ?? 0;

  const completedRangeValues = explicitCompletedItems
    ? assignment.items
        .filter((item) => explicitCompletedItems.includes(item.rangeValue))
        .map((item) => item.rangeValue)
    : assignment.items
        .slice(0, Math.max(0, Math.min(rawCompletedCount, totalCount)))
        .map((item) => item.rangeValue);

  const completedCount = completedRangeValues.length;
  const nextItem = assignment.items.find((item) => !completedRangeValues.includes(item.rangeValue)) || assignment.items[assignment.items.length - 1] || null;

  return {
    completedCount,
    totalCount,
    remainingCount: Math.max(totalCount - completedCount, 0),
    completionRatio: totalCount ? completedCount / totalCount : 0,
    isComplete: totalCount > 0 && completedCount >= totalCount,
    completedAt: plan?.assignmentCompletedAt?.[assignment.dayNumber] || null,
    completedRangeValues,
    nextItem,
  };
}

export function getPlannerSuccessMetrics(plan, today = formatPlannerDate(new Date())) {
  if (!plan) {
    return null;
  }

  const completedAssignments = plan.assignments.filter((assignment) => getAssignmentProgress(plan, assignment).isComplete);
  const onTimeCount = completedAssignments.filter((assignment) => {
    const completedAt = plan.assignmentCompletedAt?.[assignment.dayNumber];
    return completedAt && completedAt <= assignment.date;
  }).length;
  const lateCount = Math.max(completedAssignments.length - onTimeCount, 0);
  const dueAssignments = plan.assignments.filter((assignment) => assignment.date <= today);
  const dueCompletedCount = dueAssignments.filter((assignment) => getAssignmentProgress(plan, assignment).isComplete).length;
  const successRate = dueAssignments.length ? Math.round((onTimeCount / dueAssignments.length) * 100) : 0;

  let consistencyStreak = 0;
  for (const assignment of dueAssignments) {
    const completedAt = plan.assignmentCompletedAt?.[assignment.dayNumber];
    if (completedAt && completedAt <= assignment.date) {
      consistencyStreak += 1;
      continue;
    }

    break;
  }

  return {
    completedCount: completedAssignments.length,
    onTimeCount,
    lateCount,
    dueCount: dueAssignments.length,
    dueCompletedCount,
    successRate,
    consistencyStreak,
  };
}

export function getAssignmentResumePageNumber(plan, assignment, chapters = []) {
  if (!plan || !assignment) return 1;
  const progress = getAssignmentProgress(plan, assignment);
  if (progress.isComplete) return assignment.pageStart || 1;
  const nextItem = progress.nextItem;
  if (!nextItem) return assignment.pageStart || 1;
  const bounds = resolveItemPageBounds(nextItem, assignment.unitType, chapters);
  return bounds.pageStart || assignment.pageStart || 1;
}

export function buildRevisionPlanner(completedPlan, chapters) {
  const newDuration = Math.ceil(completedPlan.durationDays / 2);
  const today = formatPlannerDate(new Date());
  
  return buildReadingPlanner({
    unitType: completedPlan.unitType,
    durationDays: newDuration,
    startDate: today,
    startUnit: completedPlan.startUnit,
    endUnit: completedPlan.endUnit,
    customTitle: `${completedPlan.title} (Revision)`,
    excludeDays: completedPlan.excludeDays || []
  }, chapters);
}

export function getDifficultyIndicators(assignments) {
  if (!assignments || !assignments.length) return {};
  
  const pageCounts = assignments.map(a => {
    let pages = 0;
    a.items.forEach(item => {
      if (item.pageStart && item.pageEnd) {
        pages += (item.pageEnd - item.pageStart + 1);
      }
    });
    return { dayNumber: a.dayNumber, pages };
  });

  const totalPages = pageCounts.reduce((sum, item) => sum + item.pages, 0);
  const avgPages = totalPages / pageCounts.length;
  
  const indicators = {};
  pageCounts.forEach(item => {
    let level = 'moderate';
    if (item.pages > avgPages * 1.3) level = 'heavy';
    else if (item.pages < avgPages * 0.7) level = 'light';
    indicators[item.dayNumber] = { level, pages: item.pages };
  });
  
  return indicators;
}

export function getWeeklySummary(planner) {
  if (!planner || !planner.assignments || !planner.assignments.length) return [];
  
  // Group assignments by week (7 day blocks) based on dayNumber
  const weeks = [];
  const duration = planner.durationDays;
  
  for (let i = 0; i < duration; i += 7) {
    const weekAssignments = planner.assignments.slice(i, i + 7);
    if (!weekAssignments.length) break;
    
    let totalUnits = 0;
    let completedUnits = 0;
    
    weekAssignments.forEach(a => {
      // rough estimation of units (pages)
      let pages = 0;
      a.items.forEach(item => {
        if (item.pageStart && item.pageEnd) {
           pages += (item.pageEnd - item.pageStart + 1);
        }
      });
      totalUnits += pages;
      if (planner.completedDays?.includes(a.dayNumber)) {
        completedUnits += pages;
      }
    });
    
    const weekNum = Math.floor(i / 7) + 1;
    weeks.push({
      label: `Week ${weekNum}`,
      completedUnits,
      totalUnits: totalUnits || 1 // prevent div by 0
    });
  }
  
  return weeks;
}

export function getPlannerAnalytics(planner) {
  if (!planner || !planner.assignments) {
    return { onTimeRate: 0, catchUpDaysCount: 0, avgUnitsPerDay: 0 };
  }
  
  const completedAssignments = planner.assignments.filter(a => planner.completedDays?.includes(a.dayNumber));
  
  // We don't track exact completion dates vs target dates yet, so we'll simulate 'catch up' 
  // by checking if there's a big gap or just return 0 for now.
  // We will assume all completed are on time for this basic version, unless we have completion timestamps.
  const onTimeRate = completedAssignments.length ? 100 : 0; 
  const catchUpDaysCount = 0;
  
  let totalReadPages = 0;
  completedAssignments.forEach(a => {
      let pages = 0;
      a.items.forEach(item => {
        if (item.pageStart && item.pageEnd) {
           pages += (item.pageEnd - item.pageStart + 1);
        }
      });
      totalReadPages += pages;
  });
  
  const avgUnitsPerDay = completedAssignments.length ? (totalReadPages / completedAssignments.length) : 0;
  
  return {
     onTimeRate,
     catchUpDaysCount,
     avgUnitsPerDay
  };
}

