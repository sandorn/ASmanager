import * as path from 'node:path';
import * as vscode from 'vscode';
import { AgentInfo, SkillInfo, SyncMode } from '../types/models';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerSyncSkillToAgents(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.syncSkillToAgents',
        async () => {
            let skills = ctx.getCachedSkills();
            if (skills.length === 0) {
                await ctx.refreshAll();
                skills = ctx.getCachedSkills();
            }

            let agents = ctx.getCachedAgents();
            if (agents.length === 0) {
                agents = await ctx.detector.detect();
                ctx.setCachedAgents(agents);
                ctx.agentsProvider.refresh(agents);
            }

            const selected = await vscode.window.showQuickPick(
                skills.map((item) => ({
                    label: item.name,
                    description: item.description,
                    skill: item,
                })),
                {
                    title: localize(
                        'Select a skill to bulk-sync',
                        '选择要批量同步的技能',
                    ),
                },
            );

            const skill = selected?.skill as SkillInfo | undefined;
            if (!skill) {
                return;
            }

            const detectedAgents = agents.filter(
                (agent) => agent.detected,
            );
            if (detectedAgents.length === 0) {
                vscode.window.showWarningMessage(
                    localize(
                        'No agents detected. Run Detect Agents first.',
                        '未检测到智能体。请先运行检测智能体。',
                    ),
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
                    title: localize(
                        'Select target agents to sync',
                        '选择要同步的目标智能体',
                    ),
                },
            );

            if (!targets || targets.length === 0) {
                return;
            }

            const modePick = await vscode.window.showQuickPick(
                [
                    {
                        label: localize('Copy', '复制'),
                        description: localize(
                            'Most compatible mode',
                            '兼容性最好的模式',
                        ),
                        mode: 'copy' as SyncMode,
                    },
                    {
                        label: localize('Symlink', '符号链接'),
                        description: localize(
                            'Directory symbolic link',
                            '目录符号链接',
                        ),
                        mode: 'symlink' as SyncMode,
                    },
                    {
                        label: localize('Junction', '目录联接'),
                        description: localize(
                            'Windows directory junction',
                            'Windows 目录联接',
                        ),
                        mode: 'junction' as SyncMode,
                    },
                ],
                { title: localize('Select sync mode', '选择同步模式') },
            );

            if (!modePick) {
                return;
            }

            let synced = 0;
            for (const target of targets) {
                const agent = target.agent as AgentInfo;
                const basePath =
                    agent.candidatePaths.find((p) => p.length > 0) ||
                    agent.candidatePaths[0];
                if (!basePath) {
                    continue;
                }

                const destPath = agent.skillsSubPath
                    ? path.join(basePath, agent.skillsSubPath)
                    : basePath;

                try {
                    await ctx.syncManager.copySkill(
                        skill,
                        destPath,
                        modePick.mode,
                    );
                    synced += 1;
                } catch (error) {
                    vscode.window.showWarningMessage(
                        localize(
                            `Failed to sync ${skill.name} to ${agent.name}: ${String(error)}`,
                            `同步 ${skill.name} 到 ${agent.name} 失败：${String(error)}`,
                        ),
                    );
                }
            }

            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Synced ${skill.name} to ${synced} agent(s) using ${modePick.mode}.`,
                    `已使用 ${modePick.mode} 将 ${skill.name} 同步到 ${synced} 个智能体。`,
                ),
            );
        },
    );
}
