import * as path from 'node:path';
import * as vscode from 'vscode';
import { BackupService } from './services/backupService';
import { AgentDetector } from './services/agentDetector';
import { getCentralRepository, getConfiguredSources } from './services/config';
import { DiagnosticsService } from './services/diagnostics';
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
            `Detected ${detectedCount} of ${cachedAgents.length} supported agent targets.`,
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
                    `Delete skill "${skillName}"? This will remove ${String(payload.path)}.`,
                    { modal: true },
                    'Delete',
                );
                if (choice !== 'Delete') {
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
                    `Remove source "${String(payload.url)}"?`,
                    { modal: true },
                    'Remove',
                );
                if (choice !== 'Remove') {
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
                    `${target.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
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
                    { title: `Sync ${source.name} to which config?` },
                );
                if (!targetPick) {
                    return;
                }
                await mcpManager.syncServer(
                    source,
                    targetPick.target.configPath,
                );
                vscode.window.showInformationMessage(
                    `Synced ${source.name} to ${targetPick.target.toolName}.`,
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
                    `Agent skills repository is ready: ${repository.path}`,
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
                        'Select a skill from the Skills tree to delete.',
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Delete skill "${skill.name}"? This will remove ${skill.path}.`,
                    { modal: true },
                    'Delete',
                );

                if (choice !== 'Delete') {
                    return;
                }

                const repository = new SkillRepository(getCentralRepository());
                await repository.deleteSkill(skill.path);
                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    `Deleted skill "${skill.name}".`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.removeSource',
            async (node?: SimpleTreeNode) => {
                const source = node?.payload as SourceInfo | undefined;
                if (!source?.url) {
                    vscode.window.showWarningMessage(
                        'Select a source from the Sources tree to remove.',
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Remove source "${source.url}"?`,
                    { modal: true },
                    'Remove',
                );

                if (choice !== 'Remove') {
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
                    `Removed source "${source.url}".`,
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
                    { title: 'Select a skill to bulk-sync' },
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
                        'No agents detected. Run Detect Agents first.',
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
                        title: 'Select target agents to sync',
                    },
                );

                if (!targets || targets.length === 0) {
                    return;
                }

                const modePick = await vscode.window.showQuickPick(
                    [
                        {
                            label: 'Copy',
                            description: 'Most compatible mode',
                            mode: 'copy' as SyncMode,
                        },
                        {
                            label: 'Symlink',
                            description: 'Directory symbolic link',
                            mode: 'symlink' as SyncMode,
                        },
                        {
                            label: 'Junction',
                            description: 'Windows directory junction',
                            mode: 'junction' as SyncMode,
                        },
                    ],
                    { title: 'Select sync mode' },
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
                            `Failed to sync ${skill.name} to ${agent.name}: ${String(error)}`,
                        );
                    }
                }

                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    `Synced ${skill.name} to ${synced} agent(s) using ${modePick.mode}.`,
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
                    `Detected ${cachedMcp.length} MCP server(s) across tools.`,
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
                            description: s.disabled ? 'Disabled' : 'Enabled',
                            server: s,
                        })),
                        { title: 'Select MCP server to toggle' },
                    );
                    if (!pick) {
                        return;
                    }
                    const toggled = await mcpManager.toggleEnabled(pick.server);
                    vscode.window.showInformationMessage(
                        `${pick.server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                    );
                } else {
                    const toggled = await mcpManager.toggleEnabled(server);
                    vscode.window.showInformationMessage(
                        `${server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
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
                        { title: 'Select MCP server to sync' },
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
                        { title: 'Select target tool config' },
                    );
                    if (!targetPick) {
                        return;
                    }
                    await mcpManager.syncServer(
                        pick.server,
                        targetPick.target.configPath,
                    );
                    vscode.window.showInformationMessage(
                        `Synced ${pick.server.name} to ${targetPick.target.toolName}.`,
                    );
                } else {
                    const allSources = buildMcpTargetList();
                    const targetPick = await vscode.window.showQuickPick(
                        allSources.map((t) => ({
                            label: t.toolName,
                            description: t.configPath,
                            target: t,
                        })),
                        { title: 'Select target tool config' },
                    );
                    if (!targetPick) {
                        return;
                    }
                    await mcpManager.syncServer(
                        server,
                        targetPick.target.configPath,
                    );
                    vscode.window.showInformationMessage(
                        `Synced ${server.name} to ${targetPick.target.toolName}.`,
                    );
                }
                await updateManagerPanel();
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.backupRepository',
            async () => {
                const target = await vscode.window.showOpenDialog({
                    title: 'Select backup destination folder',
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Backup Here',
                });

                if (!target?.[0]) {
                    return;
                }

                const backup = new BackupService(getCentralRepository());
                const dest = await backup.backup(target[0].fsPath);
                vscode.window.showInformationMessage(
                    `Repository backed up to ${dest}.`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.restoreRepository',
            async () => {
                const source = await vscode.window.showOpenDialog({
                    title: 'Select backup folder to restore from',
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Restore From',
                });

                if (!source?.[0]) {
                    return;
                }

                const backup = new BackupService(getCentralRepository());
                const restored = await backup.restore(source[0].fsPath);
                await refreshAll();
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    `Restored ${restored.length} item(s): ${restored.join(', ') || '(none)'}.`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.renameSkill',
            async (node?: SimpleTreeNode) => {
                const skill = node?.payload as SkillInfo | undefined;
                if (!skill) {
                    vscode.window.showWarningMessage(
                        'Select a skill from the Skills tree to rename.',
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
                    title: `Rename skill "${currentName}"`,
                    prompt: 'Enter a new name for this skill.',
                    value: currentName,
                    validateInput: (input) =>
                        input.trim().length === 0
                            ? 'Name is required.'
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
                    `Renamed skill to "${newName}".`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.editSkillMarkdown',
            async (node?: SimpleTreeNode) => {
                const skill = node?.payload as SkillInfo | undefined;
                if (!skill) {
                    vscode.window.showWarningMessage(
                        'Select a skill to edit its SKILL.md.',
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
                        'No sources configured.',
                    );
                    return;
                }

                const manager = getSourceManager();
                const skills = await manager.discoverSkills(urls);
                if (skills.length === 0) {
                    vscode.window.showInformationMessage(
                        'No SKILL.md files found. Update the source first.',
                    );
                    return;
                }

                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: [
                        `# Source Skills (${urls.join(', ')})`,
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
                        'No sources configured.',
                    );
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Install ALL skills from source(s)? This may overwrite existing skills.`,
                    { modal: true },
                    'Install All',
                );
                if (choice !== 'Install All') {
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
                    `Installed ${total} skill(s) from source(s).`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.rollbackSync',
            async () => {
                const records = syncManager.getRecords();
                if (records.length === 0) {
                    vscode.window.showInformationMessage(
                        'No sync records to rollback.',
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
                    { title: 'Select sync record to rollback' },
                );

                if (pick === undefined) {
                    return;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Rollback sync of "${records[pick.index].skillName}"? This will remove ${records[pick.index].destinationPath}.`,
                    { modal: true },
                    'Rollback',
                );

                if (choice !== 'Rollback') {
                    return;
                }

                const rolled = await syncManager.rollbackRecord(pick.index);
                await updateManagerPanel();
                vscode.window.showInformationMessage(
                    `Rolled back ${rolled?.skillName ?? ''}.`,
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
                        title: 'Checking MCP server health',
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
                    `${healthy}/${cachedMcp.length} MCP server(s) healthy.`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.checkSourceUpdates',
            async () => {
                const sources = getConfiguredSources();
                if (sources.length === 0) {
                    vscode.window.showInformationMessage(
                        'No sources configured.',
                    );
                    return;
                }

                const manager = getSourceManager();
                const lines: string[] = ['# Source Update Status', ''];

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
                    title: 'Export ASmanager Config',
                    filters: { 'JSON Files': ['json'] },
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
                    'Config exported successfully.',
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.importConfig',
            async () => {
                const source = await vscode.window.showOpenDialog({
                    title: 'Import ASmanager Config',
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'JSON Files': ['json'] },
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
                    'Config imported and applied.',
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.addSource',
            async () => {
                const value = await vscode.window.showInputBox({
                    title: 'Add Skill Source',
                    prompt: 'Enter a GitHub repository URL or remote skill source URL.',
                    placeHolder: 'https://github.com/example/skills',
                    validateInput: (input) =>
                        input.trim().length === 0
                            ? 'Source URL is required.'
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
                        'No skill sources configured.',
                    );
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Updating skill sources',
                        cancellable: false,
                    },
                    async () => {
                        await getSourceManager().updateAll(sources);
                    },
                );

                await refreshAll();
                vscode.window.showInformationMessage(
                    `Updated ${sources.length} skill source(s).`,
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
                        'No skill sources configured.',
                    );
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Updating skill sources',
                        cancellable: false,
                    },
                    async () => {
                        await manager.updateAll(sourceUrls);
                    },
                );

                const sourceSkills = await manager.discoverSkills(sourceUrls);
                if (sourceSkills.length === 0) {
                    vscode.window.showWarningMessage(
                        'No SKILL.md files found in selected source(s).',
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
                    { title: 'Install Skill From Source' },
                );

                if (!selected) {
                    return;
                }

                const destination = await manager.installSkill(selected.skill);
                await refreshAll();
                vscode.window.showInformationMessage(
                    `Installed ${selected.skill.name} to ${destination}.`,
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
                        '# Agent Skills Diagnostics',
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
                        { title: 'Select a skill to sync' },
                    );
                    skill = selected?.skill;
                }

                if (!skill) {
                    return;
                }

                const target = await vscode.window.showOpenDialog({
                    title: `Select destination folder for ${skill.name}`,
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Sync Here',
                });

                const destinationRoot = target?.[0]?.fsPath;
                if (!destinationRoot) {
                    return;
                }

                const modePick = await vscode.window.showQuickPick(
                    [
                        {
                            label: 'Copy',
                            description: 'Most compatible mode',
                            mode: 'copy' as SyncMode,
                        },
                        {
                            label: 'Symlink',
                            description: 'Directory symbolic link',
                            mode: 'symlink' as SyncMode,
                        },
                        {
                            label: 'Junction',
                            description: 'Windows directory junction',
                            mode: 'junction' as SyncMode,
                        },
                    ],
                    { title: 'Select sync mode' },
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
                    `Synced ${skill.name} to ${path.normalize(destination)} using ${modePick.mode}.`,
                );
            },
        ),
        vscode.commands.registerCommand(
            'agentSkillsManager.showSyncRecords',
            async () => {
                const records = syncManager.getRecords();
                const content = [
                    '# Agent Skills Sync Records',
                    '',
                    records.length === 0
                        ? 'No sync records yet.'
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
                    'Clear all Agent Skills sync records?',
                    { modal: true },
                    'Clear',
                );

                if (choice !== 'Clear') {
                    return;
                }

                await syncManager.clearRecords();
                vscode.window.showInformationMessage('Sync records cleared.');
            },
        ),
    );

    await refreshAll();
}

export function deactivate(): void {}
