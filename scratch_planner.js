export function groupContiguousPages(pagesArray) {
    if (!pagesArray || !pagesArray.length) return [];
    const sorted = [...new Set(pagesArray.map(Number))].sort((a, b) => a - b);
    const groups = [];
    let pStart = sorted[0];
    let pEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === pEnd + 1) {
            pEnd = sorted[i];
        } else {
            groups.push({ pStart, pEnd });
            pStart = sorted[i];
            pEnd = sorted[i];
        }
    }
    groups.push({ pStart, pEnd });
    return groups;
}

export function adjustPlannerPace(planner, newDurationDays) {
    return rebalancePlanner(planner, 'custom_pace', newDurationDays);
}

export function rebalancePlanner(planner, strategy, customDurationDays = null) {
    const today = formatPlannerDate(new Date());
    const excludeDays = planner.excludeDays || [];
    
    const preservedAssignments = [];
    const unreadPagePool = [];
    
    planner.assignments.forEach(a => {
        const prog = getAssignmentProgress(planner, a);
        
        if (prog.isComplete) {
            preservedAssignments.push({ ...a, _wasComplete: true });
            return;
        }
        
        const explicitReadPages = Array.isArray(planner?.assignmentReadPages?.[a.dayNumber])
            ? planner.assignmentReadPages[a.dayNumber]
            : [];
        const readPages = [];
        const unreadPages = [];
        
        a.items.forEach(item => {
            const pStart = item.pageStart || 1;
            const pEnd = item.pageEnd || pStart;
            for (let p = pStart; p <= pEnd; p++) {
                if (explicitReadPages.includes(p) || prog.completedRangeValues?.includes(item.rangeValue)) {
                    readPages.push(p);
                } else {
                    unreadPages.push(p);
                }
            }
        });
        
        if (readPages.length > 0 && unreadPages.length > 0) {
            const readGroups = groupContiguousPages(readPages);
            const preservedItems = readGroups.map(grp => ({
                title: `Pages ${grp.pStart}-${grp.pEnd}`,
                subtitle: `${grp.pEnd - grp.pStart + 1} pages`,
                route: `/planner/read/${a.dayNumber}`,
                rangeValue: `${grp.pStart}-${grp.pEnd}`,
                pageStart: grp.pStart,
                pageEnd: grp.pEnd,
            }));
            const aStart = readGroups[0].pStart;
            const aEnd = readGroups[readGroups.length - 1].pEnd;
            
            preservedAssignments.push({
                ...a,
                _wasComplete: true,
                unitType: 'page',
                title: `Pages ${aStart}-${aEnd}`,
                subtitle: `${readPages.length} pages (Read)`,
                startUnit: aStart,
                endUnit: aEnd,
                pageStart: aStart,
                pageEnd: aEnd,
                items: preservedItems,
            });
            unreadPagePool.push(...unreadPages);
        } else if (readPages.length > 0) {
            preservedAssignments.push({ ...a, _wasComplete: true });
        } else {
            unreadPagePool.push(...unreadPages);
        }
    });
    
    if (!unreadPagePool.length) return planner;
    
    let newChunkAssignments = [];
    
    if (strategy === 'extend' || strategy === 'custom_pace') {
        let chunkSize = 1;
        if (strategy === 'custom_pace' && customDurationDays != null) {
            const remainingNewDays = Math.max(1, customDurationDays - preservedAssignments.length);
            chunkSize = Math.ceil(unreadPagePool.length / remainingNewDays);
        } else {
            const originalDaySize = Math.ceil(
                planner.assignments.reduce((sum, a) => {
                    let dayPages = 0;
                    a.items.forEach(item => {
                        dayPages += (item.pageEnd || 0) - (item.pageStart || 0) + 1;
                    });
                    return sum + dayPages;
                }, 0) / planner.assignments.length
            );
            chunkSize = Math.max(originalDaySize, 1);
        }
        
        for (let i = 0; i < unreadPagePool.length; i += chunkSize) {
            const chunk = unreadPagePool.slice(i, i + chunkSize);
            const groups = groupContiguousPages(chunk);
            const pStart = chunk[0];
            const pEnd = chunk[chunk.length - 1];
            
            newChunkAssignments.push({
                unitType: 'page',
                title: `Pages ${pStart}-${pEnd}`,
                subtitle: `${chunk.length} pages`,
                startUnit: pStart,
                endUnit: pEnd,
                pageStart: pStart,
                pageEnd: pEnd,
                items: groups.map(grp => ({
                    title: `Pages ${grp.pStart}-${grp.pEnd}`,
                    subtitle: `${grp.pEnd - grp.pStart + 1} pages`,
                    rangeValue: `${grp.pStart}-${grp.pEnd}`,
                    pageStart: grp.pStart,
                    pageEnd: grp.pEnd,
                })),
            });
        }
    } else if (strategy === 'spread') {
        const originalEndDate = planner.assignments[planner.assignments.length - 1].date;
        if (today > originalEndDate) {
            return rebalancePlanner(planner, 'extend');
        }
        
        let remainingDays = 0;
        let curr = today;
        while (curr <= originalEndDate) {
            const d = new Date(`${curr}T00:00:00`);
            if (!excludeDays.includes(d.getDay())) {
                remainingDays++;
            }
            curr = addDays(curr, 1);
        }
        if (remainingDays <= 0) remainingDays = 1;
        
        const pagesPerDay = Math.ceil(unreadPagePool.length / remainingDays);
        for (let i = 0; i < remainingDays; i++) {
            const chunk = unreadPagePool.slice(i * pagesPerDay, (i + 1) * pagesPerDay);
            if (!chunk.length) break;
            
            const groups = groupContiguousPages(chunk);
            const pStart = chunk[0];
            const pEnd = chunk[chunk.length - 1];
            
            newChunkAssignments.push({
                unitType: 'page',
                title: `Pages ${pStart}-${pEnd}`,
                subtitle: `${chunk.length} pages`,
                startUnit: pStart,
                endUnit: pEnd,
                pageStart: pStart,
                pageEnd: pEnd,
                items: groups.map(grp => ({
                    title: `Pages ${grp.pStart}-${grp.pEnd}`,
                    subtitle: `${grp.pEnd - grp.pStart + 1} pages`,
                    rangeValue: `${grp.pStart}-${grp.pEnd}`,
                    pageStart: grp.pStart,
                    pageEnd: grp.pEnd,
                })),
            });
        }
    } else {
        return planner;
    }
    
    const mergedRaw = [...preservedAssignments, ...newChunkAssignments];
    
    let lastPreservedDate = null;
    preservedAssignments.forEach(a => {
        if (!lastPreservedDate || a.date > lastPreservedDate) {
            lastPreservedDate = a.date;
        }
    });
    
    let hasPartialToday = false;
    planner.assignments.forEach(a => {
        const prog = getAssignmentProgress(planner, a);
        if (prog.isComplete) return;
        
        const explicitReadPages = Array.isArray(planner?.assignmentReadPages?.[a.dayNumber])
            ? planner.assignmentReadPages[a.dayNumber]
            : [];
        let readPages = []; let unreadPages = [];
        
        a.items.forEach(item => {
            const pStart = item.pageStart || 1;
            const pEnd = item.pageEnd || pStart;
            for (let p = pStart; p <= pEnd; p++) {
                if (explicitReadPages.includes(p) || prog.completedRangeValues?.includes(item.rangeValue)) {
                    readPages.push(p);
                } else {
                    unreadPages.push(p);
                }
            }
        });
        
        if (readPages.length > 0 && unreadPages.length > 0 && a.date === today) {
            hasPartialToday = true;
        }
    });
    
    let newStartDate = today;
    if (strategy === 'extend' || strategy === 'custom_pace') {
        if (lastPreservedDate) {
            newStartDate = addDays(lastPreservedDate, 1);
            if (hasPartialToday) newStartDate = today;
            if (newStartDate < today) newStartDate = today;
        }
    }
    
    const newAssignmentProgress = {};
    const newAssignmentReadPages = {};
    const newAssignmentCompletedItems = {};
    const newAssignmentCompletedAt = {};
    const newCompletedDays = [];
    
    let nextDayNumber = 1;
    let newDayIndex = 0;
    
    const finalAssignments = mergedRaw.map(a => {
        const dn = nextDayNumber;
        const oldDayNumber = a.dayNumber;
        const isPreserved = a._wasComplete;
        
        const mapped = { ...a, dayNumber: dn };
        delete mapped._wasComplete;
        
        mapped.primaryRoute = `/planner/read/${dn}`;
        if (mapped.items) {
            mapped.items = mapped.items.map(it => ({ ...it, route: `/planner/read/${dn}` }));
        }
        
        if (isPreserved && oldDayNumber != null) {
            if (planner.assignmentProgress?.[oldDayNumber] != null) {
                newAssignmentProgress[dn] = planner.assignmentProgress[oldDayNumber];
            }
            if (planner.assignmentReadPages?.[oldDayNumber]) {
                newAssignmentReadPages[dn] = planner.assignmentReadPages[oldDayNumber];
            }
            if (planner.assignmentCompletedItems?.[oldDayNumber]) {
                newAssignmentCompletedItems[dn] = planner.assignmentCompletedItems[oldDayNumber];
            }
            if (planner.assignmentCompletedAt?.[oldDayNumber]) {
                newAssignmentCompletedAt[dn] = planner.assignmentCompletedAt[oldDayNumber];
            }
            if (planner.completedDays?.includes(oldDayNumber)) {
                newCompletedDays.push(dn);
            }
            if (!planner.completedDays?.includes(oldDayNumber) && isPreserved) {
                newAssignmentProgress[dn] = mapped.items.length;
                newAssignmentCompletedItems[dn] = mapped.items.map(it => it.rangeValue);
                newAssignmentCompletedAt[dn] = today;
                newCompletedDays.push(dn);
            }
        } else {
            mapped.date = getReadingDate(newStartDate, newDayIndex, excludeDays);
            newDayIndex++;
        }
        
        nextDayNumber++;
        return mapped;
    });
    
    return {
        ...planner,
        durationDays: finalAssignments.length,
        assignments: finalAssignments,
        assignmentProgress: newAssignmentProgress,
        assignmentReadPages: newAssignmentReadPages,
        assignmentCompletedItems: newAssignmentCompletedItems,
        assignmentCompletedAt: newAssignmentCompletedAt,
        completedDays: newCompletedDays,
    };
}
