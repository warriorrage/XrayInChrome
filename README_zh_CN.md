[English](./README.md) | [Русский](./README_ru.md) | [简体中文](./README_zh_CN.md)

# 🌐 XrayInChrome

**XrayInChrome** 是一款将 Xray 核心控制力直接集成到浏览器侧边栏的强大工具。它通过 Chrome Native Messaging 机制，实现了浏览器 UI 与系统级网络进程的无缝连接，让用户无需面对复杂的命令行或繁琐的配置文件，即可高效管理网络代理。

---

## ⚖️ 免责声明
- **合规使用**：用户应确保在符合当地法律法规的前提下使用本项目及其衍生品。
- **责任承担**：因使用本项目及其衍生品而产生的任何法律后果、争议或责任，均由使用者自行承担全部且唯一的法律责任。

---

## ✨ 核心特性

- **🚀 极简控制中心**：通过 Chrome 侧边栏 (Side Panel) 实时控制 Xray 核心的启动、停止与状态监控。
- **📦 智能订阅管理**：支持一键导入节点链接，自动解析并同步至本地状态，无需手动编辑 JSON 配置文件。
- **📜 实时日志流**：在浏览器界面中实时查看 Xray 运行日志，快速排查连接问题。
- **⚙️ 自动化部署**：内置 Go 编写的 Native Host，支持一键安装注册表项，实现插件与系统进程的安全通信。
- **🛡️ 权限分离架构**：采用低权限前端 + 高权限后端的架构，确保浏览器环境的安全性。

---

## 📐 系统架构

XrayInChrome 采用了典型的 **特权分离 (Privilege Separation)** 架构，确保了操作的便捷性与系统安全性：

```text
[ Chrome 浏览器 ] 
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

- **Frontend (Extension)**: 负责 UI 交互、订阅解析及配置编排。
- **Native Host (Go)**: 负责 Xray 进程的生命周期管理、配置文件的物理生成及系统调用。
- **Xray Core**: 实际执行网络代理逻辑的核心二进制文件。

---

## 🚀 快速上手

### 👤 用户安装指南

请按照以下步骤完成安装与配置：

1. **获取并启动向导**：访问 [GitHub 仓库](https://github.com/warriorrage/XrayInChrome/tree/main/native-host) 下载并运行安装向导 `xray-bridge.exe`。
2. **确认安装意图**：在弹出的对话框中选择 **'Yes'** 以开始安装或更新桥接程序。
3. **关联核心文件**：在文件选择对话框中，选中你电脑上的 `xray.exe` 核心文件并点击确定。此操作会将桥接程序注册到 Windows 注册表，使 Chrome 浏览器获得调用 Xray 的权限。
4. **验证连接状态**：重启浏览器并点击 **'Xray in Chrome'** 插件按钮打开侧边栏。此时插件会自动启动桥接程序，确认 `xray-bridge.exe` 状态变为 **'运行中'**，表明通信链路已打通。
5. **配置代理节点**：在 **'节点设置'** 页面导入代理节点，并点击选中一个目标节点（状态显示为 ✅），将其设为活动配置。
6. **启动核心进程**：在 **'首页'** 右上角开启运行开关。此操作将正式启动 `xray.exe` 核心进程。确认状态变为 **'运行中'** 且日志无报错，即启动成功。
7. **接管浏览器流量**：在 **'系统设置'** 中勾选 **'接管此浏览器代理'** 并点击 **'应用'**，浏览器流量将正式通过 Xray 转发。

---

## 📂 项目结构

```text
XrayInChrome/
├── extension/              # Chrome 插件源代码
│   ├── manifest.json       # 插件清单 (V3)
│   ├── background.js       # 后台服务，维持 Native Host 连接
│   ├── sidepanel.js        # 侧边栏主逻辑
│   ├── state.js            # 集中状态管理
│   ├── ui-core.js          # UI 基础组件
│   ├── log-manager.js      # 日志流处理
│   └── utils.js            # 通用工具函数
└── native-host/            # Go 后端源代码
    ├── main.go             # 程序入口，处理 Native Messaging 协议
    └── pkg/                # 核心功能包
        ├── messaging/      # 消息序列化与通信协议
        ├── xray/           # Xray 进程生命周期管理
        ├── platform/       # 平台相关实现 (Windows 注册表等)
        ├── config/         # Xray 配置文件的生成与解析
        └── installer/      # 安装与卸载逻辑
```

---

## ⚠️ 安全说明

本项目通过 Chrome 官方支持的 `Native Messaging` 机制运行。这意味着：
- **受控通信**：插件无法随意访问您的文件系统，所有系统操作必须经过 `native-host` 的严格校验。
- **显式授权**：安装后端时需要管理员权限（修改注册表），确保了安装行为是用户感知且授权的。
- **最小权限**：插件仅申请必要的 API 权限，不运行任何第三方远程脚本。

---

## 📄 License

MIT License
