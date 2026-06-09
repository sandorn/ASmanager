import * as vscode from 'vscode';
import { getConfiguredSources } from '../services/config';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerAddSource(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
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

            await ctx.refreshAll();
        },
    );
}
