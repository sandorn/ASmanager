# Agent Skills Manager

Agent Skills Manager 是一个自用 VS Code 扩展规划项目，用于集中管理多个 AI Agent 工具的 Skills 与 MCP 配置。项目目标是以本机中央仓库为核心，统一安装、更新、检测、同步和分发 Skills，减少不同 Agent 工具之间重复维护配置的成本。

## 项目定位

- 中央仓库：默认使用 `~/.agent/skills` 存放统一 Skills。
- 多来源管理：支持添加、更新和删除 GitHub 上的 Skills 来源。
- 多工具适配：检测并适配 Claude Code、Codex、OpenCode、Cursor、Gemini CLI、Copilot、Cline、Roo Code、Kimi、Qwen 等工具。
- 同步分发：通过复制、软链接或 junction 将 Skills 分发到不同工具的目标目录。
- 质量检测：检查 Skill 结构、说明文档、重复能力和潜在冲突。
- MCP 管理：后续扩展为 MCP Server 配置、启停、同步和健康检查。

## MVP 范围

第一阶段优先实现可以自用的 VSIX 插件：

1. 扫描 `~/.agent/skills`。
2. 展示本机已安装的 Skills。
3. 解析每个 Skill 的 `SKILL.md` 基础信息。
4. 管理 Skills 来源列表。
5. 从 GitHub 来源安装或更新 Skills。
6. 检测本机常见 Agent 工具。
7. 将指定 Skill 同步到目标工具目录。
8. 打包为 `.vsix` 供本机安装。

## 技术方案

推荐技术栈：

- TypeScript
- VS Code Extension API
- Node.js `fs/promises`
- Node.js `child_process`
- Tree View
- Webview
- `@vscode/vsce`

## 计划命令

```powershell
npm install
npm run compile
npx vsce package
code --install-extension agent-skills-manager-0.0.1.vsix
```

## 文档

详细规划见 [docs/规划文档.md](docs/%E8%A7%84%E5%88%92%E6%96%87%E6%A1%A3.md)。

## 授权

本项目当前为自用项目，默认保留所有权利。详见 [LICENSE](LICENSE)。
