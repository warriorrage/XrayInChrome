/**
 * Centralized state management for the sidepanel.
 */
export const state = {
  // Nodes state
  savedNodes: [],
  activeNodeId: null,
  
  // Subscription state
  savedSubscriptions: [],
  
  // UI state
  isLogPaused: false,
  currentFontSize: 12,
  
  // Settings comparison state
  originalSettings: {
    socks: 10808,
    http: 10809,
    proxyBrowser: false
  }
};
