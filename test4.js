import { rebalancePlanner, getReadingDate } from './planner_temp.js';

const today = new Date().toISOString().split('T')[0];

const dummyPlan = {
  assignments: [
    { dayNumber: 1, date: getReadingDate(today, 0, []), pageStart: 1, pageEnd: 20, items: [{pageStart: 1, pageEnd: 20, rangeValue: '1-20'}] },
    { dayNumber: 2, date: getReadingDate(today, 1, []), pageStart: 21, pageEnd: 40, items: [{pageStart: 21, pageEnd: 40, rangeValue: '21-40'}] },
    { dayNumber: 3, date: getReadingDate(today, 2, []), pageStart: 41, pageEnd: 60, items: [{pageStart: 41, pageEnd: 60, rangeValue: '41-60'}] }
  ],
  excludeDays: [],
  assignmentReadPages: {
    1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  assignmentProgress: {
    1: 0
  },
  completedDays: []
};

const newPlan = rebalancePlanner(dummyPlan, 'extend');
console.log("Original dates:");
dummyPlan.assignments.forEach(a => console.log(a.date));
console.log("\nNew dates:");
newPlan.assignments.forEach(a => console.log(a.date));
