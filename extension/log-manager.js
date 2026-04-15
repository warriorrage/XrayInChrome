import { state } from './state.js';

// --- Log Elements ---
const outputEl = document.getElementById('output');
const clearLogBtn = document.getElementById('clearLogBtn');
const pauseLogBtn = document.getElementById('pauseLogBtn');
const copyLogBtn = document.getElementById('copyLogBtn');
const fontPlusBtn = document.getElementById('fontPlusBtn');
const fontMinusBtn = document.getElementById('fontMinusBtn');

/**
 * Appends a message to the log output area.
 * Handles line limiting and auto-scrolling.
 * @param {string} message 
 */
export function appendLog(message) {
  if (!outputEl) return;

  if (!state.isLogPaused) {
    outputEl.textContent += message + String.fromCharCode(10);
    const lines = outputEl.textContent.split(String.fromCharCode(10));
    if (lines.length > 500) {
      outputEl.textContent = lines.slice(lines.length - 500).join(String.fromCharCode(10));
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

/**
 * Initializes the log manager and its event listeners.
 */
export function initLogManager() {
  if (!outputEl) return;

  // Apply initial font size
  outputEl.style.fontSize = state.currentFontSize + 'px';

  clearLogBtn?.addEventListener('click', () => { 
    outputEl.textContent = ''; 
  });

  pauseLogBtn?.addEventListener('click', () => { 
    state.isLogPaused = !state.isLogPaused; 
    pauseLogBtn.textContent = state.isLogPaused ? chrome.i18n.getMessage('btn_log_resume') : chrome.i18n.getMessage('btn_log_pause');
    const msg = state.isLogPaused ? chrome.i18n.getMessage('msg_log_paused') : chrome.i18n.getMessage('msg_log_resumed');
    appendLog(msg);
  });

  copyLogBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(outputEl.textContent).then(() => {
      const originalText = copyLogBtn.textContent; 
      copyLogBtn.textContent = chrome.i18n.getMessage('msg_log_copied');
      setTimeout(() => { copyLogBtn.textContent = originalText; }, 1500);
    });
  });

  fontPlusBtn?.addEventListener('click', () => {
    state.currentFontSize += 1;
    if (state.currentFontSize > 30) state.currentFontSize = 30;
    outputEl.style.fontSize = state.currentFontSize + 'px';
    chrome.storage.local.set({ logFontSize: state.currentFontSize });
  });

  fontMinusBtn?.addEventListener('click', () => {
    state.currentFontSize -= 1;
    if (state.currentFontSize < 8) state.currentFontSize = 8;
    outputEl.style.fontSize = state.currentFontSize + 'px';
    chrome.storage.local.set({ logFontSize: state.currentFontSize });
  });
}
