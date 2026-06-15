import { rebalancePlanner, getReadingDate } from './planner_temp.js';

const today = new Date().toISOString().split('T')[0];

const dummyPlan = {
  assignments: [
    { dayNumber: 1, date: "2026-06-14", pageStart: 1, pageEnd: 20, items: [{pageStart: 1, pageEnd: 20, rangeValue: '1-20'}] },
    { dayNumber: 2, date: "2026-06-15", pageStart: 21, pageEnd: 40, items: [{pageStart: 21, pageEnd: 40, rangeValue: '21-40'}] },
    { dayNumber: 3, date: "2026-06-16", pageStart: 41, pageEnd: 60, items: [{pageStart: 41, pageEnd: 60, rangeValue: '41-60'}] }
  ],
  excludeDays: [],
  assignmentReadPages: {},
  assignmentProgress: {},
  completedDays: []
};

// I will modify planner_temp.js to include the clamping logic
import fs from 'fs';
let plannerCode = fs.readFileSync('./planner_temp.js', 'utf-8');

plannerCode = plannerCode.replace(
  "const newStartDate = strategy === 'spread' ? today : (lastPreservedDate ? addDays(lastPreservedDate, 1) : today);",
  `let hasPartialToday = false;
    planner.assignments.forEach(a => {
        const prog = getAssignmentProgress(planner, a);
        if (prog.isComplete) return;
        const explicitReadPages = Array.isArray(planner?.assignmentReadPages?.[a.dayNumber]) ? planner.assignmentReadPages[a.dayNumber] : [];
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
    if (strategy === 'extend') {
        if (lastPreservedDate) {
            newStartDate = addDays(lastPreservedDate, 1);
            if (hasPartialToday) newStartDate = today;
            if (newStartDate < today) newStartDate = today;
        }
    }`
);
fs.writeFileSync('./planner_temp_mod.js', plannerCode);
