import { describe, it, expect } from 'vitest';
import { groupContiguousPages, rebalancePlanner, adjustPlannerPace } from './planner';

describe('groupContiguousPages', () => {
    it('groups single contiguous sequence', () => {
        expect(groupContiguousPages([1, 2, 3])).toEqual([{ pStart: 1, pEnd: 3 }]);
    });
    
    it('groups multiple sequences with gaps', () => {
        expect(groupContiguousPages([1, 2, 5, 6, 9])).toEqual([
            { pStart: 1, pEnd: 2 },
            { pStart: 5, pEnd: 6 },
            { pStart: 9, pEnd: 9 }
        ]);
    });
    
    it('handles out of order and duplicates', () => {
        expect(groupContiguousPages([5, 1, 2, 5, 6, 2])).toEqual([
            { pStart: 1, pEnd: 2 },
            { pStart: 5, pEnd: 6 }
        ]);
    });
});

describe('rebalancePlanner', () => {
    it('preserves read portions and creates non-overlapping new assignments', () => {
        const mockPlanner = {
            id: 'mock-1',
            startDate: '2026-01-01',
            durationDays: 1,
            unitType: 'page',
            excludeDays: [],
            assignments: [
                {
                    dayNumber: 1,
                    date: '2026-01-01',
                    unitType: 'page',
                    pageStart: 1,
                    pageEnd: 10,
                    items: [{ rangeValue: '1-10', pageStart: 1, pageEnd: 10 }]
                }
            ],
            assignmentProgress: { 1: 0 }, 
            assignmentReadPages: { 1: [1, 2, 5] }, 
            assignmentCompletedItems: {},
            assignmentCompletedAt: {},
            completedDays: [] 
        };
        
        const rebalanced = rebalancePlanner(mockPlanner, 'extend');
        
        const preservedDay = rebalanced.assignments[0];
        expect(preservedDay._wasComplete).toBeUndefined(); 
        expect(preservedDay.items.length).toBe(2);
        expect(preservedDay.items[0].pageStart).toBe(1);
        expect(preservedDay.items[0].pageEnd).toBe(2);
        expect(preservedDay.items[1].pageStart).toBe(5);
        expect(preservedDay.items[1].pageEnd).toBe(5);
        
        const newDay = rebalanced.assignments[1];
        expect(newDay.items.length).toBe(2); 
        expect(newDay.items[0].pageStart).toBe(3);
        expect(newDay.items[0].pageEnd).toBe(4);
        expect(newDay.items[1].pageStart).toBe(6);
        expect(newDay.items[1].pageEnd).toBe(10);
    });
});
