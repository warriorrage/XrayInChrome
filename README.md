[English](./README.md) | [Русский](./README_ru.md) | [简体中文](./README_zh_CN.md)

# 🌐 XrayInChrome

**XrayInChrome** is a powerful tool that integrates Xray core control directly into the browser's side panel. By leveraging the Chrome Native Messaging mechanism, it achieves a seamless connection between the browser UI and system-level network processes, allowing users to manage network proxies efficiently without dealing with complex command lines or tedious configuration files.

---

## ⚖️ Disclaimer
- **Compliance**: The user is solely responsible for ensuring that the use of this project and its derivatives complies with all applicable local laws and regulations.
- **Assumption of Liability**: Any and all legal liabilities, disputes, or consequences arising from the use of this project and its derivatives shall be borne exclusively by the user.

---

## ✨ Core Features

- **🚀 Minimalist Control Center**: Real-time control of Xray core startup, shutdown, and status monitoring via the Chrome Side Panel.
- **📦 Intelligent Subscription Management**: Support for one-click import of node links, automatically parsing and syncing them to local state without manual JSON editing.
- **📜 Real-time Log Stream**: View Xray runtime logs directly in the browser interface for rapid connection troubleshooting.
- **⚙️ Automated Deployment**: Built-in Go-based Native Host with one-click registry installation for secure communication between the extension and system processes.
- **🛡️ Privilege Separation Architecture**: Employs a low-privilege frontend + high-privilege backend architecture to ensure the security of the browser environment.

---

## 📐 System Architecture

XrayInChrome adopts a typical **Privilege Separation** architecture to ensure both operational convenience and system security:

```text
[ Chrome Browser ] 
       │
       ▼
[ Sidepanel UI ]  <───>  [ Background Script ]
                                 │
                                 │ (Chrome Native Messaging API)
                                 ▼
                         [ Go Native Host ]  <───>  [ Windows Registry ]
                                 │
                                 │ (Process Management)
                                 ▼
                         [ Xray Core Process ]  <───>  [ Network Traffic ]
```

- **Frontend (Extension)**: Responsible for UI interaction, subscription parsing, and configuration orchestration.
- **Native Host (Go)**: Responsible for Xray process lifecycle management, physical generation of config files, and system calls.
- **Xray Core**: The actual binary executing the network proxy logic.

---

## 🚀 Quick Start

### 👤 User Installation Guide

Follow these steps to get XrayInChrome up and running:

1. **Get and Start Setup**: Visit the [GitHub Repository](https://github.com/warriorrage/XrayInChrome/tree/main/native-host) to download and run the setup guide `xray-bridge.exe`.
2. **Confirm Intent**: Select **'Yes'** in the popup dialog to start installing or updating the bridge.
3. **Link Core**: Select the `xray.exe` core file on your computer and click OK. This registers the bridge in the Windows Registry, granting Chrome permission to call Xray.
4. **Verify Connection**: Restart your browser and click the **'Xray in Chrome'** extension button to open the side panel. The bridge will start automatically; confirm that `xray-bridge.exe` status becomes **'Running'**.
5. **Configure Nodes**: Import proxy nodes in the **'Server'** page and click to select a target node (marked with ✅) as the active configuration.
6. **Start Core**: Enable the toggle in the top right of the **'Home'** page. This will officially start the `xray.exe` core process. Once the status is **'Running'** and logs are clear, it is started successfully.
7. **Route Traffic**: In the **'Others'** (System Settings) page, check **'Use Xray Proxy'** and click **'Apply'**. Browser traffic will now be forwarded via Xray.

---

## 📂 Project Structure

```text
XrayInChrome/
├── extension/              # Chrome Extension source code
│   ├── manifest.json       # Extension manifest (V3)
│   ├── background.js       # Background service, maintains Native Host connection
│   ├── sidepanel.js        # Side panel main logic
│   ├── state.js            # Centralized state management
│   ├── ui-core.js          # UI base components
│   ├── log-manager.js      # Log stream processing
│   └── utils.js            # General utility functions
└── native-host/            # Go Backend source code
    ├── main.go             # Entry point, handles Native Messaging protocol
    └── pkg/                # Core packages
        ├── messaging/      # Message serialization & communication protocol
        ├── xray/           # Xray process lifecycle management
        ├── platform/       # Platform-specific implementations (Windows Registry, etc.)
        ├── config/         # Xray config generation & parsing
        └── installer/      # Install & uninstall logic
```

---

## ⚠️ Security Note

This project operates via Chrome's officially supported `Native Messaging` mechanism. This means:
- **Controlled Communication**: The extension cannot arbitrarily access your file system; all system operations must pass strict validation by the `native-host`.
- **Explicit Authorization**: Installing the backend requires administrator privileges (modifying the registry), ensuring that installation is a user-perceived and authorized action.
- **Least Privilege**: The extension only requests necessary API permissions and does not run any third-party remote scripts.

---

## 📄 License

MIT License
