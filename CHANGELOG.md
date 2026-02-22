# Rowbot CLI 更新日志

## 2026-02-22

### 新增功能
- **内置命令系统**
  - `/help` - 显示帮助信息
  - `/clear` - 清空对话历史
  - `/exit` - 退出程序
  - `/config` - 交互式配置修改（上下键选择，回车确认）
  - `/model` - 交互式模型选择（GLM 模型列表）
  - `/mcp` - MCP 工具（开发中）
  - `/weather` - 天气查询（开发中）
  - `/search` - 搜索功能（开发中）

- **智能提示系统**
  - 命令自动补全：输入 `/h` 显示灰色提示 `elp`
  - Tab 键补全：按 Tab 自动完成命令
  - 支持命令：`/help`, `/clear`, `/exit`, `/config`, `/model`, `/mcp`, `/weather`, `/search`

- **实时进度显示**
  - LLM 调用时显示 spinner 动画
  - 实时显示耗时（秒）
  - 实时显示 tokens 计数

- **流式输出**
  - 使用 stream API 边生成边显示
  - 第一个 chunk 到达后立即开始输出

- **任务类型检测**
  - `system` - CPU/内存/磁盘/进程查询
  - `search` - 规划/方案/推荐/景点/攻略
  - `general` - 其他普通对话

- **生产级工具系统** (2026-02-22 | Create)
  - 工具验证器：参数类型检查、必填项验证
  - 速率限制器：按工具配置调用频率限制，防止滥用
  - 工具编排器：统一工具执行入口，支持重试、超时、并行执行
  - 命令行参数 `--tools` 启用工具系统

- **增强权限系统** (2026-02-22 | Create)
  - 命令白名单/黑名单：限制可执行的 Shell 命令
  - 路径白名单/黑名单：限制可访问的文件路径
  - 域名白名单/黑名单：限制可访问的网站
  - 会话审批限制：防止批量操作

- **增强执行引擎** (2026-02-22 | Create)
  - 沙箱配置：超时、内存限制、环境变量隔离
  - 并行执行：自动识别独立步骤，并行执行提升效率
  - 事件驱动：支持进度回调、取消操作

- **浏览器自动化模块** (2026-02-22 | Create)
  - 默认浏览器打开 URL
  - 域名访问控制
  - 预留 Playwright/Puppeteer 接口

### 优化
- **即时响应** - 用户输入后 100ms 内显示确认消息
- **历史上下文管理** - 只保留最近 6 条交互
- **系统 prompt 优化** - 存储在初始化上下文，不重复发送

### 修复
- 内置命令执行后正确返回提示符
- GLM API temperature 参数范围修正（0-1.0）
- 超时错误处理
- 输入显示优化：输入框有上下横线，发送后清除横线并加灰色背景
- 2026-02-22 | CLI 退出体验 | Update | 修复 Ctrl+C 退出时终端显示混乱问题，优雅退出并显示告别消息
- 2026-02-22 | 流式输出体验 | Update | 修复流式输出卡顿问题，立即显示 spinner 和 token 计数（从 0 开始）
- 2026-02-22 | Token 计数显示 | Update | 修复流式响应过程中 token 数量一直为 0 的问题，现在会在流式结束时显示最终 token 数量

---

## 架构

```
apps/cli/src/index.ts
├── 内置命令处理 (isBuiltinCommand)
├── 任务类型检测 (detectTaskType)
├── 系统任务执行 (executeSystemTask)
├── 搜索任务执行 (executeSearchTask)
└── 通用任务执行 (executeGeneralTask)

packages/cli-ui/src/ui/
├── renderer.ts - 终端渲染（spinner、tokens）
└── index.ts - UI 接口
```

## 配置

配置文件: `~/.robot/config.json`

```json
{
  "provider": "glm",
  "model": "glm-4-flash",
  "apiKey": "...",
  "baseUrl": "..."
}
```
