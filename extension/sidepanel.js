// --- UI Elements ---
import { parseNodeFromLink, getCloneName } from './utils.js';
import { state } from './state.js';
import { applyI18n, updateViewTitle, toggleMenu, switchView, showCustomModal,
  menuBtn, navDrawer, overlay, navLinks, views, viewTitle 
} from './ui-core.js';
import { initLogManager, appendLog } from './log-manager.js';
import { initSettingsManager, updateSaveBtnState } from './settings-manager.js';
import { initSubManager, renderSubList, handleUpdateSubscriptions } from './sub-manager.js';
import { initNodeManager, saveAndRenderNodes, renderNodeList } from './node-manager.js';

const appName = chrome.runtime.getManifest().name;


const toggleSwitch = document.getElementById('toggleSwitch');
const bridgeStatusEl = document.getElementById('bridgeStatus');
const xrayStatusEl = document.getElementById('xrayStatus');

// Server View Elements
const importTypeSelect = document.getElementById('importTypeSelect');
const pasteArea = document.getElementById('pasteArea');
const fileArea = document.getElementById('fileArea');
const subArea = document.getElementById('subArea');
const unifiedAddBtn = document.getElementById('unifiedAddBtn');

const shareLinkInput = document.getElementById('shareLinkInput');
const pasteResultEl = document.getElementById('pasteResult');
const localConfigPathInput = document.getElementById('localConfigPath');
// Modal Elements
const customModal = document.getElementById('customModal');

// Log Controls
const clearLogBtn = document.getElementById('clearLogBtn');
const pauseLogBtn = document.getElementById('pauseLogBtn');
const copyLogBtn = document.getElementById('copyLogBtn');
const fontPlusBtn = document.getElementById('fontPlusBtn');
const fontMinusBtn = document.getElementById('fontMinusBtn');

// State
// State variables have been moved to state.js

// --- I18N Helper ---
// Moved to ui-core.js

// --- Navigation Logic ---
menuBtn.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetViewId = link.getAttribute('data-view');
    switchView(targetViewId, appName);
    toggleMenu();
  });
});

// --- Import Toggle Logic ---
if (importTypeSelect) {
  importTypeSelect.addEventListener('change', () => {
    const val = importTypeSelect.value;
    pasteArea.style.display = val === 'paste' ? 'block' : 'none';
    fileArea.style.display = val === 'file' ? 'block' : 'none';
    subArea.style.display = val === 'sub' ? 'block' : 'none';
  });
}

// --- Unified Add Button Logic ---
if (unifiedAddBtn) {
  unifiedAddBtn.addEventListener('click', async () => {
    const mode = importTypeSelect.value;
    if (mode === 'paste') handleAddPaste();
    else if (mode === 'file') handleAddFile();
    else if (mode === 'sub') await handleUpdateSubscriptions(appName);
  });
}

function handleAddPaste() {
  const input = shareLinkInput.value.trim();
  const showResult = (text, color) => {
    if (!pasteResultEl) return;
    pasteResultEl.textContent = text;
    pasteResultEl.style.color = color;
  };
  showResult('', '');
  if (!input) {
    showResult(chrome.i18n.getMessage('msg_paste_empty'), '#d93025');
    return;
  }
  const lines = input.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.length > 0);
  let successCount = 0;
  let failCount = 0;
  let firstNewId = null;
  let lastErrorMsg = '';
  lines.forEach(line => {
    try {
      const newNode = parseNodeFromLink(line);
      state.savedNodes.unshift(newNode); 
      if (!firstNewId) firstNewId = newNode.id;
      successCount++;
    } catch (e) {
      failCount++;
      lastErrorMsg = e.message;
    }
  });
  if (successCount > 0) {
    if (!state.activeNodeId && firstNewId) state.activeNodeId = firstNewId;
    saveAndRenderNodes();
    shareLinkInput.value = ''; 
    let resultText = chrome.i18n.getMessage('msg_paste_success', [successCount]);
    if (failCount > 0) {
      resultText += ' ' + chrome.i18n.getMessage('msg_paste_fail', [successCount, failCount, lastErrorMsg]);
    }
    showResult(resultText, '#188038');
  } else if (failCount > 0) {
    showResult(chrome.i18n.getMessage('msg_add_failed', [lastErrorMsg]), '#d93025');
  }
}

