import { rebalancePlanner, getReadingDate } from './src/utils/planner.js';

const today = new Date().toISOString().split('T')[0];

const dummyPlan = {
  assignments: [
    { dayNumber: 1, date: today, pageStart: 1, pageEnd: 20, items: [{pageStart: 1, pageEnd: 20}] },
    { dayNumber: 2, date: getReadingDate(today, 1, []), pageStart: 21, pageEnd: 40, items: [{pageStart: 21, pageEnd: 40}] },
    { dayNumber: 3, date: getReadingDate(today, 2, []), pageStart: 41, pageEnd: 60, items: [{pageStart: 41, pageEnd: 60}] }
  ],
  excludeDays: [],
  assignmentCompletedItems: {
    1: []
  },
  assignmentProgress: {
    1: 0
  }
};

const newPlan = rebalancePlanner(dummyPlan, 'extend');
console.log(JSON.stringify(newPlan.assignments, null, 2));
