import fs from 'fs';
const plannerCode = fs.readFileSync('./src/utils/planner.js', 'utf-8');
const modified = plannerCode.replace(
  "import { HIZB_STARTS, JUZ_STARTS, PAGE_GROUPS } from '../data/quranNavigation';",
  "const HIZB_STARTS=[]; const JUZ_STARTS=[]; const PAGE_GROUPS=[];"
);
fs.writeFileSync('./planner_temp.js', modified);
