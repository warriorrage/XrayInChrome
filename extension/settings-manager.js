import { state } from './state.js';
import { showCustomModal } from './ui-core.js';

// --- Settings Elements ---
const socksPortInput = document.getElementById('socksPort');
const httpPortInput = document.getElementById('httpPort');
const proxyBrowserCheckbox = document.getElementById('proxyBrowserCheckbox');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const saveProxyBtn = document.getElementById('saveProxyBtn');

/**
 * Updates the visual state (disabled/enabled) of the save buttons
 * by comparing current input values with the original settings.
 */
export function updateSaveBtnState() {
  if (!socksPortInput || !httpPortInput || !proxyBrowserCheckbox) return;

  const currentSocks = parseInt(socksPortInput.value) || 10808;
  const currentHttp = parseInt(httpPortInput.value) || 10809;
  const currentProxy = proxyBrowserCheckbox.checked;

  const portsChanged = currentSocks !== state.originalSettings.socks || 
                        currentHttp !== state.originalSettings.http;
  
  if (saveSettingsBtn) {
    saveSettingsBtn.disabled = !portsChanged;
    saveSettingsBtn.style.opacity = portsChanged ? '1' : '0.5';
    saveSettingsBtn.style.cursor = portsChanged ? 'pointer' : 'not-allowed';
  }

  const proxyChanged = currentProxy !== state.originalSettings.proxyBrowser;
  if (saveProxyBtn) {
    saveProxyBtn.disabled = !proxyChanged;
    saveProxyBtn.style.opacity = proxyChanged ? '1' : '0.5';
    saveProxyBtn.style.cursor = proxyChanged ? 'pointer' : 'not-allowed';
  }
}

/**
 * Initializes the settings manager and its event listeners.
 */
export function initSettingsManager(initialSettings) {
  if (!socksPortInput || !httpPortInput || !proxyBrowserCheckbox) return;

  // Sync initial values from state/storage to DOM
  socksPortInput.value = initialSettings.socks || 10808;
  httpPortInput.value = initialSettings.http || 10809;
  proxyBrowserCheckbox.checked = initialSettings.proxyBrowser || false;
  updateSaveBtnState();

  // Input listeners to trigger state check
  [socksPortInput, httpPortInput, proxyBrowserCheckbox].forEach(el => {
    el.addEventListener('input', updateSaveBtnState);
    el.addEventListener('change', updateSaveBtnState);
  });

  // Save Port Settings
  saveSettingsBtn?.addEventListener('click', () => {
    const socksPort = parseInt(socksPortInput.value) || 10808;
    const httpPort = parseInt(httpPortInput.value) || 10809;
    chrome.storage.local.set({ socksPort, httpPort }, () => {
      state.originalSettings.socks = socksPort;
      state.originalSettings.http = httpPort;
      updateSaveBtnState();
      const resultEl = document.getElementById('saveSettingsResult');
      if (resultEl) {
        const resultMsg = chrome.i18n.getMessage('msg_settings_saved');
        resultEl.textContent = resultMsg;
        resultEl.style.color = '#188038';
        setTimeout(() => { resultEl.textContent = ''; }, 3000);
      }
    });
  });

  // Save Proxy Browser Toggle
  saveProxyBtn?.addEventListener('click', () => {
    const shouldProxy = proxyBrowserCheckbox.checked;
    const socksPort = parseInt(socksPortInput.value) || 10808;
    const applyProxy = () => {
      chrome.storage.local.set({ proxyBrowser: shouldProxy }, () => {
        state.originalSettings.proxyBrowser = shouldProxy;
        updateSaveBtnState();
        if (shouldProxy) {
          const config = {
            mode: "fixed_servers",
            rules: {
              singleProxy: { scheme: "socks5", host: "127.0.0.1", port: socksPort },
              bypassList: ["localhost", "127.0.0.1", "[::1]"]
            }
          };
          chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
            showCustomModal(chrome.i18n.getMessage('modal_confirm_title'), chrome.i18n.getMessage('msg_proxy_success', [socksPort]), () => {});
          });
        } else {
          chrome.proxy.settings.clear({ scope: 'regular' }, () => {
            showCustomModal(chrome.i18n.getMessage('modal_confirm_title'), chrome.i18n.getMessage('msg_proxy_cancelled'), () => {});
          });
        }
      });
    };
    if (shouldProxy) {
      chrome.proxy.settings.get({}, (current) => {
        let currentStatus = chrome.i18n.getMessage('msg_proxy_status_direct');
        if (current.levelOfControl === 'controlled_by_other_extensions') currentStatus = chrome.i18n.getMessage('msg_proxy_status_other_ext');
        else if (current.value.mode === 'system') currentStatus = chrome.i18n.getMessage('msg_proxy_status_system');
        else if (current.value.mode === 'fixed_servers' || current.value.mode === 'pac_script') {
          if (current.levelOfControl === 'controlled_by_this_extension') { applyProxy(); return; }
          currentStatus = chrome.i18n.getMessage('msg_proxy_status_manual');
        }
        showCustomModal(chrome.i18n.getMessage('msg_proxy_confirm_title'), chrome.i18n.getMessage('msg_proxy_confirm_body', [currentStatus, socksPort]), (confirmed) => {
          if (confirmed === true) applyProxy();
        });
      });
    } else applyProxy();
  });
}
