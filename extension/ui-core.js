import { state } from './state.js';

// --- UI Elements ---
export const menuBtn = document.getElementById('menuBtn');
export const navDrawer = document.getElementById('navDrawer');
export const overlay = document.getElementById('overlay');
export const navLinks = document.querySelectorAll('.nav-link');
export const views = document.querySelectorAll('.view');
export const viewTitle = document.getElementById('viewTitle');

export const customModal = document.getElementById('customModal');
export const modalTitle = document.getElementById('modalTitle');
export const modalBody = document.getElementById('modalBody');
export const modalInputArea = document.getElementById('modalInputArea');
export const modalField1 = document.getElementById('modalField1');
export const modalField2 = document.getElementById('modalField2');
export const modalInput1 = document.getElementById('modalInput1');
export const modalInput2 = document.getElementById('modalInput2');
export const label1 = document.getElementById('label1');
export const label2 = document.getElementById('label2');
export const modalConfirmBtn = document.getElementById('modalConfirmBtn');
export const modalCancelBtn = document.getElementById('modalCancelBtn');

/**
 * Applies i18n translations to elements with [data-i18n] and [data-i18n-title].
 */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const message = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (message) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = message;
      } else {
        el.innerHTML = message;
      }
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const message = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
    if (message) {
      el.title = message;
    }
  });
}

/**
 * Updates the view title based on the active navigation link.
 * @param {string} appName 
 */
export function updateViewTitle(appName) {
  const activeLink = document.querySelector('.nav-link.active');
  if (!activeLink) return;
  const translatedName = chrome.i18n.getMessage(activeLink.getAttribute('data-i18n'));
  viewTitle.textContent = `${translatedName} - ${appName}`;
}

/**
 * Toggles the navigation drawer and overlay.
 */
export function toggleMenu() {
  navDrawer.classList.toggle('open');
  overlay.classList.toggle('visible');
}

/**
 * Switches the active view and updates navigation styling.
 * @param {string} viewId 
 * @param {string} appName 
 */
export function switchView(viewId, appName) {
  views.forEach(view => {
    if (view.id === viewId) view.classList.add('active');
    else view.classList.remove('active');
  });
  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
      const translatedName = chrome.i18n.getMessage(link.getAttribute('data-i18n'));
      viewTitle.textContent = `${translatedName} - ${appName}`;
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Shows a custom modal dialog.
 * @param {string} title 
 * @param {string} body 
 * @param {Function} onConfirm 
 * @param {Array} fields 
 */
export function showCustomModal(title, body, onConfirm, fields = null) {
  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  if (fields && fields.length > 0) {
    modalInputArea.style.display = 'block';
    modalField1.style.display = 'block';
    label1.textContent = fields[0].label;
    modalInput1.value = fields[0].value || '';
    if (fields.length > 1) {
      modalField2.style.display = 'block';
      label2.textContent = fields[1].label;
      modalInput2.value = fields[1].value || '';
    } else modalField2.style.display = 'none';
  } else modalInputArea.style.display = 'none';
  customModal.classList.add('visible');
  const cleanup = () => {
    customModal.classList.remove('visible');
    modalConfirmBtn.onclick = null;
    modalCancelBtn.onclick = null;
  };
  modalConfirmBtn.onclick = () => {
    let result;
    if (fields) {
      if (fields.length > 1) result = { val1: modalInput1.value, val2: modalInput2.value };
      else result = modalInput1.value;
    } else result = true;
    onConfirm(result);
    cleanup();
  };
  modalCancelBtn.onclick = cleanup;
}
