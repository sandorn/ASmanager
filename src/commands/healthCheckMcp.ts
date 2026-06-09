import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerHealthCheckMcp(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.healthCheckMcp',
        async () => {
            let mcpServers = ctx.getCachedMcp();
            if (mcpServers.length === 0) {
                mcpServers = await ctx.mcpManager.detectAll();
                ctx.setCachedMcp(mcpServers);
                ctx.mcpProvider.refresh(mcpServers);
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
                    const results = await ctx.mcpManager.healthCheckAll(mcpServers);
                    ctx.setCachedMcp(results);
                },
            );

            const refreshed = ctx.getCachedMcp();
            ctx.mcpProvider.refresh(refreshed);
            await ctx.updateManagerPanel();

            const healthy = refreshed.filter((s) => s.healthy).length;
            vscode.window.showInformationMessage(
                localize(
                    `${healthy}/${refreshed.length} MCP server(s) healthy.`,
                    `${healthy}/${refreshed.length} 个 MCP 服务器健康。`,
                ),
            );
        },
    );
}
