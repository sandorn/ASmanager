import * as vscode from 'vscode';
import { McpServerInfo } from '../types/models';
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
                    label: 'No MCP servers detected',
                    description: 'Run Detect MCP Servers',
                    icon: new vscode.ThemeIcon('server'),
                }),
            ];
        }

        return this.servers.map(
            (server) =>
                new SimpleTreeNode('agent', {
                    label: server.name,
                    description: server.disabled ? 'Disabled' : 'Enabled',
                    tooltip: `Tool: ${server.toolName}\nCommand: ${server.command} ${server.args.join(' ')}\nSource: ${server.sourcePath}`,
                    icon: new vscode.ThemeIcon(
                        server.disabled ? 'circle-slash' : 'pass',
                    ),
                    contextValue: 'mcpServer',
                    payload: server,
                }),
        );
    }
}
