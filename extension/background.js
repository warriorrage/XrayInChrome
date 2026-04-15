// --- Native Messaging & State Management ---
let nativePort = null;
let keepAliveInterval = null;
let xrayStatus = 'stopped'; // 'stopped' or 'running'

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

console.log("Xray Background Service Worker initialized.");

// 监听 UI 连接状态
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log("Side panel opened.");
    port.onDisconnect.addListener(() => {
      console.log("Side panel closed.");
      // 如果侧边栏关闭时，Xray 并没有在运行，则断开 Native Host 以免进程残留
      if (xrayStatus === 'stopped' && nativePort) {
        console.log("Xray is not running, disconnecting bridge to save resources.");
        releaseNativeHost();
      }
    });
  }
});

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start_xray') {
    startXray(message.args || [], message.socksPort, message.httpPort);
    sendResponse({ status: 'starting' });
  } else if (message.action === 'stop_xray') {
    stopXray();
    sendResponse({ status: 'stopping' });
    } else if (message.action === 'get_status') {
      sendResponse({
        bridge: !!nativePort,
        xray: xrayStatus
      });
        } else if (message.action === 'check_health') {
          checkHealth();
          sendResponse({ status: 'checking' });
        } else if (message.action === 'select_file') {
          if (!nativePort) {
            connectHost();
            setTimeout(() => {
              if (nativePort) {
                nativePort.postMessage({ action: 'select_file' });
              }
            }, 200);
          } else {
            nativePort.postMessage({ action: 'select_file' });
          }
          sendResponse({ status: 'requesting_dialog' });
          } else if (message.action === 'fetch_subscription') {
            // 设置超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
            fetch(message.url, { signal: controller.signal })
              .then(res => {
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`HTTP 错误: ${res.status}`);
                return res.text();
              })
              .then(data => sendResponse({ success: true, data }))
              .catch(err => {
                clearTimeout(timeoutId);
                sendResponse({ success: false, error: err.name === 'AbortError' ? '请求超时' : err.message });
              });
            return true; 
          }        return false;
      });// --- Native Host Connection ---
function checkHealth() {
  if (!nativePort) {
    connectHost();
    // 稍微延迟一下等待连接建立。如果连接失败，onDisconnect 会处理日志输出
    setTimeout(() => {
      if (nativePort) {
        nativePort.postMessage({ action: 'check' });
      }
    }, 200);
  } else {
    nativePort.postMessage({ action: 'check' });
  }
}
  
  function connectHost() {  if (nativePort) return;
  try {
    console.log("Connecting to native host...");
    nativePort = chrome.runtime.connectNative('com.xray.host');
    
    nativePort.onMessage.addListener((msg) => {
      // Forward to sidepanel
      chrome.runtime.sendMessage({ type: 'native_message', payload: msg })
        .catch(() => {});
      
      // Update local state
      if (msg.action === 'status-report') {
        xrayStatus = msg.content === 'running' ? 'running' : 'stopped';
      }
    });

    nativePort.onDisconnect.addListener(() => {
      const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "未知原因断开";
      console.log("Native host disconnected: " + errorMsg);
      
      // 向 UI 发送明确的错误日志
      chrome.runtime.sendMessage({ 
        type: 'native_message', 
        payload: { action: 'log', content: '[❌] Native Host 连接失败: ' + errorMsg + ' (注册表项设置不正确，请手动执行一次 native-host\\install.bat 文件)' } 
      }).catch(() => {});

      nativePort = null;
      xrayStatus = 'stopped';
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      chrome.runtime.sendMessage({ type: 'disconnected' }).catch(() => {});
    });

    // Keep-alive / Status polling
    keepAliveInterval = setInterval(() => {
      if (nativePort) {
        nativePort.postMessage({ action: 'status' });
      }
    }, 500);

  } catch (e) {
    console.error("Failed to connect to native host:", e);
  }
}

function startXray(args = [], socksPort = 10808, httpPort = 10809) {
  // Ensure connected
  if (!nativePort) {
    connectHost();
  }
  
  if (nativePort) {
    // 使用传入的参数启动 (包括端口偏好)
    nativePort.postMessage({ 
      action: 'start', 
      content: args,
      socksPort,
      httpPort
    });
  }
}

function stopXray() {
  if (nativePort) {
    try {
      nativePort.postMessage({ action: 'stop' });
    } catch (e) {
      console.error("Error sending stop message:", e);
    }
    
    // 明确断开连接，确保 Native Host 进程终止
    releaseNativeHost();
  }
}

function releaseNativeHost() {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
  
  xrayStatus = 'stopped';
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  // 通知 UI (如果 UI 还没关的话)
  chrome.runtime.sendMessage({ type: 'disconnected' }).catch(() => {});
}