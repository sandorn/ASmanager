import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerDetectAgents(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.detectAgents',
        async () => {
            const agents = await ctx.detector.detect();
            ctx.setCachedAgents(agents);
            ctx.agentsProvider.refresh(agents);

            const detectedCount = agents.filter(
                (agent) => agent.detected,
            ).length;
            vscode.window.showInformationMessage(
                localize(
                    `Detected ${detectedCount} of ${agents.length} supported agent targets.`,
                    `已检测到 ${detectedCount}/${agents.length} 个支持的智能体目标。`,
                ),
            );
        },
    );
}
