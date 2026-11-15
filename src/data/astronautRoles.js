/**
 * Astronaut roles, based on the real crew positions NASA uses.
 * Each role lists the real missions where that job exists.
 * Duties are simplified for kids; the game values are not NASA data.
 */
export const ROLES = [
  {
    id: 'commander',
    label: 'Commander',
    emoji: '🧑‍✈️',
    duty: 'Leads the crew and makes the final call when something goes wrong.',
    missions: ['Apollo 11', 'Space Shuttle', 'ISS Expeditions', 'Artemis II'],
    unique: true,
  },
  {
    id: 'pilot',
    label: 'Pilot',
    emoji: '🚀',
    duty: 'Flies the spacecraft and helps with launch, docking and landing.',
    missions: ['Space Shuttle', 'Artemis II', 'Crew Dragon'],
    unique: true,
  },
  {
    id: 'flight-engineer',
    label: 'Flight Engineer',
    emoji: '🛠️',
    duty: 'Keeps air, power, water and machines working, and fixes them when they break.',
    missions: ['ISS Expeditions', 'CHAPEA Mars analog'],
  },
  {
    id: 'mission-specialist',
    label: 'Mission Specialist',
    emoji: '🧑‍🔬',
    duty: 'Runs experiments, does spacewalks and looks after the equipment.',
    missions: ['Space Shuttle', 'Artemis II'],
  },
  {
    id: 'medical-officer',
    label: 'Medical Officer',
    emoji: '🩺',
    duty: 'Takes care of the crew’s health, from check-ups to emergencies.',
    missions: ['ISS Expeditions', 'CHAPEA Mars analog'],
  },
  {
    id: 'science-officer',
    label: 'Science Officer',
    emoji: '🔬',
    duty: 'Plans the research, from growing plants to studying rocks and soil.',
    missions: ['CHAPEA Mars analog', 'ISS Expeditions'],
  },
];

export const DEFAULT_ROLE = 'commander';

export const getRole = (id) => ROLES.find((r) => r.id === id) || null;
export const roleLabel = (id) => getRole(id)?.label || 'Astronaut';
