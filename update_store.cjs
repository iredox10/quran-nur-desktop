const fs = require('fs');
const filePath = '/home/iredox/Desktop/personal-apps/quran-app/src/store/useAppStore.js';
let content = fs.readFileSync(filePath, 'utf8');

// Add state
content = content.replace(
    /memorizedSurahs: \[\], \/\/ Array of chapter IDs/,
    "memorizedSurahs: [], // Array of chapter IDs\n            hifdhHistory: {}, // { [itemId]: { lastReviewed: timestamp, strength: 'strong'|'good'|'weak' } }\n            hifdhGoals: [], // Array of { id, targetType, targetId, targetDate, createdAt }"
);

// Add actions
const actionsToAdd = `
            logHifdhReview: (itemId, strength = 'strong') => set((state) => {
                const history = { ...(state.hifdhHistory || {}) };
                history[itemId] = { lastReviewed: Date.now(), strength };
                return { hifdhHistory: history };
            }),

            addHifdhGoal: (goal) => set((state) => ({
                hifdhGoals: [...(state.hifdhGoals || []), { ...goal, id: Date.now(), createdAt: Date.now() }]
            })),

            deleteHifdhGoal: (id) => set((state) => ({
                hifdhGoals: (state.hifdhGoals || []).filter(g => g.id !== id)
            })),
`;

content = content.replace(
    /toggleMemorizedSurah: \(chapterId\) => set\(\(state\) => \{/,
    actionsToAdd + "\n            toggleMemorizedSurah: (chapterId) => set((state) => {"
);

// Add to syncable state
content = content.replace(
    /memorizedSurahs: state\.memorizedSurahs \|\| \[\],/,
    "memorizedSurahs: state.memorizedSurahs || [],\n        hifdhHistory: state.hifdhHistory || {},\n        hifdhGoals: state.hifdhGoals || [],"
);

fs.writeFileSync(filePath, content);
console.log("Updated useAppStore.js");
