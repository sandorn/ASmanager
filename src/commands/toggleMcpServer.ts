import * as vscode from 'vscode';
import { McpServerInfo } from '../types/models';
import { localize, t } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerToggleMcpServer(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.toggleMcpServer',
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
                const toggled = await ctx.mcpManager.toggleEnabled(pick.server);
                vscode.window.showInformationMessage(
                    localize(
                        `${pick.server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                        `${pick.server.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                    ),
                );
            } else {
                const toggled = await ctx.mcpManager.toggleEnabled(server);
                vscode.window.showInformationMessage(
                    localize(
                        `${server.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                        `${server.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                    ),
                );
            }
            const refreshed = await ctx.mcpManager.detectAll();
            ctx.setCachedMcp(refreshed);
            ctx.mcpProvider.refresh(refreshed);
            await ctx.updateManagerPanel();
        },
    );
}
