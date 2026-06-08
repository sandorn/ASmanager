import * as vscode from 'vscode';
import { McpServerInfo } from '../types/models';
import { t } from '../services/localization';
import { SimpleTreeNode } from './treeNode';

export class McpTreeProvider implements vscode.TreeDataProvider<SimpleTreeNode> {
    private readonly changeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this.changeEmitter.event;
    private servers: McpServerInfo[] = [];

    refresh(servers: McpServerInfo[]): void {
        this.servers = servers;
        this.changeEmitter.fire();
    }

    getTreeItem(element: SimpleTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(): SimpleTreeNode[] {
        if (this.servers.length === 0) {
            return [
                new SimpleTreeNode('message', {
                    label: t('noMcpServersDetected'),
                    description: t('runDetectMcpServers'),
                    icon: new vscode.ThemeIcon('server'),
                }),
            ];
        }

        return this.servers.map(
            (server) =>
                new SimpleTreeNode('agent', {
                    label: server.name,
                    description: server.disabled ? t('disabled') : t('enabled'),
                    tooltip: `${t('tool')}: ${server.toolName}\n${t('command')}: ${server.command} ${server.args.join(' ')}\n${t('source')}: ${server.sourcePath}`,
                    icon: new vscode.ThemeIcon(
                        server.disabled ? 'circle-slash' : 'pass',
                    ),
                    contextValue: 'mcpServer',
                    payload: server,
                }),
        );
    }
}
