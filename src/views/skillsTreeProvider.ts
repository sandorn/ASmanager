import * as vscode from 'vscode';
import { SkillInfo } from '../types/models';
import { formatBytes } from '../services/config';
import { t } from '../services/localization';
import { SimpleTreeNode } from './treeNode';

export class SkillsTreeProvider implements vscode.TreeDataProvider<SimpleTreeNode> {
    private readonly changeEmitter =
        new vscode.EventEmitter<SimpleTreeNode | void>();
    readonly onDidChangeTreeData = this.changeEmitter.event;
    private skills: SkillInfo[] = [];

    refresh(skills: SkillInfo[]): void {
        this.skills = skills;
        this.changeEmitter.fire();
    }

    getTreeItem(element: SimpleTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SimpleTreeNode): SimpleTreeNode[] {
        if (!element) {
            if (this.skills.length === 0) {
                return [
                    new SimpleTreeNode('message', {
                        label: t('noSkillsFound'),
                        description: t('initializeOrAddSkills'),
                        icon: new vscode.ThemeIcon('info'),
                    }),
                ];
            }

            return this.skills.map((skill) => {
                const icon =
                    skill.status === 'ready'
                        ? new vscode.ThemeIcon('check')
                        : skill.status === 'error'
                          ? new vscode.ThemeIcon('error')
                          : new vscode.ThemeIcon('warning');

                return new SimpleTreeNode('skill', {
                    label: `${skill.name}  [${skill.score}/10]`,
                    description: `${skill.fileCount} ${t('files')}, ${formatBytes(skill.sizeBytes)}`,
                    tooltip: `${skill.description}\n${skill.path}`,
                    icon,
                    contextValue: 'skill',
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    resourceUri: vscode.Uri.file(skill.path),
                    payload: skill,
                });
            });
        }

        if (element.kind !== 'skill' || !element.payload) {
            return [];
        }

        const skill = element.payload as SkillInfo;
        const children: SimpleTreeNode[] = [];

        children.push(
            new SimpleTreeNode('message', {
                label: `${t('path')}: ${skill.path}`,
                icon: new vscode.ThemeIcon('folder'),
            }),
            new SimpleTreeNode('message', {
                label: `${t('score')}: ${skill.score}/10 | ${t('files')}: ${skill.fileCount} | ${t('size')}: ${formatBytes(skill.sizeBytes)}`,
                icon: new vscode.ThemeIcon('file'),
            }),
            new SimpleTreeNode('message', {
                label: `${t('updated')}: ${skill.updatedAt.toLocaleString()}`,
                icon: new vscode.ThemeIcon('calendar'),
            }),
        );

        if (skill.issues.length > 0) {
            children.push(
                new SimpleTreeNode('message', {
                    label: `${t('issues')} (${skill.issues.length})`,
                    icon: new vscode.ThemeIcon('warning'),
                    description: skill.issues.join('; '),
                    tooltip: skill.issues.join('\n'),
                }),
            );
        }

        children.push(
            new SimpleTreeNode('message', {
                label: skill.description,
                icon: new vscode.ThemeIcon('book'),
                tooltip: skill.description,
            }),
        );

        return children;
    }
}
