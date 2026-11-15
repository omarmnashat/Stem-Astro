/**
 * Tiny event bus that lets the 3D world (and the calculator) tell the daily-mission
 * tracker what the player just did, without passing callbacks through every component.
 *
 * kinds: 'drive' (metres), 'dig', 'rock', 'buy', 'deploy', 'harvest', 'capsule', 'calc'
 * Quick actions (boostOxygen, recycleWater, greenhouse, cleanPanels, shield, experiment,
 * rest, sampleReturn) are also reported with their action id.
 */
export const MISSION_EVENT = 'exolife_mission_event';

export function emitMissionEvent(kind, amount = 1) {
  try {
    window.dispatchEvent(new CustomEvent(MISSION_EVENT, { detail: { kind, amount } }));
  } catch {
    // Non-browser environment (tests) – nothing to do.
  }
}
