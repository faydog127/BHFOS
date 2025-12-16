import { create } from 'zustand';

/**
 * @typedef {Object} CallHistoryEntry
 * @property {string} timestamp - ISO string timestamp of when the call ended
 * @property {string} leadId - The unique identifier of the lead
 * @property {string} leadName - The name of the lead
 * @property {string} result - The disposition or result of the call
 * @property {string} nextStep - The next action step selected
 * @property {number} durationSeconds - The duration of the call in seconds
 * @property {string} [pipelineStage] - Optional updated pipeline stage
 */

/**
 * Zustand store for managing session call history.
 * Keeps track of calls made during the current session.
 */
const useHistoryStore = create((set) => ({
  /** @type {CallHistoryEntry[]} */
  history: [],

  /**
   * Adds a new entry to the beginning of the history list.
   * @param {CallHistoryEntry} entry 
   */
  addEntry: (entry) => set((state) => ({
    history: [entry, ...state.history]
  })),

  /**
   * Clears all history entries.
   */
  clearHistory: () => set({ history: [] })
}));

export default useHistoryStore;