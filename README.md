# ASmanager

集中管理本机多个 AI Agent 工具的 **Skills** 与 **MCP Server** 配置。以 `~/.agents/skills` 为中央仓库，统一安装、更新、检测、同步和分发 Skills，减少不同 Agent 工具之间重复维护的成本。

> 签名：Sandhill &nbsp;|&nbsp; 扩展 ID：`asmanager` &nbsp;|&nbsp; 协议：保留所有权利

---

## 功能总览

### Skills 管理

- 扫描 `~/.agents/skills` 下的 Skill 目录（自动过滤 `.` 开头的隐藏目录）
- 解析 `SKILL.md` 的 frontmatter：名称、描述、标签（`tags: [...]`）、分类（`category:`）
- 质量评分（0–10 分）：名称 30% + 描述 20% + 标签 15% + 分类 10% + 多文件 20% + 大小合理 5%
- 语义重叠检测（Jaccard 词级相似度）：≥85% 警告，≥60% 提示；名称相似度 ≥70% 提示
- 右键 Skill：**编辑 SKILL.md**、**重命名**、**删除**、**同步**

### 来源（Sources）管理

- 内置 4 个 Skill 来源：
    - `https://github.com/anthropics/skills`
    - `https://github.com/openai/skills`
    - `https://github.com/MoizIbnYousaf/Ai-Agent-Skills`
    - `https://github.com/heilcheng/awesome-agent-skills`
- Git 克隆 / 拉取更新（`--depth 1` 浅克隆）
- Git 变更检测（`fetch` + `rev-list --count` 对比远程 HEAD）
- 来源内 Skill 发现 → 单个安装 / 批量安装全部
- 右键 Source：**更新**、**安装 Skill**、**预览 Skill 列表**、**批量安装**、**移除**

### Agent 检测

- 检测 10 种工具配置目录：Claude Code、Codex、OpenCode、Cursor、Gemini CLI、Copilot、Cline、Roo Code、Kimi、Qwen

### 同步分发

- 三种模式：**Copy**（全兼容）| **Symlink**（符号链接）| **Junction**（Windows 目录连接）
- 单 Skill 同步（选目录 + 选模式）
- **批量同步**：选择一个 Skill → 多选已检测 Agent → 一键推送
- 同步记录：最多 200 条，可查看 / 清空
- **同步回滚**：按记录删除目标目录中已同步的 Skill

### MCP Server 管理

- 自动扫描 6 种工具的 MCP 配置文件（Claude Code / Cursor / Copilot / Cline / Roo Code / Gemini CLI）
- 解析 `mcpServers` 条目并展示
- 启停 MCP Server（写入 `disabled` 字段）
- **跨工具同步**：将一个 Server 配置复制到另一个工具的 `mcp.json`
- **健康检查**：`{command} --version` / `--help` 探活，8 秒超时

### 备份与配置

- **备份仓库**：`~/.agents/skills` → 时间戳目录
- **恢复仓库**：从备份目录恢复到中央仓库（跳过 `.sources` 缓存）
- **导出配置**：`centralRepository` + `sources` → JSON 文件
- **导入配置**：JSON → 写回 VS Code 全局设置

### 可视化

- Activity Bar 视图容器：`Skills` / `Agents` / `Sources` / `MCP Servers` 四个 Tree View
- **管理页面（Webview）**：指标仪表盘 + 5 个数据卡片（Skills / Sources / Agents / MCP / Syncs），每行带操作按钮

---

## 命令参考

所有命令前缀统一为 `ASmanager:`，共 **29 条**：

| 分类  | 命令                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库  | `Initialize Repository` `Refresh` `Open Repository` `Open Manager`                                                                              |
| 来源  | `Add Source` `Update Sources` `Install Skill From Source` `Install All From Source` `Show Source Skills` `Remove Source` `Check Source Updates` |
| Skill | `Sync Skill` `Sync Skill to Agents` `Delete Skill` `Rename Skill` `Edit Skill Markdown`                                                         |
| Agent | `Detect Agents`                                                                                                                                 |
| MCP   | `Detect MCP Servers` `Toggle MCP Server` `Sync MCP Server` `Health Check MCP Servers`                                                           |
| 诊断  | `Diagnose Skills`                                                                                                                               |
| 同步  | `Show Sync Records` `Clear Sync Records` `Rollback Sync`                                                                                        |
| 备份  | `Backup Repository` `Restore Repository` `Export Config` `Import Config`                                                                        |

---

## 技术栈

TypeScript · VS Code Extension API · Node.js `fs/promises` + `child_process` · Tree View · Webview · `@vscode/vsce`

---

## 开发

```powershell
npm install
npm run compile
```

在 VS Code 中打开本项目后，按 `F5` 启动扩展开发宿主进行调试。

## 打包

```powershell
npm run package
```

生成 `asmanager-0.0.1.vsix`。

## 安装

```powershell
# 方式一：命令行（需要 code 在 PATH 中）
code --install-extension asmanager-0.0.1.vsix

# 方式二：VS Code 内操作
# Ctrl+Shift+X → 右上角 ⋯ → Install from VSIX...
```

---

## 快速上手

1. 左侧 Activity Bar 打开 `Agent Skills` 图标
2. `Ctrl+Shift+P` → `ASmanager: Initialize Repository` 创建 `~/.agents/skills`
3. `Ctrl+Shift+P` → `ASmanager: Open Manager` 打开管理页面
4. 管理页点击 `Refresh` / `Detect Agents` / `Update Sources`
5. 将 Skill 目录放入 `~/.agents/skills`，每个目录需包含 `SKILL.md`
6. 从管理页或右键菜单执行同步、安装、诊断等操作

---

## Skill 目录规范

```
~/.agents/skills/
  my-skill/
    SKILL.md          # 必需，含 name/tags/category/description frontmatter
    references/       # 可选
    scripts/          # 可选
    templates/        # 可选
```

`SKILL.md` 示例 frontmatter：

```markdown
# My Skill

description: "Short description of this skill."
tags: [code, review, python]
category: development

---

...
```

---

## 授权

本项目为自用项目，默认保留所有权利。详见 `LICENSE`。
