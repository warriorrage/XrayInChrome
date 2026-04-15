import { state } from './state.js';
import { showCustomModal } from './ui-core.js';
import { getCloneName } from './utils.js';

// --- Node Elements ---
const nodeListEl = document.getElementById('nodeList');
const nodeSearchInput = document.getElementById('nodeSearch');
const dedupeNodesBtn = document.getElementById('dedupeNodesBtn');
const deleteAllNodesBtn = document.getElementById('deleteAllNodesBtn');

/**
 * Persists the current node state to storage and triggers a re-render.
 */
export function saveAndRenderNodes() {
  chrome.storage.local.set({ savedNodes: state.savedNodes, activeNodeId: state.activeNodeId }, () => {
    renderNodeList();
  });
}

/**
 * Renders the list of proxy nodes based on search criteria.
 */
export function renderNodeList() {
  if (!nodeListEl) return;
  
  const isXrayRunning = document.getElementById('toggleSwitch')?.checked;
  const searchTerm = nodeSearchInput ? nodeSearchInput.value.toLowerCase() : '';
  
  const filteredNodes = state.savedNodes.filter(node => 
    node.name.toLowerCase().includes(searchTerm) || 
    node.path.toLowerCase().includes(searchTerm)
  );

  if (filteredNodes.length === 0) {
    nodeListEl.innerHTML = `<div class="empty-hint">${chrome.i18n.getMessage('msg_no_data')}</div>`;
    return;
  }

  nodeListEl.innerHTML = '';
  filteredNodes.forEach(node => {
    const isSelected = node.id === state.activeNodeId;
    const isDisabled = isXrayRunning && isSelected;
    
    const nodeItem = document.createElement('div');
    nodeItem.className = `node-item ${isSelected ? 'selected' : ''}`;
    if (isDisabled) nodeItem.style.opacity = '0.6';
    
    nodeItem.innerHTML = `
      <div class="node-info-container">
        <div class="node-name" title="${node.name}">${node.name}</div>
        <div class="node-meta-row">
          <button class="node-btn select-btn" title="${chrome.i18n.getMessage('msg_node_not_selected')}" ${isDisabled ? 'disabled' : ''}>${isSelected ? '✅' : '▶️'}</button>
          <div class="node-meta" title="${node.path}">${node.type}${chrome.i18n.getMessage('node_separator')}${node.path}</div>
        </div>
      </div>
      <div class="node-actions">
        <button class="node-btn edit-btn btn-text-sm" ${isDisabled ? 'disabled style="color:#999; cursor:not-allowed;"' : ''}>${chrome.i18n.getMessage('btn_edit')}</button>
        <button class="node-btn clone-btn btn-text-sm" ${isDisabled ? 'disabled style="color:#999; cursor:not-allowed;"' : ''}>${chrome.i18n.getMessage('btn_node_clone')}</button>
        <button class="node-btn delete-btn btn-text-sm" style="color: #d93025;" ${isDisabled ? 'disabled style="color:#999; cursor:not-allowed;"' : ''}>${chrome.i18n.getMessage('btn_delete')}</button>
      </div>
    `;

    nodeItem.querySelector('.select-btn').addEventListener('click', () => {
      if (!isDisabled) { 
        state.activeNodeId = node.id; 
        saveAndRenderNodes(); 
      }
    });

    nodeItem.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDisabled) {
        showCustomModal(chrome.i18n.getMessage('msg_node_edit_title'), chrome.i18n.getMessage('msg_node_edit_body'), (newName) => {
          if (newName && typeof newName === 'string' && newName.trim()) { 
            node.name = newName.trim(); 
            saveAndRenderNodes(); 
          } 
        }, [{ label: chrome.i18n.getMessage('msg_node_edit_label'), value: node.name }]);
      }
    });

    nodeItem.querySelector('.clone-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDisabled) {
        const newNode = { 
          ...node, 
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
          name: getCloneName(node.name, state.savedNodes) 
        };
        state.savedNodes.unshift(newNode); 
        saveAndRenderNodes();
      }
    });

    nodeItem.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDisabled) {
        showCustomModal(chrome.i18n.getMessage('msg_node_delete_title'), chrome.i18n.getMessage('msg_node_delete_body', [node.name]), (confirmed) => {
          if (confirmed === true) {
            state.savedNodes = state.savedNodes.filter(n => n.id !== node.id);
            if (state.activeNodeId === node.id) {
              state.activeNodeId = state.savedNodes.length > 0 ? state.savedNodes[0].id : null;
            }
            saveAndRenderNodes();
          }
        });
      }
    });

    nodeListEl.appendChild(nodeItem);
  });
}

/**
 * Initializes the node manager and its event listeners.
 */
export function initNodeManager() {
  if (nodeSearchInput) {
    nodeSearchInput.addEventListener('input', () => {
      renderNodeList();
    });
  }

  if (dedupeNodesBtn) {
    dedupeNodesBtn.addEventListener('click', () => {
      const originalCount = state.savedNodes.length;
      const seenPaths = new Set();
      const uniqueNodes = [];
      state.savedNodes.forEach(node => { 
        if (!seenPaths.has(node.path)) { 
          seenPaths.add(node.path); 
          uniqueNodes.push(node); 
        } 
      });
      const removedCount = originalCount - uniqueNodes.length;
      if (removedCount > 0) {
        showCustomModal(chrome.i18n.getMessage('msg_dedupe_title'), chrome.i18n.getMessage('msg_dedupe_confirm', [removedCount]), () => {
          state.savedNodes = uniqueNodes;
          if (!state.savedNodes.find(n => n.id === state.activeNodeId)) {
            state.activeNodeId = state.savedNodes.length > 0 ? state.savedNodes[0].id : null;
          }
          saveAndRenderNodes();
        });
      } else {
        showCustomModal(chrome.i18n.getMessage('msg_no_dedupe'), chrome.i18n.getMessage('msg_no_duplicates'), () => {});
      }
    });
  }

  if (deleteAllNodesBtn) {
    deleteAllNodesBtn.addEventListener('click', () => {
      const count = state.savedNodes.length;
      if (count === 0) return;
      showCustomModal(chrome.i18n.getMessage('msg_clear_all_title'), chrome.i18n.getMessage('msg_clear_all_confirm', [count]), () => {
        state.savedNodes = []; 
        state.activeNodeId = null; 
        saveAndRenderNodes();
      });
    });
  }

  // Listen for subscription updates to refresh the list
  window.addEventListener('nodes-updated', () => {
    renderNodeList();
  });
}
