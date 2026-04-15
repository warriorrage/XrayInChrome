/**
 * Utility functions for node parsing and naming.
 */

/**
 * Parses a proxy node link (VMess, VLESS, Trojan, Shadowsocks) into a node object.
 * @param {string} link 
 * @returns {Object} The parsed node object.
 * @throws {Error} If the protocol is unsupported.
 */
export function parseNodeFromLink(link) {
  let protocol = chrome.i18n.getMessage('proto_unknown');
  let name = chrome.i18n.getMessage('msg_node_unnamed');
  if (link.startsWith('vmess://')) {
    protocol = 'VMess';
    try {
      const b64 = link.replace('vmess://', '');
      const jsonStr = atob(b64);
      const config = JSON.parse(decodeURIComponent(escape(jsonStr))); 
      name = config.ps || chrome.i18n.getMessage('proto_vmess_node');
    } catch (e) { name = 'VMess ' + chrome.i18n.getMessage('msg_node_parse_fail'); }
  } else if (link.startsWith('vless://')) {
    protocol = 'VLESS';
    const url = new URL(link);
    name = decodeURIComponent(url.hash.replace('#', '')) || url.hostname;
  } else if (link.startsWith('trojan://')) {
    protocol = 'Trojan';
    const url = new URL(link);
    name = decodeURIComponent(url.hash.replace('#', '')) || url.hostname;
  } else if (link.startsWith('ss://')) {
    protocol = 'Shadowsocks';
    if (link.includes('#')) name = decodeURIComponent(link.split('#')[1]);
    else name = chrome.i18n.getMessage('proto_ss_node');
  } else throw new Error(chrome.i18n.getMessage('msg_unsupported_proto'));
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    name: name,
    path: link,
    type: protocol
  };
}

/**
 * Generates a unique clone name for a node.
 * @param {string} originalName 
 * @param {Array} savedNodes 
 * @returns {string} The new clone name.
 */
export function getCloneName(originalName, savedNodes) {
  const baseName = originalName;
  let newName = `${chrome.i18n.getMessage('msg_node_clone_prefix')}${baseName}`;
  let counter = 1;
  const exists = (name) => savedNodes.some(n => n.name === name);
  if (!exists(newName)) return newName;
  while (exists(`copy${counter}-${baseName}`)) counter++;
  return `copy${counter}-${baseName}`;
}
