import { create } from 'zustand';

/**
 * @typedef {Object} LeadData
 * @property {string} id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [company]
 * @property {string} [pipeline_stage]
 * @property {number} [pqi]
 */

/**
 * @typedef {'idle' | 'connecting' | 'ringing' | 'connected' | 'wrap_up' | 'ended' | 'failed'} CallState
 */

/**
 * Zustand store for managing call state
 */
const useCallStore = create((set, get) => ({
  /** @type {boolean} */
  isCallActive: false,
  
  /** @type {CallState} */
  callState: 'idle',
  
  /** @type {LeadData | null} */
  lead: null,
  
  /** @type {number} Duration in seconds */
  duration: 0,

  /** @type {NodeJS.Timeout | null} */
  timerInterval: null, // Added to store the interval ID

  /**
   * Starts a call with the given lead
   * @param {LeadData} lead 
   */
  startCall: (lead) => set({
    isCallActive: true,
    lead,
    callState: 'connecting',
    duration: 0
  }),

  /**
   * Updates the current call state
   * @param {CallState} state 
   */
  setCallState: (state) => set({ callState: state }),

  /**
   * Sets the timer interval ID. This is typically called by the component that manages the setInterval.
   * @param {NodeJS.Timeout | null} intervalId
   */
  setTimerInterval: (intervalId) => set({ timerInterval: intervalId }),

  /**
   * Resets the call duration timer
   */
  resetTimer: () => set({ duration: 0 }),

  /**
   * Increments the duration by 1 second
   */
  incrementDuration: () => set((state) => ({ duration: state.duration + 1 })),

  /**
   * Ends the current call and transitions to wrap-up
   */
  endCall: () => set({
    isCallActive: false,
    callState: 'wrap_up',
  }),

  /**
   * Clears all call-related state and stops any active timer.
   */
  clearCall: () => {
    const { timerInterval } = get(); // Get the current timerInterval from state
    if (timerInterval) {
      clearInterval(timerInterval); // Clear the interval if it exists
    }
    set({
      callState: 'idle',
      lead: null,
      duration: 0,
      timerInterval: null, // Reset timerInterval in state
      isCallActive: false,
    });
  }
}));

export default useCallStore;