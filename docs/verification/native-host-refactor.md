# Native Host 重构后功能验证方案

本方案用于验证 `native-host` 从单一文件重构为模块化结构后的功能完整性和稳定性。

## 1. 验证目标
- 确保模块化拆分未引入回归 Bug。
- 验证强类型配置解析与生成逻辑的正确性。
- 验证平台适配层（Windows 注册表、GUI 弹窗）的可靠性。
- 验证 Xray 进程生命周期管理（启动 $ightarrow$ 监控 $ightarrow$ 停止）。

---

## 2. 环境准备
- **语言环境**: Go 1.20+
- **测试工具**: `native-host/test_client.go` (用于模拟 Chrome 扩展发送二进制指令)
- **核心依赖**: 已编译的 `xray.exe`

---

## 3. 详细验证步骤

### 阶段 A：编译与构建验证
**操作**:
```powershell
cd native-host
go build -o native-host.exe main.go
```
**验收标准**:
- [ ] 能够成功编译，无 `undefined` 或 `type mismatch` 错误。
- [ ] 生成的 `native-host.exe` 大小正常。

### 阶段 B：协议与核心链路验证 (使用 `test_client`)
本阶段模拟 Chrome 扩展通过标准输入/输出与 Host 通信。

**操作流程**:
1. 开启终端 A $ightarrow$ 运行 `.
ative-host.exe` (等待输入)。
2. 开启终端 B $ightarrow$ 运行 `go run test_client.go`。

**验证用例**:
| 用例 ID | 测试动作 | 预期结果 | 验证点 |
| :--- | :--- | :--- | :--- |
| TC-1 | 发送 `ping` | 收到 `pong` 响应 | 协议读写 $\checkmark$ |
| TC-2 | 发送 `status` | 收到 `stopped` (初始状态) | 进程状态 $\checkmark$ |
| TC-3 | 发送 `check` | 收到完整的健康检查报告 (含 [OK]/[WARNING]) | 诊断逻辑 $\checkmark$ |
| TC-4 | 发送 `start` (含链接) | 收到 Xray 启动日志 $ightarrow$ 状态变为 `running` | 链路解析 $\checkmark$ |
| TC-5 | 发送 `stop` | 收到 `stopped` 报告 $ightarrow$ 进程实际退出 | 生命周期 $\checkmark$ |
| TC-6 | 发送 `select_file` | 弹出文件选择对话框 $ightarrow$ 返回选中路径 | 平台适配 $\checkmark$ |

### 阶段 C：独立模式 (Standalone) 验证
验证直接运行 `.exe` 时的 GUI 安装流程。

**操作流程**:
1. 直接双击或运行 `.
ative-host.exe`。
2. **验证安装**: 选择 `Yes` $ightarrow$ 选择 `xray.exe` $ightarrow$ 点击确定。
   - **检查点**: 
     - [ ] 目录下生成 `config.json`。
     - [ ] 目录下生成 `com.xray.host.json`。
     - [ ] 注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.xray.host` 写入正确。
3. **验证卸载**: 再次运行 $ightarrow$ 选择 `No`。
   - **检查点**: 
     - [ ] 注册表项被删除。
     - [ ] 两个 JSON 配置文件被删除。

### 阶段 D：端到端 (E2E) 验证 (可选)
如果环境允许，直接启动 Chrome 浏览器并操作插件。
- [ ] 插件点击“启动” $ightarrow$ 验证 Xray 正常工作。
- [ ] 插件切换节点 $ightarrow$ 验证临时配置文件正确生成并重启。
- [ ] 插件点击“停止” $ightarrow$ 验证进程被杀死。

---

## 4. 故障排查清单
- **编译失败**: 检查 `native-host/go.mod` 是否正确，尝试运行 `go mod tidy`。
- **`test_client` 无法通信**: 确保 `native-host.exe` 正在运行且没有被防火墙拦截。
- **Xray 启动失败**: 运行 `check` 指令，确认 `xray.exe` 路径是否有效且有执行权限。
- **注册表未写入**: 尝试以管理员权限运行 `native-host.exe`。
