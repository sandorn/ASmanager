import * as vscode from 'vscode';
import { AgentDetector } from '../services/agentDetector';
import { DiagnosticsService } from '../services/diagnostics';
import { McpManager } from '../services/mcpManager';
import { SourceManager } from '../services/sourceManager';
import { SkillRepository } from '../services/skillRepository';
import { SyncManager } from '../services/syncManager';
import {
    AgentInfo,
    McpServerInfo,
    SkillInfo,
    SourceInfo,
} from '../types/models';
import { AgentsTreeProvider } from '../views/agentsTreeProvider';
import { McpTreeProvider } from '../views/mcpTreeProvider';
import { SkillsTreeProvider } from '../views/skillsTreeProvider';
import { SourcesTreeProvider } from '../views/sourcesTreeProvider';
import { getCentralRepository, getConfiguredSources } from '../services/config';
import { renderDashboard, DashboardData } from '../views/dashboardWebview';

export interface CommandContext {
    skillsProvider: SkillsTreeProvider;
    agentsProvider: AgentsTreeProvider;
    sourcesProvider: SourcesTreeProvider;
    mcpProvider: McpTreeProvider;
    detector: AgentDetector;
    diagnostics: DiagnosticsService;
    syncManager: SyncManager;
    mcpManager: McpManager;
    getSourceManager: () => SourceManager;
    buildMcpTargetList: () => Array<{ toolName: string; configPath: string }>;
    refreshAll: () => Promise<void>;
    updateManagerPanel: () => Promise<void>;
    getCachedSkills: () => SkillInfo[];
    setCachedSkills: (skills: SkillInfo[]) => void;
    getCachedSources: () => SourceInfo[];
    setCachedSources: (sources: SourceInfo[]) => void;
    getCachedAgents: () => AgentInfo[];
    setCachedAgents: (agents: AgentInfo[]) => void;
    getCachedMcp: () => McpServerInfo[];
    setCachedMcp: (servers: McpServerInfo[]) => void;
    getManagerPanel: () => vscode.WebviewPanel | undefined;
    setManagerPanel: (panel: vscode.WebviewPanel | undefined) => void;
    getDashboardData: () => DashboardData;
}

export function createRefreshAll(
    getCachedSkills: () => SkillInfo[],
    setCachedSkills: (skills: SkillInfo[]) => void,
    skillsProvider: SkillsTreeProvider,
    getCachedSources: () => SourceInfo[],
    setCachedSources: (sources: SourceInfo[]) => void,
    sourcesProvider: SourcesTreeProvider,
    getSourceManager: () => SourceManager,
): () => Promise<void> {
    return async () => {
        const repository = new SkillRepository(getCentralRepository());
        const skills = await repository.scan();
        setCachedSkills(skills);
        skillsProvider.refresh(skills);

        const sources = await getSourceManager().list(getConfiguredSources());
        setCachedSources(sources);
        sourcesProvider.refresh(sources);
    };
}

export function createBuildMcpTargetList(
    getCachedAgents: () => AgentInfo[],
    getCachedMcp: () => McpServerInfo[],
): () => Array<{ toolName: string; configPath: string }> {
    return () => {
        const agents = getCachedAgents();
        const mcpServers = getCachedMcp();
        return [
            ...agents
                .filter((a) => a.detected)
                .map((a) => ({
                    toolName: a.name,
                    configPath: a.candidatePaths[0],
                })),
            ...mcpServers.map((s) => ({
                toolName: s.toolName,
                configPath: s.sourcePath,
            })),
        ].filter(
            (item, index, list) =>
                list.findIndex((x) => x.configPath === item.configPath) ===
                index,
        );
    };
}

export function createUpdateManagerPanel(
    getManagerPanel: () => vscode.WebviewPanel | undefined,
    getDashboardData: () => DashboardData,
): () => Promise<void> {
    return async () => {
        const panel = getManagerPanel();
        if (!panel) {
            return;
        }
        panel.webview.html = renderDashboard(panel.webview, getDashboardData());
    };
}

export function createGetDashboardData(
    getCachedSkills: () => SkillInfo[],
    getCachedSources: () => SourceInfo[],
    getCachedAgents: () => AgentInfo[],
    getCachedMcp: () => McpServerInfo[],
    syncManager: SyncManager,
): () => DashboardData {
    return () => ({
        repositoryPath: getCentralRepository(),
        skills: getCachedSkills(),
        sources: getCachedSources(),
        agents: getCachedAgents(),
        mcpServers: getCachedMcp(),
        syncRecords: syncManager.getRecords(),
    });
}
