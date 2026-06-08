import * as vscode from 'vscode';
import { AgentInfo } from '../types/models';
import { t } from '../services/localization';
import { SimpleTreeNode } from './treeNode';

export class AgentsTreeProvider implements vscode.TreeDataProvider<SimpleTreeNode> {
    private readonly changeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this.changeEmitter.event;
    private agents: AgentInfo[] = [];

    refresh(agents: AgentInfo[]): void {
        this.agents = agents;
        this.changeEmitter.fire();
    }

    getTreeItem(element: SimpleTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(): SimpleTreeNode[] {
        if (this.agents.length === 0) {
            return [
                new SimpleTreeNode('message', {
                    label: t('agentsNotDetectedYet'),
                    description: t('runDetectCommand'),
                    icon: new vscode.ThemeIcon('search'),
                }),
            ];
        }

        return this.agents.map(
            (agent) =>
                new SimpleTreeNode('agent', {
                    label: agent.name,
                    description: agent.detected
                        ? t('detected')
                        : t('notDetected'),
                    tooltip: `${agent.detail}\n${agent.candidatePaths.join('\n')}`,
                    icon: new vscode.ThemeIcon(
                        agent.detected ? 'pass' : 'circle-slash',
                    ),
                    contextValue: 'agent',
                    payload: agent,
                }),
        );
    }
}
