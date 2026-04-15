import { state } from './state.js';
import { showCustomModal, switchView } from './ui-core.js';
import { appendLog } from './log-manager.js';

// --- Subscription Elements ---
const newSubNameInput = document.getElementById('newSubName');
const newSubUrlInput = document.getElementById('newSubUrl');
const addNewSubBtn = document.getElementById('addNewSubBtn');
const subAddResultEl = document.getElementById('subAddResult');
const subSettingsListEl = document.getElementById('subSettingsList');
const subListEl = document.getElementById('subList');

/**
 * Renders the subscription list in both the main view and settings view.
 */
export function renderSubList() {
  if (!subListEl && !subSettingsListEl) return;
  
  const generateHtml = (sub, isSettingsView) => {
    return `
      <input type="checkbox" class="sub-checkbox" ${sub.checked ? 'checked' : ''} ${isSettingsView ? 'style="display:none;"' : ''}>
      <div class="sub-info">
        <div class="sub-name" title="${sub.name}">${sub.name}</div>
        <div class="sub-url" title="${sub.url}">${sub.url}</div>
      </div>
      <div class="node-actions">
        <button class="node-btn edit-sub-btn btn-text-sm">${chrome.i18n.getMessage('btn_edit')}</button>
        <button class="node-btn delete-sub-btn btn-text-sm" style="color: #d93025;">${chrome.i18n.getMessage('btn_delete')}</button>
      </div>
    `;
  };

  const bindEvents = (item, sub) => {
    item.querySelector('.sub-checkbox')?.addEventListener('change', (e) => {
      sub.checked = e.target.checked;
      chrome.storage.local.set({ savedSubscriptions: state.savedSubscriptions });
    });
    item.querySelector('.edit-sub-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showCustomModal(chrome.i18n.getMessage('msg_sub_edit_title'), chrome.i18n.getMessage('msg_sub_edit_body'), (result) => {
        if (result && result.val1 && result.val2) {
          sub.name = result.val1.trim();
          sub.url = result.val2.trim();
          chrome.storage.local.set({ savedSubscriptions: state.savedSubscriptions }, renderSubList);
        }
      }, [{ label: chrome.i18n.getMessage('msg_sub_edit_name'), value: sub.name }, { label: chrome.i18n.getMessage('msg_sub_edit_url'), value: sub.url }]);
    });
    item.querySelector('.delete-sub-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showCustomModal(chrome.i18n.getMessage('msg_sub_delete_title'), chrome.i18n.getMessage('msg_sub_delete_body', [sub.name]), (confirmed) => {
        if (confirmed === true) {
          state.savedSubscriptions = state.savedSubscriptions.filter(s => s.id !== sub.id);
          chrome.storage.local.set({ savedSubscriptions: state.savedSubscriptions }, renderSubList);
        }
      });
    });
  };

  if (subListEl) {
    if (state.savedSubscriptions.length === 0) {
      subListEl.innerHTML = `<div class="empty-hint">${chrome.i18n.getMessage('msg_sub_empty_list')}</div>`;
    } else {
      subListEl.innerHTML = '';
      state.savedSubscriptions.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'sub-item';
        item.innerHTML = generateHtml(sub, false);
        bindEvents(item, sub);
        subListEl.appendChild(item);
      });
    }
  }

  if (subSettingsListEl) {
    if (state.savedSubscriptions.length === 0) {
      subSettingsListEl.innerHTML = `<div class="empty-hint">${chrome.i18n.getMessage('msg_sub_empty_settings')}</div>`;
    } else {
      subSettingsListEl.innerHTML = '';
      state.savedSubscriptions.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'sub-item';
        item.innerHTML = generateHtml(sub, true);
        bindEvents(item, sub);
        subSettingsListEl.appendChild(item);
      });
    }
  }
}

/**
 * Fetches and parses nodes from all checked subscriptions.
 * @param {string} appName 
 */
export async function handleUpdateSubscriptions(appName) {
  const selectedSubs = state.savedSubscriptions.filter(s => s.checked);
  if (selectedSubs.length === 0) {
    showCustomModal(chrome.i18n.getMessage('modal_default_title'), chrome.i18n.getMessage('msg_sub_empty_settings'), () => {});
    return;
  }

  // Note: unifiedAddBtn is managed by sidepanel.js or passed as a dependency. 
  // For now, we assume the UI state (loading spinner) is handled by the caller.
  
  switchView('homeView', appName);
  appendLog(chrome.i18n.getMessage('msg_sub_update_start', [selectedSubs.length]));

  for (const sub of selectedSubs) {
    appendLog(chrome.i18n.getMessage('msg_sub_pulling', [sub.name]));
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetch_subscription', url: sub.url });
      if (response.success) {
        let rawData = response.data.trim();
        let decodedLinks = '';
        try { decodedLinks = atob(rawData); } catch (e) { decodedLinks = rawData; }
        const lines = decodedLinks.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.length > 0);
        let subSuccessCount = 0;
        
        // Import parseNodeFromLink locally or via utils
        const { parseNodeFromLink } = await import('./utils.js');

        lines.forEach(line => {
          try {
            const newNode = parseNodeFromLink(line);
            newNode.fromSub = sub.name;
            state.savedNodes.unshift(newNode);
            subSuccessCount++;
          } catch (e) {}
        });
        if (subSuccessCount > 0) {
          appendLog(chrome.i18n.getMessage('msg_sub_success', [sub.name, subSuccessCount]));
          // We need to trigger a re-render of the node list in sidepanel.js
          // We'll use a custom event or a callback. For now, let's use a custom event.
          window.dispatchEvent(new CustomEvent('nodes-updated'));
        } else {
          appendLog(chrome.i18n.getMessage('msg_sub_empty', [sub.name]));
        }
      } else throw new Error(response.error);
    } catch (e) {
      appendLog(chrome.i18n.getMessage('msg_sub_error', [sub.name, e.message]));
    }
  }
  appendLog(chrome.i18n.getMessage('msg_sub_done'));
}

/**
 * Initializes the subscription manager and its event listeners.
 */
export function initSubManager() {
  if (addNewSubBtn) {
    addNewSubBtn.addEventListener('click', () => {
      const name = newSubNameInput?.value.trim();
      const url = newSubUrlInput?.value.trim();
      if (!name || !url) {
        showCustomModal(chrome.i18n.getMessage('modal_default_title'), chrome.i18n.getMessage('msg_sub_invalid_input'), () => {});
        return;
      }
      const newSub = {
        id: 'sub-' + Date.now(),
        name,
        url,
        checked: true
      };
      state.savedSubscriptions.push(newSub);
      chrome.storage.local.set({ savedSubscriptions: state.savedSubscriptions }, renderSubList);
      newSubNameInput.value = '';
      newSubUrlInput.value = '';
    });
  }
}
