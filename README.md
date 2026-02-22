# 🤖 Rowbot

<div align="center">

**Windows Desktop AI Agent Platform**

一个高效、极速响应的 Windows 桌面 AI Agent CLI 工具

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0-blue.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ 特性

- 🚀 **极速响应** - 流式输出，边生成边显示，100ms 内确认用户意图
- 🎯 **智能任务检测** - 自动识别系统任务、搜索任务、通用对话
- 💬 **内置命令系统** - 支持命令自动补全、Tab 键补全
- 📊 **实时进度显示** - Spinner 动画、耗时统计、Token 计数
- 🔧 **生产级工具系统** - 参数验证、速率限制、并行执行
- 🔒 **增强权限系统** - 白名单/黑名单控制，防止危险操作
- 🌐 **多 LLM 支持** - 支持 OpenAI 兼容 API 和智谱 GLM 模型

---

## 📦 安装

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### 克隆并安装

```bash
git clone https://github.com/your-username/rowbot.git
cd rowbot
pnpm install
pnpm build
```

---

## 🚀 快速开始

### 配置 API Key

创建 `.env` 文件或设置环境变量：

```bash
# GLM (智谱 AI)
GLM_API_KEY=your_glm_api_key

# 或 OpenAI 兼容 API
OPENAI_API_KEY=your_openai_api_key
```

### 启动 CLI

```bash
pnpm cli
```

或启用工具系统：

```bash
pnpm cli --tools
```

---

## 📖 使用指南

### 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话历史 |
| `/exit` | 退出程序 |
| `/config` | 交互式配置修改 |
| `/model` | 交互式模型选择 |
| `/mcp` | MCP 工具（开发中） |
| `/weather` | 天气查询（开发中） |
| `/search` | 搜索功能（开发中） |

### 智能提示

- 输入 `/h` 会显示灰色提示 `elp`
- 按 `Tab` 键自动完成命令
- 使用 `↑↓` 键选择选项，`Enter` 确认

### 任务类型

Rowbot 会自动识别任务类型并优化处理：

| 类型 | 触发关键词 | 处理方式 |
|------|-----------|---------|
| `system` | CPU、内存、磁盘、进程 | 执行系统命令 + AI 总结 |
| `search` | 规划、方案、推荐、景点、攻略 | AI 生成建议 |
| `general` | 其他对话 | 标准对话模式 |

---

## ⚙️ 配置

配置文件位于 `~/.robot/config.json`：

```json
{
  "provider": "glm",
  "model": "glm-4-flash",
  "apiKey": "your_api_key",
  "baseUrl": "https://open.bigmodel.cn/api/paas/v4"
}
```

### 支持的模型

**GLM (智谱 AI):**
- `glm-4.7`
- `glm-4.7-flash`
- `glm-4.6-flash`
- `glm-4.5-flash`
- `glm-4.5-air`
- `glm-4-plus`
- `glm-4-flashx`
- `glm-4-flash`
- `glm-4-long`

---

## 🏗️ 项目架构

```
rowbot/
├── apps/
│   └── cli/                    # CLI 应用入口
├── packages/
│   ├── agent-core/            # Agent 核心逻辑
│   ├── browser-adapter/       # 浏览器适配器
│   ├── cli-ui/                # 终端 UI 组件
│   ├── execution-engine/      # 执行引擎
│   ├── intent-router/         # 意图路由
│   ├── llm-adapter/           # LLM 适配器
│   ├── logger/                # 日志系统
│   ├── permission-system/     # 权限系统
│   ├── tool-system/           # 工具系统
│   └── windows-adapter/       # Windows 适配器
├── docs/                      # 文档
├── package.json
└── pnpm-workspace.yaml
```

### 核心模块

| 模块 | 说明 |
|------|------|
| `llm-adapter` | LLM 提供者适配器，支持 OpenAI 和 GLM |
| `cli-ui` | 终端 UI 渲染、输入处理、状态管理 |
| `intent-router` | 意图识别和路由分发 |
| `tool-system` | 工具注册、验证、编排执行 |
| `permission-system` | 权限检查、白名单/黑名单控制 |
| `execution-engine` | 沙箱执行、并行处理、事件驱动 |
| `windows-adapter` | Windows 系统操作适配 |

---

## 🛠️ 开发

### 命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 清理构建产物
pnpm clean
```

### 添加新包

```bash
cd packages
mkdir my-package
cd my-package
pnpm init
```

---

## 📋 路线图

- [ ] MCP (Model Context Protocol) 集成
- [ ] 天气查询功能
- [ ] 网络搜索功能
- [ ] 文件操作工具增强
- [ ] 多语言支持
- [ ] GUI 界面

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT](LICENSE)

---

<div align="center">

**Made with ❤️ by Rowbot Team**

</div>
