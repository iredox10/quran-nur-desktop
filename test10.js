const total = 1;
const numSlots = 5;
const items = [{rangeValue: 'juz-1'}];
const activePrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const completedRangeValues = [];

let slots = activePrayers.map((name, i) => {
    const slotEnd = Math.ceil(((i + 1) / numSlots) * total);
    const slotStart = Math.ceil((i / numSlots) * total);
    const slotItems = items.slice(slotStart, slotEnd);
    const count = Math.max(slotEnd - slotStart, 0);
    const doneInSlot = slotItems.filter(item => completedRangeValues.includes(item.rangeValue)).length;
    const isComplete = count > 0 && doneInSlot >= count;
    const isCurrent = count > 0 && !isComplete && doneInSlot > 0;
    
    return { name, count, doneInSlot, isComplete, isCurrent };
}).filter(s => s.count > 0);

const firstIncomplete = slots.findIndex(s => !s.isComplete);
if (firstIncomplete !== -1 && !slots[firstIncomplete].isCurrent) {
    slots[firstIncomplete].isCurrent = true;
}

console.log(slots);
