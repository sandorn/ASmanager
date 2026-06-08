import * as path from 'node:path';
import * as vscode from 'vscode';
import { BackupService } from './services/backupService';
import { AgentDetector } from './services/agentDetector';
import { getCentralRepository, getConfiguredSources } from './services/config';
import { DiagnosticsService } from './services/diagnostics';
import { localize, t } from './services/localization';
import { McpManager } from './services/mcpManager';
import { SourceManager } from './services/sourceManager';
import { SkillRepository } from './services/skillRepository';
import * as fs from 'node:fs/promises';
import { SyncManager } from './services/syncManager';
import {
    AgentInfo,
    McpServerInfo,
    SkillInfo,
    SourceInfo,
    SourceSkillInfo,
    SyncMode,
} from './types/models';
import { AgentsTreeProvider } from './views/agentsTreeProvider';
import { McpTreeProvider } from './views/mcpTreeProvider';
import { renderDashboard } from './views/dashboardWebview';
import { SimpleTreeNode } from './views/treeNode';
import { SkillsTreeProvider } from './views/skillsTreeProvider';
import { SourcesTreeProvider } from './views/sourcesTreeProvider';

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const skillsProvider = new SkillsTreeProvider();
    const agentsProvider = new AgentsTreeProvider();
    const sourcesProvider = new SourcesTreeProvider();
    const mcpProvider = new McpTreeProvider();

    const detector = new AgentDetector();
    const diagnostics = new DiagnosticsService();
    const syncManager = new SyncManager(context.globalState);
    const mcpManager = new McpManager();

    let cachedSkills: SkillInfo[] = [];
    let cachedSources: SourceInfo[] = [];
    let cachedAgents: AgentInfo[] = await detector.detect();
    let cachedMcp: McpServerInfo[] = [];
    let managerPanel: vscode.WebviewPanel | undefined;

    function getSourceManager(): SourceManager {
        return new SourceManager(getCentralRepository());
    }

    function buildMcpTargetList(): Array<{
        toolName: string;
        configPath: string;
    }> {
        return [
            ...cachedAgents
                .filter((a) => a.detected)
                .map((a) => ({
                    toolName: a.name,
                    configPath: a.candidatePaths[0],
                })),
            ...cachedMcp.map((s) => ({
                toolName: s.toolName,
                configPath: s.sourcePath,
            })),
        ].filter(
            (item, index, list) =>
                list.findIndex((x) => x.configPath === item.configPath) ===
                index,
        );
    }

    async function refreshAll(): Promise<void> {
        const repository = new SkillRepository(getCentralRepository());
        cachedSkills = await repository.scan();
        skillsProvider.refresh(cachedSkills);

        cachedSources = await getSourceManager().list(getConfiguredSources());
        sourcesProvider.refresh(cachedSources);
    }

    async function detectAgents(): Promise<void> {
        cachedAgents = await detector.detect();
        agentsProvider.refresh(cachedAgents);

        const detectedCount = cachedAgents.filter(
            (agent) => agent.detected,
        ).length;
        vscode.window.showInformationMessage(
            localize(
                `Detected ${detectedCount} of ${cachedAgents.length} supported agent targets.`,
                `已检测到 ${detectedCount}/${cachedAgents.length} 个支持的智能体目标。`,
            ),
        );
    }

    async function updateManagerPanel(): Promise<void> {
        if (!managerPanel) {
            return;
        }

        managerPanel.webview.html = renderDashboard(managerPanel.webview, {
            repositoryPath: getCentralRepository(),
            skills: cachedSkills,
            sources: cachedSources,
            agents: cachedAgents,
            mcpServers: cachedMcp,
            syncRecords: syncManager.getRecords(),
        });
    }

    async function runDashboardCommand(
        command: string,
        payload?: Record<string, unknown>,
    ): Promise<void> {
        switch (command) {
            case 'refresh':
                await refreshAll();
                break;
            case 'deleteSkill': {
                if (!payload?.path) {
                    return;
                }
                const skillName = String(payload.name || '');
                const choice = await vscode.window.showWarningMessage(
                    localize(
                        `Delete skill "${skillName}"? This will remove ${String(payload.path)}.`,
                        `删除技能“${skillName}”？这将移除 ${String(payload.path)}。`,
                    ),
                    { modal: true },
                    t('delete'),
                );
                if (choice !== t('delete')) {
                    return;
                }
                const repository = new SkillRepository(getCentralRepository());
                await repository.deleteSkill(String(payload.path));
                break;
            }
            case 'removeSource': {
                if (!payload?.url) {
                    return;
                }
                const choice = await vscode.window.showWarningMessage(
                    localize(
                        `Remove source "${String(payload.url)}"?`,
                        `移除来源“${String(payload.url)}”？`,
                    ),
                    { modal: true },
                    t('remove'),
                );
                if (choice !== t('remove')) {
                    return;
                }
                const configuration =
                    vscode.workspace.getConfiguration('agentSkillsManager');
                const existing = [...getConfiguredSources()];
                const updated = existing.filter(
                    (url) => url !== String(payload.url),
                );
                await configuration.update(
                    'sources',
                    updated,
                    vscode.ConfigurationTarget.Global,
                );
                await getSourceManager().removeSourceCache(String(payload.url));
                break;
            }
            case 'toggleMcpServer': {
                if (!payload?.name || !payload?.sourcePath) {
                    return;
                }
                const target = cachedMcp.find(
                    (s) =>
                        s.name === String(payload.name) &&
                        s.sourcePath === String(payload.sourcePath),
                );
                if (!target) {
                    return;
                }
                const toggled = await mcpManager.toggleEnabled(target);
                cachedMcp = await mcpManager.detectAll();
                mcpProvider.refresh(cachedMcp);
                vscode.window.showInformationMessage(
                    localize(
                        `${target.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                        `${target.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                    ),
                );
                break;
            }
            case 'syncMcpServer': {
                if (!payload?.name || !payload?.sourcePath) {
                    return;
                }
                const source = cachedMcp.find(
                    (s) =>
                        s.name === String(payload.name) &&
                        s.sourcePath === String(payload.sourcePath),
                );
                if (!source) {
                    return;
                }
                const allTargets = buildMcpTargetList();
                const targetPick = await vscode.window.showQuickPick(
                    allTargets.map((t) => ({
                        label: t.toolName,
                        description: t.configPath,
                        target: t,
                    })),
                    {
                        title: localize(
                            `Sync ${source.name} to which config?`,
                            `将 ${source.name} 同步到哪个配置？`,
                        ),
                    },
                );
                if (!targetPick) {
                    return;
                }
                await mcpManager.syncServer(
                    source,
                    targetPick.target.configPath,
                );
                vscode.window.showInformationMessage(
                    localize(
                        `Synced ${source.name} to ${targetPick.target.toolName}.`,
                        `已将 ${source.name} 同步到 ${targetPick.target.toolName}。`,
                    ),
                );
                break;
            }
            case 'detectMcp':
                cachedMcp = await mcpManager.detectAll();
                mcpProvider.refresh(cachedMcp);
                break;
            case 'updateSources':
            case 'installSkillFromSource':
            case 'detectAgents':
            case 'diagnoseSkills':
            case 'addSource':
            case 'openRepository':
            case 'backupRepository':
            case 'healthCheckMcp':
            case 'showSyncRecords':
            case 'syncSkillToAgents':
                await vscode.commands.executeCommand(
                    `agentSkillsManager.${command}`,
                );
                break;
            default:
                return;
        }

        await refreshAll();
        await updateManagerPanel();
    }

    async function openManager(): Promise<void> {
        if (managerPanel) {
            managerPanel.reveal(vscode.ViewColumn.One);
            await updateManagerPanel();
            return;
        }

        managerPanel = vscode.window.createWebviewPanel(
            'agentSkillsManager.manager',
            'ASmanager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        managerPanel.onDidDispose(() => {
            managerPanel = undefined;
        });

        managerPanel.webview.onDidReceiveMessage(
            async (message: {
                command?: string;
                payload?: Record<string, unknown>;
            }) => {
                if (message.command) {
                    await runDashboardCommand(message.command, message.payload);
                }
            },
        );

        await updateManagerPanel();
    }

    context.subscriptions.push(
        vscode.window.createTreeView('agentSkillsManager.skills', {
            treeDataProvider: skillsProvider,
            showCollapseAll: true,
        }),
        vscode.window.createTreeView('agentSkillsManager.agents', {
            treeDataProvider: agentsProvider,
            showCollapseAll: true,
        }),
        vscode.window.createTreeView('agentSkillsManager.sources', {
            treeDataProvider: sourcesProvider,
            showCollapseAll: true,
        }),
        vscode.window.createTreeView('agentSkillsManager.mcp', {
            treeDataProvider: mcpProvider,
            showCollapseAll: true,
        }),
        vscode.commands.registerCommand(
            'agentSkillsManager.initializeRepository',
            async () => {
                const repository = new SkillRepository(getCentralRepository());
                await repository.initialize();
                await refreshAll();
                vscode.window.showInformationMessage(
                    localize(
                        `Agent skills repository is ready: ${repository.path}`,
                        `智能体技能仓库已就绪：${repository.path}`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.refresh',
            async () => {
                await refreshAll();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.openRepository',
            async () => {
                const repositoryPath = getCentralRepository();
                await vscode.commands.executeCommand(
                    'vscode.openFolder',
                    vscode.Uri.file(repositoryPath),
                    { forceNewWindow: false },
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.openManager',
            async () => {
                await refreshAll();
                agentsProvider.refresh(cachedAgents);
                cachedMcp = await mcpManager.detectAll();
                mcpProvider.refresh(cachedMcp);
                await openManager();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.deleteSkill',
            async (node?: SimpleTreeNode) => {
                const skill = node?.payload as SkillInfo | undefined;
                if (!skill) {
                    vscode.window.showWarningMessage(
                        localize(
                            'Select a skill from the Skills tree to delete.',
                            '请从技能树中选择要删除的技能。',
                        ),
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    localize(
                        `Delete skill "${skill.name}"? This will remove ${skill.path}.`,
                        `删除技能“${skill.name}”？这将移除 ${skill.path}。`,
                    ),
                    { modal: true },
                    t('delete'),
                );

                if (choice !== t('delete')) {
                    return;
                }

                const repository = new SkillRepository(getCentralRepository());
                await repository.deleteSkill(skill.path);
                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Deleted skill "${skill.name}".`,
                        `已删除技能“${skill.name}”。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.removeSource',
            async (node?: SimpleTreeNode) => {
                const source = node?.payload as SourceInfo | undefined;
                if (!source?.url) {
                    vscode.window.showWarningMessage(
                        localize(
                            'Select a source from the Sources tree to remove.',
                            '请从来源树中选择要移除的来源。',
                        ),
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    localize(
                        `Remove source "${source.url}"?`,
                        `移除来源“${source.url}”？`,
                    ),
                    { modal: true },
                    t('remove'),
                );

                if (choice !== t('remove')) {
                    return;
                }

                const configuration =
                    vscode.workspace.getConfiguration('agentSkillsManager');
                const existing = [...getConfiguredSources()];
                const updated = existing.filter((url) => url !== source.url);
                await configuration.update(
                    'sources',
                    updated,
                    vscode.ConfigurationTarget.Global,
                );

                await getSourceManager().removeSourceCache(source.url);
                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Removed source "${source.url}".`,
                        `已移除来源“${source.url}”。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.syncSkillToAgents',
            async () => {
                if (cachedSkills.length === 0) {
                    await refreshAll();
                }

                if (cachedAgents.length === 0) {
                    cachedAgents = await detector.detect();
                    agentsProvider.refresh(cachedAgents);
                }

                const selected = await vscode.window.showQuickPick(
                    cachedSkills.map((item) => ({
                        label: item.name,
                        description: item.description,
                        skill: item,
                    })),
                    {
                        title: localize(
                            'Select a skill to bulk-sync',
                            '选择要批量同步的技能',
                        ),
                    },
                );

                const skill = selected?.skill as SkillInfo | undefined;
                if (!skill) {
                    return;
                }

                const detectedAgents = cachedAgents.filter(
                    (agent) => agent.detected,
                );
                if (detectedAgents.length === 0) {
                    vscode.window.showWarningMessage(
                        localize(
                            'No agents detected. Run Detect Agents first.',
                            '未检测到智能体。请先运行检测智能体。',
                        ),
                    );
                    return;
                }

                const targets = await vscode.window.showQuickPick(
                    detectedAgents.map((agent) => ({
                        label: agent.name,
                        description: agent.detail,
                        agent,
                    })),
                    {
                        canPickMany: true,
                        title: localize(
                            'Select target agents to sync',
                            '选择要同步的目标智能体',
                        ),
                    },
                );

                if (!targets || targets.length === 0) {
                    return;
                }

                const modePick = await vscode.window.showQuickPick(
                    [
                        {
                            label: localize('Copy', '复制'),
                            description: localize(
                                'Most compatible mode',
                                '兼容性最好的模式',
                            ),
                            mode: 'copy' as SyncMode,
                        },
                        {
                            label: localize('Symlink', '符号链接'),
                            description: localize(
                                'Directory symbolic link',
                                '目录符号链接',
                            ),
                            mode: 'symlink' as SyncMode,
                        },
                        {
                            label: localize('Junction', '目录联接'),
                            description: localize(
                                'Windows directory junction',
                                'Windows 目录联接',
                            ),
                            mode: 'junction' as SyncMode,
                        },
                    ],
                    { title: localize('Select sync mode', '选择同步模式') },
                );

                if (!modePick) {
                    return;
                }

                let synced = 0;
                for (const target of targets) {
                    const agent = target.agent as AgentInfo;
                    const destPath =
                        agent.candidatePaths.find((p) => p.length > 0) ||
                        agent.candidatePaths[0];
                    if (!destPath) {
                        continue;
                    }

                    try {
                        await syncManager.copySkill(
                            skill,
                            destPath,
                            modePick.mode,
                        );
                        synced += 1;
                    } catch (error) {
                        vscode.window.showWarningMessage(
                            localize(
                                `Failed to sync ${skill.name} to ${agent.name}: ${String(error)}`,
                                `同步 ${skill.name} 到 ${agent.name} 失败：${String(error)}`,
                            ),
                        );
                    }
                }

                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Synced ${skill.name} to ${synced} agent(s) using ${modePick.mode}.`,
                        `已使用 ${modePick.mode} 将 ${skill.name} 同步到 ${synced} 个智能体。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.detectMcp',
            async () => {
                cachedMcp = await mcpManager.detectAll();
                mcpProvider.refresh(cachedMcp);
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Detected ${cachedMcp.length} MCP server(s) across tools.`,
                        `已在各工具中检测到 ${cachedMcp.length} 个 MCP 服务器。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.toggleMcpServer',
            async (node?: SimpleTreeNode) => {
                const server = node?.payload as McpServerInfo | undefined;
                if (!server) {
                    if (cachedMcp.length === 0) {
                        cachedMcp = await mcpManager.detectAll();
                        mcpProvider.refresh(cachedMcp);
                    }
                    const pick = await vscode.window.showQuickPick(
                        cachedMcp.map((s) => ({
                            label: `${s.toolName}: ${s.name}`,
                            description: s.disabled
                                ? t('disabled')
                                : t('enabled'),
                            server: s,
                        })),
                        {
                            title: localize(
                                'Select MCP server to toggle',
                                '选择要切换状态的 MCP 服务器',
                            ),
                        },
                    );
                    if (!pick) {
                        return;
                    }
                    const toggled = await mcpManager.toggleEnabled(pick.server);
                    vscode.window.showInformationMessage(
                        localize(
                            `${pick.server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                            `${pick.server.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                        ),
                    );
                } else {
                    const toggled = await mcpManager.toggleEnabled(server);
                    vscode.window.showInformationMessage(
                        localize(
                            `${server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                            `${server.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                        ),
                    );
                }
                cachedMcp = await mcpManager.detectAll();
                mcpProvider.refresh(cachedMcp);
                await updateManagerPanel();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.syncMcpServer',
            async (node?: SimpleTreeNode) => {
                const server = node?.payload as McpServerInfo | undefined;
                if (!server) {
                    if (cachedMcp.length === 0) {
                        cachedMcp = await mcpManager.detectAll();
                        mcpProvider.refresh(cachedMcp);
                    }
                    const pick = await vscode.window.showQuickPick(
                        cachedMcp.map((s) => ({
                            label: `${s.toolName}: ${s.name}`,
                            description: s.command,
                            server: s,
                        })),
                        {
                            title: localize(
                                'Select MCP server to sync',
                                '选择要同步的 MCP 服务器',
                            ),
                        },
                    );
                    if (!pick) {
                        return;
                    }
                    const allSources = buildMcpTargetList();
                    const targetPick = await vscode.window.showQuickPick(
                        allSources.map((t) => ({
                            label: t.toolName,
                            description: t.configPath,
                            target: t,
                        })),
                        {
                            title: localize(
                                'Select target tool config',
                                '选择目标工具配置',
                            ),
                        },
                    );
                    if (!targetPick) {
                        return;
                    }
                    await mcpManager.syncServer(
                        pick.server,
                        targetPick.target.configPath,
                    );
                    vscode.window.showInformationMessage(
                        localize(
                            `Synced ${pick.server.name} to ${targetPick.target.toolName}.`,
                            `已将 ${pick.server.name} 同步到 ${targetPick.target.toolName}。`,
                        ),
                    );
                } else {
                    const allSources = buildMcpTargetList();
                    const targetPick = await vscode.window.showQuickPick(
                        allSources.map((t) => ({
                            label: t.toolName,
                            description: t.configPath,
                            target: t,
                        })),
                        {
                            title: localize(
                                'Select target tool config',
                                '选择目标工具配置',
                            ),
                        },
                    );
                    if (!targetPick) {
                        return;
                    }
                    await mcpManager.syncServer(
                        server,
                        targetPick.target.configPath,
                    );
                    vscode.window.showInformationMessage(
                        localize(
                            `Synced ${server.name} to ${targetPick.target.toolName}.`,
                            `已将 ${server.name} 同步到 ${targetPick.target.toolName}。`,
                        ),
                    );
                }
                await updateManagerPanel();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.backupRepository',
            async () => {
                const target = await vscode.window.showOpenDialog({
                    title: localize(
                        'Select backup destination folder',
                        '选择备份目标文件夹',
                    ),
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: localize('Backup Here', '备份到这里'),
                });

                if (!target?.[0]) {
                    return;
                }

                const backup = new BackupService(getCentralRepository());
                const dest = await backup.backup(target[0].fsPath);
                vscode.window.showInformationMessage(
                    localize(
                        `Repository backed up to ${dest}.`,
                        `仓库已备份到 ${dest}。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.restoreRepository',
            async () => {
                const source = await vscode.window.showOpenDialog({
                    title: localize(
                        'Select backup folder to restore from',
                        '选择要恢复的备份文件夹',
                    ),
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: localize('Restore From', '从这里恢复'),
                });

                if (!source?.[0]) {
                    return;
                }

                const backup = new BackupService(getCentralRepository());
                const restored = await backup.restore(source[0].fsPath);
                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Restored ${restored.length} item(s): ${restored.join(', ') || '(none)'}.`,
                        `已恢复 ${restored.length} 项：${restored.join(', ') || '（无）'}。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.renameSkill',
            async (node?: SimpleTreeNode) => {
                const skill = node?.payload as SkillInfo | undefined;
                if (!skill) {
                    vscode.window.showWarningMessage(
                        localize(
                            'Select a skill from the Skills tree to rename.',
                            '请从技能树中选择要重命名的技能。',
                        ),
                    );
                    return;
                }

                const marker =
                    skill.skillFile &&
                    (await fs
                        .access(skill.skillFile)
                        .then(() => true)
                        .catch(() => false))
                        ? await fs.readFile(skill.skillFile, 'utf8')
                        : '';

                const headingMatch = marker.match(/^#\s+(.+)$/m);
                const currentName = headingMatch?.[1]?.trim() || skill.name;

                const newName = await vscode.window.showInputBox({
                    title: localize(
                        `Rename skill "${currentName}"`,
                        `重命名技能“${currentName}”`,
                    ),
                    prompt: localize(
                        'Enter a new name for this skill.',
                        '请输入这个技能的新名称。',
                    ),
                    value: currentName,
                    validateInput: (input) =>
                        input.trim().length === 0
                            ? localize('Name is required.', '名称不能为空。')
                            : undefined,
                });

                if (!newName || newName === currentName) {
                    return;
                }

                if (headingMatch) {
                    const updated = marker.replace(/^#\s+.+$/m, `# ${newName}`);
                    await fs.writeFile(skill.skillFile, updated, 'utf8');
                }

                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Renamed skill to "${newName}".`,
                        `已将技能重命名为“${newName}”。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.editSkillMarkdown',
            async (node?: SimpleTreeNode) => {
                const skill = node?.payload as SkillInfo | undefined;
                if (!skill) {
                    vscode.window.showWarningMessage(
                        localize(
                            'Select a skill to edit its SKILL.md.',
                            '请选择要编辑 SKILL.md 的技能。',
                        ),
                    );
                    return;
                }
                const doc = await vscode.workspace.openTextDocument(
                    vscode.Uri.file(skill.skillFile),
                );
                await vscode.window.showTextDocument(doc);
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.showSourceSkills',
            async (node?: SimpleTreeNode) => {
                const source = node?.payload as SourceInfo | undefined;
                const urls = source?.url
                    ? [source.url]
                    : getConfiguredSources();
                if (urls.length === 0) {
                    vscode.window.showInformationMessage(
                        t('noSourcesConfiguredTable'),
                    );
                    return;
                }

                const manager = getSourceManager();
                const skills = await manager.discoverSkills(urls);
                if (skills.length === 0) {
                    vscode.window.showInformationMessage(
                        localize(
                            'No SKILL.md files found. Update the source first.',
                            '未找到 SKILL.md 文件。请先更新来源。',
                        ),
                    );
                    return;
                }

                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: [
                        localize(
                            `# Source Skills (${urls.join(', ')})`,
                            `# 来源技能（${urls.join(', ')}）`,
                        ),
                        '',
                        ...skills.map(
                            (s) =>
                                `- **${s.name}** — ${s.description} (${s.path})`,
                        ),
                    ].join('\n'),
                });
                await vscode.window.showTextDocument(doc);
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.installAllFromSource',
            async (node?: SimpleTreeNode) => {
                const source = node?.payload as SourceInfo | undefined;
                const urls = source?.url
                    ? [source.url]
                    : getConfiguredSources();
                if (urls.length === 0) {
                    vscode.window.showInformationMessage(
                        t('noSourcesConfiguredTable'),
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    localize(
                        'Install ALL skills from source(s)? This may overwrite existing skills.',
                        '安装来源中的全部技能？这可能会覆盖现有技能。',
                    ),
                    { modal: true },
                    localize('Install All', '全部安装'),
                );
                if (choice !== localize('Install All', '全部安装')) {
                    return;
                }

                const manager = getSourceManager();
                let total = 0;
                for (const url of urls) {
                    const installed = await manager.installAllFromSource(url);
                    total += installed.length;
                }

                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Installed ${total} skill(s) from source(s).`,
                        `已从来源安装 ${total} 个技能。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.rollbackSync',
            async () => {
                const records = syncManager.getRecords();
                if (records.length === 0) {
                    vscode.window.showInformationMessage(
                        localize(
                            'No sync records to rollback.',
                            '没有可回滚的同步记录。',
                        ),
                    );
                    return;
                }

                const pick = await vscode.window.showQuickPick(
                    records.map((r, i) => ({
                        label: `${r.skillName} (${r.mode})`,
                        description: r.destinationPath,
                        detail: r.syncedAt,
                        index: i,
                    })),
                    {
                        title: localize(
                            'Select sync record to rollback',
                            '选择要回滚的同步记录',
                        ),
                    },
                );

                if (pick === undefined) {
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    localize(
                        `Rollback sync of "${records[pick.index].skillName}"? This will remove ${records[pick.index].destinationPath}.`,
                        `回滚“${records[pick.index].skillName}”的同步？这将移除 ${records[pick.index].destinationPath}。`,
                    ),
                    { modal: true },
                    localize('Rollback', '回滚'),
                );

                if (choice !== localize('Rollback', '回滚')) {
                    return;
                }

                const rolled = await syncManager.rollbackRecord(pick.index);
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    localize(
                        `Rolled back ${rolled?.skillName ?? ''}.`,
                        `已回滚 ${rolled?.skillName ?? ''}。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.healthCheckMcp',
            async () => {
                if (cachedMcp.length === 0) {
                    cachedMcp = await mcpManager.detectAll();
                    mcpProvider.refresh(cachedMcp);
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize(
                            'Checking MCP server health',
                            '正在检查 MCP 服务器健康状态',
                        ),
                        cancellable: false,
                    },
                    async () => {
                        cachedMcp = await mcpManager.healthCheckAll(cachedMcp);
                    },
                );

                mcpProvider.refresh(cachedMcp);
                await updateManagerPanel();

                const healthy = cachedMcp.filter((s) => s.healthy).length;
                vscode.window.showInformationMessage(
                    localize(
                        `${healthy}/${cachedMcp.length} MCP server(s) healthy.`,
                        `${healthy}/${cachedMcp.length} 个 MCP 服务器健康。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.checkSourceUpdates',
            async () => {
                const sources = getConfiguredSources();
                if (sources.length === 0) {
                    vscode.window.showInformationMessage(
                        t('noSourcesConfiguredTable'),
                    );
                    return;
                }

                const manager = getSourceManager();
                const lines: string[] = [
                    localize('# Source Update Status', '# 来源更新状态'),
                    '',
                ];

                for (const url of sources) {
                    const status = await manager.checkForUpdates(url);
                    lines.push(
                        `- **${url.replace(/^https?:\/\//, '')}**: ${status.detail}`,
                    );
                }

                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: lines.join('\n'),
                });
                await vscode.window.showTextDocument(doc);
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.exportConfig',
            async () => {
                const target = await vscode.window.showSaveDialog({
                    title: localize(
                        'Export ASmanager Config',
                        '导出 ASmanager 配置',
                    ),
                    filters: {
                        [localize('JSON Files', 'JSON 文件')]: ['json'],
                    },
                    defaultUri: vscode.Uri.file('asmanager-config.json'),
                });

                if (!target) {
                    return;
                }

                const config =
                    vscode.workspace.getConfiguration('agentSkillsManager');
                const data: Record<string, unknown> = {};
                const keys = ['centralRepository', 'sources'];
                for (const key of keys) {
                    const inspected = config.inspect(key);
                    data[key] =
                        inspected?.globalValue ??
                        inspected?.workspaceValue ??
                        inspected?.defaultValue;
                }

                const content = JSON.stringify(data, null, 2);
                await fs.writeFile(target.fsPath, content, 'utf8');
                vscode.window.showInformationMessage(
                    localize(
                        'Config exported successfully.',
                        '配置已成功导出。',
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.importConfig',
            async () => {
                const source = await vscode.window.showOpenDialog({
                    title: localize(
                        'Import ASmanager Config',
                        '导入 ASmanager 配置',
                    ),
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        [localize('JSON Files', 'JSON 文件')]: ['json'],
                    },
                });

                if (!source?.[0]) {
                    return;
                }

                const content = await fs.readFile(source[0].fsPath, 'utf8');
                const data = JSON.parse(content) as Record<string, unknown>;

                const configuration =
                    vscode.workspace.getConfiguration('agentSkillsManager');

                if (typeof data.centralRepository === 'string') {
                    await configuration.update(
                        'centralRepository',
                        data.centralRepository,
                        vscode.ConfigurationTarget.Global,
                    );
                }

                if (Array.isArray(data.sources)) {
                    await configuration.update(
                        'sources',
                        data.sources,
                        vscode.ConfigurationTarget.Global,
                    );
                }

                await refreshAll();
                vscode.window.showInformationMessage(
                    localize(
                        'Config imported and applied.',
                        '配置已导入并应用。',
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.addSource',
            async () => {
                const value = await vscode.window.showInputBox({
                    title: localize('Add Skill Source', '添加技能来源'),
                    prompt: localize(
                        'Enter a GitHub repository URL or remote skill source URL.',
                        '请输入 GitHub 仓库 URL 或远程技能来源 URL。',
                    ),
                    placeHolder: 'https://github.com/example/skills',
                    validateInput: (input) =>
                        input.trim().length === 0
                            ? localize(
                                  'Source URL is required.',
                                  '来源 URL 不能为空。',
                              )
                            : undefined,
                });

                if (!value) {
                    return;
                }

                const configuration =
                    vscode.workspace.getConfiguration('agentSkillsManager');
                const sources = [...getConfiguredSources()];
                if (!sources.includes(value.trim())) {
                    sources.push(value.trim());
                    await configuration.update(
                        'sources',
                        sources,
                        vscode.ConfigurationTarget.Global,
                    );
                }

                await refreshAll();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.updateSources',
            async () => {
                const sources = getConfiguredSources();
                if (sources.length === 0) {
                    vscode.window.showInformationMessage(
                        localize(
                            'No skill sources configured.',
                            '未配置技能来源。',
                        ),
                    );
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize(
                            'Updating skill sources',
                            '正在更新技能来源',
                        ),
                        cancellable: false,
                    },
                    async () => {
                        await getSourceManager().updateAll(sources);
                    },
                );

                await refreshAll();
                vscode.window.showInformationMessage(
                    localize(
                        `Updated ${sources.length} skill source(s).`,
                        `已更新 ${sources.length} 个技能来源。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.installSkillFromSource',
            async (node?: SimpleTreeNode) => {
                const source = node?.payload as SourceInfo | undefined;
                const sourceUrls = source?.url
                    ? [source.url]
                    : getConfiguredSources();
                const manager = getSourceManager();

                if (sourceUrls.length === 0) {
                    vscode.window.showInformationMessage(
                        localize(
                            'No skill sources configured.',
                            '未配置技能来源。',
                        ),
                    );
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize(
                            'Updating skill sources',
                            '正在更新技能来源',
                        ),
                        cancellable: false,
                    },
                    async () => {
                        await manager.updateAll(sourceUrls);
                    },
                );

                const sourceSkills = await manager.discoverSkills(sourceUrls);
                if (sourceSkills.length === 0) {
                    vscode.window.showWarningMessage(
                        localize(
                            'No SKILL.md files found in selected source(s).',
                            '所选来源中未找到 SKILL.md 文件。',
                        ),
                    );
                    return;
                }

                const selected = await vscode.window.showQuickPick(
                    sourceSkills.map((skill: SourceSkillInfo) => ({
                        label: skill.name,
                        description: skill.description,
                        detail: skill.sourceUrl,
                        skill,
                    })),
                    {
                        title: localize(
                            'Install Skill From Source',
                            '从来源安装技能',
                        ),
                    },
                );

                if (!selected) {
                    return;
                }

                const destination = await manager.installSkill(selected.skill);
                await refreshAll();
                vscode.window.showInformationMessage(
                    localize(
                        `Installed ${selected.skill.name} to ${destination}.`,
                        `已将 ${selected.skill.name} 安装到 ${destination}。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.detectAgents',
            detectAgents,
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.diagnoseSkills',
            async () => {
                if (cachedSkills.length === 0) {
                    await refreshAll();
                }

                const issues = diagnostics.diagnose(cachedSkills);
                if (issues.length === 0) {
                    vscode.window.showInformationMessage(
                        'No skill issues found.',
                    );
                    return;
                }

                const document = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: [
                        localize(
                            '# Agent Skills Diagnostics',
                            '# 智能体技能诊断',
                        ),
                        '',
                        ...issues.map(
                            (issue) =>
                                `- **${issue.severity}** ${issue.skillName}: ${issue.message}`,
                        ),
                    ].join('\n'),
                });
                await vscode.window.showTextDocument(document);
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.syncSkill',
            async (node?: SimpleTreeNode) => {
                let skill = node?.payload as SkillInfo | undefined;

                if (!skill) {
                    if (cachedSkills.length === 0) {
                        await refreshAll();
                    }

                    const selected = await vscode.window.showQuickPick(
                        cachedSkills.map((item) => ({
                            label: item.name,
                            description: item.description,
                            skill: item,
                        })),
                        {
                            title: localize(
                                'Select a skill to sync',
                                '选择要同步的技能',
                            ),
                        },
                    );
                    skill = selected?.skill;
                }

                if (!skill) {
                    return;
                }

                const target = await vscode.window.showOpenDialog({
                    title: localize(
                        `Select destination folder for ${skill.name}`,
                        `选择 ${skill.name} 的目标文件夹`,
                    ),
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: localize('Sync Here', '同步到这里'),
                });

                const destinationRoot = target?.[0]?.fsPath;
                if (!destinationRoot) {
                    return;
                }

                const modePick = await vscode.window.showQuickPick(
                    [
                        {
                            label: localize('Copy', '复制'),
                            description: localize(
                                'Most compatible mode',
                                '兼容性最好的模式',
                            ),
                            mode: 'copy' as SyncMode,
                        },
                        {
                            label: localize('Symlink', '符号链接'),
                            description: localize(
                                'Directory symbolic link',
                                '目录符号链接',
                            ),
                            mode: 'symlink' as SyncMode,
                        },
                        {
                            label: localize('Junction', '目录联接'),
                            description: localize(
                                'Windows directory junction',
                                'Windows 目录联接',
                            ),
                            mode: 'junction' as SyncMode,
                        },
                    ],
                    { title: localize('Select sync mode', '选择同步模式') },
                );

                if (!modePick) {
                    return;
                }

                const destination = await syncManager.copySkill(
                    skill,
                    destinationRoot,
                    modePick.mode,
                );
                vscode.window.showInformationMessage(
                    localize(
                        `Synced ${skill.name} to ${path.normalize(destination)} using ${modePick.mode}.`,
                        `已使用 ${modePick.mode} 将 ${skill.name} 同步到 ${path.normalize(destination)}。`,
                    ),
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.showSyncRecords',
            async () => {
                const records = syncManager.getRecords();
                const content = [
                    localize(
                        '# Agent Skills Sync Records',
                        '# 智能体技能同步记录',
                    ),
                    '',
                    records.length === 0
                        ? t('noSyncRecordsYet')
                        : records
                              .map(
                                  (record) =>
                                      `- **${record.skillName}** ${record.mode} ${record.sourcePath} -> ${record.destinationPath} (${record.syncedAt})`,
                              )
                              .join('\n'),
                ].join('\n');

                const document = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content,
                });
                await vscode.window.showTextDocument(document);
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.clearSyncRecords',
            async () => {
                const choice = await vscode.window.showWarningMessage(
                    localize(
                        'Clear all Agent Skills sync records?',
                        '清除全部智能体技能同步记录？',
                    ),
                    { modal: true },
                    localize('Clear', '清除'),
                );

                if (choice !== localize('Clear', '清除')) {
                    return;
                }

                await syncManager.clearRecords();
                vscode.window.showInformationMessage(
                    localize('Sync records cleared.', '同步记录已清除。'),
                );
            },
        ),
    );

    await refreshAll();
}

export function deactivate(): void {}