function handleAddFile() {
  const path = localConfigPathInput.value;
  if (!path || path === 'cancelled' || path.startsWith('error:')) {
    showCustomModal(chrome.i18n.getMessage('modal_default_title'), chrome.i18n.getMessage('msg_file_error'), () => {});
    return;
  }
  const fileName = path.split('').pop().split('/').pop();
  const newNode = {
    id: Date.now().toString(),
    name: fileName,
    path: path,
    type: chrome.i18n.getMessage('proto_local')
  };
  state.savedNodes.unshift(newNode);
  if (!state.activeNodeId) state.activeNodeId = newNode.id; 
  saveAndRenderNodes();
  localConfigPathInput.value = '';
}

function init() {
  console.log("[Extension] Initializing sidepanel...");
  applyI18n();
  initLogManager();
  initSubManager();
  initNodeManager();
  const activeLink = document.querySelector('.nav-link.active');
  if (activeLink) updateViewTitle(appName);
  const manifest = chrome.runtime.getManifest();
  const aboutName = document.getElementById('aboutName');
  const aboutVersion = document.getElementById('aboutVersion');
  if (aboutName) aboutName.textContent = manifest.name;
  if (aboutVersion) aboutVersion.textContent = manifest.version;
  chrome.storage.local.get(['savedNodes', 'activeNodeId', 'socksPort', 'httpPort', 'savedSubscriptions', 'logFontSize', 'proxyBrowser', 'hasRunInstall'], (res) => {
    if (res.savedNodes) state.savedNodes = res.savedNodes;
    if (res.activeNodeId) state.activeNodeId = res.activeNodeId;
    if (res.logFontSize) {
      state.currentFontSize = res.logFontSize;
      // Font size is now handled by initLogManager
    }
    if (res.hasRunInstall !== true) {
      showCustomModal(chrome.i18n.getMessage('msg_first_run_title'), chrome.i18n.getMessage('msg_first_run_body'), (confirmed) => {
        if (confirmed) chrome.storage.local.set({ hasRunInstall: true });
      });
    }
    state.originalSettings.socks = res.socksPort || 10808;
    state.originalSettings.http = res.httpPort || 10809;
    state.originalSettings.proxyBrowser = res.proxyBrowser || false;
    
    initSettingsManager({
      socks: state.originalSettings.socks,
      http: state.originalSettings.http,
      proxyBrowser: state.originalSettings.proxyBrowser
    });

    if (res.savedSubscriptions && res.savedSubscriptions.length > 0) {
      state.savedSubscriptions = res.savedSubscriptions;
    } else {
      for (let i = 1; i <= 10; i++) {
        state.savedSubscriptions.push({ id: 'sub-' + Date.now() + '-' + i, name: chrome.i18n.getMessage('msg_sim_sub', [i]), url: `https://example.com/subscribe/${i}`, checked: i <= 2 });
      }
      chrome.storage.local.set({ savedSubscriptions: state.savedSubscriptions });
    }
    renderNodeList();
    renderSubList();
  });
  chrome.runtime.connect({ name: 'sidepanel' });
  refreshStatus();
  setTimeout(() => {
    if (document.getElementById('homeView').classList.contains('active')) {
      appendLog(chrome.i18n.getMessage('msg_log_health_check'));
      chrome.runtime.sendMessage({ action: 'check_health' });
    }
  }, 500);
}

