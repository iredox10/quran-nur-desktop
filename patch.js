import fs from 'fs';

const plannerPath = 'src/utils/planner.js';
const content = fs.readFileSync(plannerPath, 'utf8');
const scratchPath = 'scratch_planner.js';
const scratchContent = fs.readFileSync(scratchPath, 'utf8');

// The lines we want to replace start with "export function adjustPlannerPace" and end at the end of "export function redistributeMissedAssignments"
const startIndex = content.indexOf('export function adjustPlannerPace');
const endIndexStr = 'export function getPlannerPageContext';
const endIndex = content.indexOf(endIndexStr);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find start or end index!');
    process.exit(1);
}

const newContent = content.substring(0, startIndex) + scratchContent + '\n' + content.substring(endIndex);

fs.writeFileSync(plannerPath, newContent, 'utf8');
console.log('Successfully patched planner.js');
