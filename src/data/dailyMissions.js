/**
 * ExoLife – 7-day mission plan.
 *
 * Every sol has a title, a short briefing and 3–4 tasks. A task finishes when the
 * matching counter (see utils/missionEvents.js) reaches `target` during that sol.
 * Rewards are Astro Coins (fictional gameplay currency).
 */
export const TASK_REWARD = 12;
export const DAY_CLEAR_BONUS = 30;

export const DAILY_MISSIONS = {
  1: {
    title: 'Touchdown & First Steps',
    brief: 'Learn to drive your rover and collect your first samples.',
    tasks: [
      { id: 'drive', kind: 'drive', target: 30, text: 'Drive the rover 30 m (WASD / arrow keys)' },
      { id: 'dig', kind: 'dig', target: 3, text: 'Dig soil 3 times with [F]' },
      { id: 'rock', kind: 'rock', target: 1, text: 'Scan 1 mineral rock with [E]' },
      { id: 'calc', kind: 'calc', target: 1, text: 'Open Nova (AI assistant) and calculate your weight here' },
    ],
  },
  2: {
    title: 'Build Life Support',
    brief: 'Oxygen and water keep the crew alive. Build machines for both.',
    tasks: [
      { id: 'buy', kind: 'buy', target: 2, text: 'Buy 2 items in the Store (Bio-Dome, Water Processor…)' },
      { id: 'deploy', kind: 'deploy', target: 2, text: 'Deploy 2 modules with Build mode' },
      { id: 'o2', kind: 'boostOxygen', target: 1, text: 'Run the Oxygen Generator once' },
      { id: 'h2o', kind: 'recycleWater', target: 1, text: 'Recycle Water once' },
    ],
  },
  3: {
    title: 'Power Management',
    brief: 'Electricity runs everything. Make it and save it.',
    tasks: [
      { id: 'dig', kind: 'dig', target: 4, text: 'Dig soil 4 times (try a fresh patch of ground)' },
      { id: 'solar', kind: 'cleanPanels', target: 1, text: 'Clean the Solar Panels' },
      { id: 'drive', kind: 'drive', target: 60, text: 'Explore: drive 60 m in total' },
      { id: 'calc', kind: 'calc', target: 2, text: 'Use the Calculator twice (try Power & Oxygen formulas)' },
    ],
  },
  4: {
    title: 'Night / Storm Survival',
    brief: 'Sunlight is low today. Save power and protect the crew.',
    tasks: [
      { id: 'harvest', kind: 'harvest', target: 1, text: 'Harvest the Bio-Dome with [E] for oxygen & food' },
      { id: 'rest', kind: 'rest', target: 1, text: 'Crew Rest & Exercise once' },
      { id: 'shield', kind: 'shield', target: 1, text: 'Strengthen Shielding once' },
      { id: 'rock', kind: 'rock', target: 2, text: 'Scan 2 mineral rocks with [E]' },
    ],
  },
  5: {
    title: 'Solar Storm & Radiation',
    brief: 'Space weather can be dangerous. Shield up and keep working.',
    tasks: [
      { id: 'shield', kind: 'shield', target: 1, text: 'Strengthen Shielding before the storm hits' },
      { id: 'dig', kind: 'dig', target: 4, text: 'Dig soil 4 times' },
      { id: 'buy', kind: 'buy', target: 1, text: 'Buy 1 upgrade or item in the Store' },
      { id: 'calc', kind: 'calc', target: 1, text: 'Calculate radio delay to Earth in the Calculator' },
    ],
  },
  6: {
    title: 'Science & Sample Return',
    brief: 'Send your best samples home to Earth labs.',
    tasks: [
      { id: 'exp', kind: 'experiment', target: 1, text: 'Run a Science Experiment' },
      { id: 'rock', kind: 'rock', target: 2, text: 'Scan 2 mineral rocks with [E]' },
      { id: 'capsule', kind: 'capsule', target: 1, text: 'Return samples at the Lander (launch the capsule)' },
      { id: 'drive', kind: 'drive', target: 80, text: 'Drive 80 m in total while searching for samples' },
    ],
  },
  7: {
    title: 'Final Survival Challenge',
    brief: 'Bring it all together and finish the mission!',
    tasks: [
      { id: 'o2', kind: 'boostOxygen', target: 1, text: 'Run the Oxygen Generator' },
      { id: 'h2o', kind: 'recycleWater', target: 1, text: 'Recycle Water' },
      { id: 'capsule', kind: 'capsule', target: 1, text: 'Launch one last sample capsule to Earth' },
      { id: 'dig', kind: 'dig', target: 3, text: 'Dig soil 3 times for the final report' },
    ],
  },
};

export function getDailyMission(day) {
  return DAILY_MISSIONS[Math.min(7, Math.max(1, day))] || DAILY_MISSIONS[1];
}
