import { rebalancePlanner, getReadingDate } from './planner_temp_mod.js';
const today = new Date().toISOString().split('T')[0];
const dummyPlan = {
  assignments: [
    { dayNumber: 1, date: "2026-06-14", pageStart: 1, pageEnd: 20, items: [{pageStart: 1, pageEnd: 20, rangeValue: '1-20'}] },
    { dayNumber: 2, date: "2026-06-15", pageStart: 21, pageEnd: 40, items: [{pageStart: 21, pageEnd: 40, rangeValue: '21-40'}] },
    { dayNumber: 3, date: "2026-06-16", pageStart: 41, pageEnd: 60, items: [{pageStart: 41, pageEnd: 60, rangeValue: '41-60'}] }
  ],
  excludeDays: [],
  assignmentReadPages: { 2: [21, 22, 23] }, // partially read today
  assignmentProgress: { 1: 1 }, // fully read yesterday
  completedDays: [1] // completed yesterday
};

const newPlan = rebalancePlanner(dummyPlan, 'extend');
console.log("Properly Completed Day 1 Dates:");
newPlan.assignments.forEach(a => console.log(a.date));
