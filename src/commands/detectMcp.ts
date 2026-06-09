import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerDetectMcp(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.detectMcp',
        async () => {
            const mcpServers = await ctx.mcpManager.detectAll();
            ctx.setCachedMcp(mcpServers);
            ctx.mcpProvider.refresh(mcpServers);
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Detected ${mcpServers.length} MCP server(s) across tools.`,
                    `已在各工具中检测到 ${mcpServers.length} 个 MCP 服务器。`,
                ),
            );
        },
    );
}
