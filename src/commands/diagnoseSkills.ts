import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerDiagnoseSkills(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.diagnoseSkills',
        async () => {
            let skills = ctx.getCachedSkills();
            if (skills.length === 0) {
                await ctx.refreshAll();
                skills = ctx.getCachedSkills();
            }

            const issues = ctx.diagnostics.diagnose(skills);
            if (issues.length === 0) {
                vscode.window.showInformationMessage(
                    localize(
                        'No skill issues found.',
                        '未发现技能问题。',
                    ),
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
    );
}
