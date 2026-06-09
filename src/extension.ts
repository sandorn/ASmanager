import * as vscode from 'vscode';
import { AgentDetector } from './services/agentDetector';
import { DiagnosticsService } from './services/diagnostics';
import { McpManager } from './services/mcpManager';
import { SourceManager } from './services/sourceManager';
import { SyncManager } from './services/syncManager';
import { getCentralRepository } from './services/config';
import {
    AgentInfo,
    McpServerInfo,
    SkillInfo,
    SourceInfo,
} from './types/models';
import { AgentsTreeProvider } from './views/agentsTreeProvider';
import { McpTreeProvider } from './views/mcpTreeProvider';
import { SkillsTreeProvider } from './views/skillsTreeProvider';
import { SourcesTreeProvider } from './views/sourcesTreeProvider';
import {
    CommandContext,
    createRefreshAll,
    createBuildMcpTargetList,
    createUpdateManagerPanel,
    createGetDashboardData,
} from './commands/commandContext';
import { registerInitializeRepository } from './commands/initializeRepository';
import { registerRefresh } from './commands/refresh';
import { registerOpenRepository } from './commands/openRepository';
import { registerOpenManager } from './commands/openManager';
import { registerDeleteSkill } from './commands/deleteSkill';
import { registerRemoveSource } from './commands/removeSource';
import { registerSyncSkillToAgents } from './commands/syncSkillToAgents';
import { registerDetectMcp } from './commands/detectMcp';
import { registerToggleMcpServer } from './commands/toggleMcpServer';
import { registerSyncMcpServer } from './commands/syncMcpServer';
import { registerBackupRepository, registerRestoreRepository } from './commands/backupRestore';
import {
    registerRenameSkill,
    registerEditSkillMarkdown,
    registerShowSourceSkills,
    registerInstallAllFromSource,
    registerInstallSkillFromSource,
} from './commands/skillManagement';
import { registerRollbackSync } from './commands/rollbackSync';
import { registerHealthCheckMcp } from './commands/healthCheckMcp';
import { registerCheckSourceUpdates } from './commands/checkSourceUpdates';
import { registerExportConfig, registerImportConfig } from './commands/configIO';
import { registerAddSource } from './commands/addSource';
import { registerUpdateSources } from './commands/updateSources';
import { registerDetectAgents } from './commands/detectAgents';
import { registerDiagnoseSkills } from './commands/diagnoseSkills';
import { registerSyncSkill } from './commands/syncSkill';
import { registerShowSyncRecords, registerClearSyncRecords } from './commands/syncRecords';
import { registerManageSources } from './commands/manageSources';

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

    const getSourceManager = (): SourceManager =>
        new SourceManager(getCentralRepository());

    const getCachedSkills = (): SkillInfo[] => cachedSkills;
    const setCachedSkills = (skills: SkillInfo[]): void => { cachedSkills = skills; };
    const getCachedSources = (): SourceInfo[] => cachedSources;
    const setCachedSources = (sources: SourceInfo[]): void => { cachedSources = sources; };
    const getCachedAgents = (): AgentInfo[] => cachedAgents;
    const setCachedAgents = (agents: AgentInfo[]): void => { cachedAgents = agents; };
    const getCachedMcp = (): McpServerInfo[] => cachedMcp;
    const setCachedMcp = (servers: McpServerInfo[]): void => { cachedMcp = servers; };
    const getManagerPanel = (): vscode.WebviewPanel | undefined => managerPanel;
    const setManagerPanel = (panel: vscode.WebviewPanel | undefined): void => { managerPanel = panel; };

    const refreshAll = createRefreshAll(
        getCachedSkills, setCachedSkills, skillsProvider,
        getCachedSources, setCachedSources, sourcesProvider,
        getSourceManager,
    );

    const buildMcpTargetList = createBuildMcpTargetList(
        getCachedAgents, getCachedMcp,
    );

    const getDashboardData = createGetDashboardData(
        getCachedSkills, getCachedSources, getCachedAgents, getCachedMcp,
        syncManager,
    );

    const updateManagerPanel = createUpdateManagerPanel(
        getManagerPanel, getDashboardData,
    );

    const ctx: CommandContext = {
        skillsProvider,
        agentsProvider,
        sourcesProvider,
        mcpProvider,
        detector,
        diagnostics,
        syncManager,
        mcpManager,
        getSourceManager,
        buildMcpTargetList,
        refreshAll,
        updateManagerPanel,
        getCachedSkills,
        setCachedSkills,
        getCachedSources,
        setCachedSources,
        getCachedAgents,
        setCachedAgents,
        getCachedMcp,
        setCachedMcp,
        getManagerPanel,
        setManagerPanel,
        getDashboardData,
    };

    // Register tree views
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
    );

    // Register all commands
    context.subscriptions.push(
        registerInitializeRepository(context, ctx),
        registerRefresh(context, ctx),
        registerOpenRepository(context, ctx),
        registerOpenManager(context, ctx),
        registerDeleteSkill(context, ctx),
        registerRemoveSource(context, ctx),
        registerSyncSkillToAgents(context, ctx),
        registerDetectMcp(context, ctx),
        registerToggleMcpServer(context, ctx),
        registerSyncMcpServer(context, ctx),
        registerBackupRepository(context, ctx),
        registerRestoreRepository(context, ctx),
        registerRenameSkill(context, ctx),
        registerEditSkillMarkdown(context, ctx),
        registerShowSourceSkills(context, ctx),
        registerInstallAllFromSource(context, ctx),
        registerInstallSkillFromSource(context, ctx),
        registerRollbackSync(context, ctx),
        registerHealthCheckMcp(context, ctx),
        registerCheckSourceUpdates(context, ctx),
        registerExportConfig(context, ctx),
        registerImportConfig(context, ctx),
        registerAddSource(context, ctx),
        registerUpdateSources(context, ctx),
        registerDetectAgents(context, ctx),
        registerDiagnoseSkills(context, ctx),
        registerSyncSkill(context, ctx),
        registerShowSyncRecords(context, ctx),
        registerClearSyncRecords(context, ctx),
        registerManageSources(context, ctx),
    );

    await refreshAll();
}

export function deactivate(): void {}
