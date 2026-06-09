import * as vscode from 'vscode';
import { McpServerInfo } from '../types/models';
import { localize } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerSyncMcpServer(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.syncMcpServer',
        async (node?: SimpleTreeNode) => {
            const server = node?.payload as McpServerInfo | undefined;
            if (!server) {
                let mcpServers = ctx.getCachedMcp();
                if (mcpServers.length === 0) {
                    mcpServers = await ctx.mcpManager.detectAll();
                    ctx.setCachedMcp(mcpServers);
                    ctx.mcpProvider.refresh(mcpServers);
                }
                const pick = await vscode.window.showQuickPick(
                    mcpServers.map((s) => ({
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
                await doSync(ctx, pick.server);
            } else {
                await doSync(ctx, server);
            }
            await ctx.updateManagerPanel();
        },
    );
}

async function doSync(
    ctx: CommandContext,
    source: McpServerInfo,
): Promise<void> {
    const allSources = ctx.buildMcpTargetList();
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
    await ctx.mcpManager.syncServer(
        source,
        targetPick.target.configPath,
    );
    vscode.window.showInformationMessage(
        localize(
            `Synced ${source.name} to ${targetPick.target.toolName}.`,
            `已将 ${source.name} 同步到 ${targetPick.target.toolName}。`,
        ),
    );
}