function updateStatusUI() {
  const statusRunningText = chrome.i18n.getMessage('status_running');
  const xrayRunning = xrayStatusEl.textContent === statusRunningText;
  const bridgeRunning = bridgeStatusEl.textContent === statusRunningText;
  const statusNormal = document.getElementById('statusNormal');
  const statusActive = document.getElementById('statusActive');
  const activeNodeDisplay = document.getElementById('activeNodeDisplay');
  statusNormal.style.display = 'flex';
  if (xrayRunning && bridgeRunning) {
    statusActive.style.display = 'flex';
    const activeNode = state.savedNodes.find(n => n.id === state.activeNodeId);
    activeNodeDisplay.textContent = activeNode ? activeNode.name : chrome.i18n.getMessage('msg_active_unknown');
  } else {
    statusActive.style.display = 'none';
  }
}

function setStatus(element, isRunning) {
  const key = isRunning ? 'status_running' : 'status_stopped';
  element.textContent = chrome.i18n.getMessage(key);
  element.className = isRunning ? 'status-text running' : 'status-text stopped';
  updateStatusUI();
}

function refreshStatus() {
  chrome.runtime.sendMessage({ action: 'get_status' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(bridgeStatusEl, false);
      setStatus(xrayStatusEl, false);
      return;
    }
    if (response) {
      setStatus(bridgeStatusEl, response.bridge);
      setStatus(xrayStatusEl, response.xray === 'running');
      const isRunning = response.xray === 'running';
      if (isRunning && !toggleSwitch.checked) toggleSwitch.checked = true;
    }
  });
}

localConfigPathInput.addEventListener('click', () => { 
  const statusRunningText = chrome.i18n.getMessage('status_running');
  if (bridgeStatusEl.textContent !== statusRunningText) {
    appendLog(chrome.i18n.getMessage('msg_log_bridge_connecting'));
  }
  chrome.runtime.sendMessage({ action: 'select_file' }); 
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'native_message') {
    const msg = message.payload;
    if (msg.action === 'select_file_result') {
      if (msg.content !== 'cancelled' && !msg.content.startsWith('error:')) localConfigPathInput.value = msg.content;
    } else if (msg.action === 'result' || msg.action === 'log') {
      appendLog(msg.content);
      if (msg.content === chrome.i18n.getMessage('msg_log_xray_exited')) {
        setTimeout(() => {
          if (xrayStatusEl.textContent === chrome.i18n.getMessage('status_stopped') && toggleSwitch.checked) {
            toggleSwitch.checked = false;
            renderNodeList(); 
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink) viewTitle.textContent = `${chrome.i18n.getMessage(activeLink.getAttribute('data-i18n'))} - ${appName}`;
          }
        }, 1000);
      }
    } else if (msg.action === 'status-report') {
      const isRunning = msg.content === 'running';
      setStatus(xrayStatusEl, isRunning);
      setStatus(bridgeStatusEl, true);
    }
  } else if (message.type === 'disconnected') {
    setStatus(bridgeStatusEl, false);
    setStatus(xrayStatusEl, false);
  }
});

toggleSwitch.addEventListener('change', () => {
  renderNodeList();
  const activeLink = document.querySelector('.nav-link.active');
  if (toggleSwitch.checked) {
  const activeNode = state.savedNodes.find(n => n.id === state.activeNodeId);
  if (!activeNode) { 
    showCustomModal(chrome.i18n.getMessage('modal_default_title'), chrome.i18n.getMessage('msg_node_not_selected'), () => {});
    toggleSwitch.checked = false; 
    if (activeLink) viewTitle.textContent = `${chrome.i18n.getMessage(activeLink.getAttribute('data-i18n'))} - ${appName}`;
    return; 
  }    chrome.storage.local.get(['socksPort', 'httpPort'], (res) => {
      const socksPort = res.socksPort || 10808;
      const httpPort = res.httpPort || 10809;
      appendLog(chrome.i18n.getMessage('msg_log_start_config', [activeNode.path]));
      chrome.runtime.sendMessage({ action: 'start_xray', args: ["-c", activeNode.path], socksPort, httpPort });
    });
  } else {
    chrome.runtime.sendMessage({ action: 'stop_xray' });
    if (activeLink) viewTitle.textContent = `${chrome.i18n.getMessage(activeLink.getAttribute('data-i18n'))} - ${appName}`;
  }
});

init();