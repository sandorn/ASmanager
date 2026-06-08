import * as vscode from 'vscode';
import { SourceInfo } from '../types/models';
import { t } from '../services/localization';
import { SimpleTreeNode } from './treeNode';

export class SourcesTreeProvider implements vscode.TreeDataProvider<SimpleTreeNode> {
    private readonly changeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this.changeEmitter.event;
    private sources: SourceInfo[] = [];

    refresh(sources: SourceInfo[]): void {
        this.sources = sources;
        this.changeEmitter.fire();
    }

    getTreeItem(element: SimpleTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(): SimpleTreeNode[] {
        if (this.sources.length === 0) {
            return [
                new SimpleTreeNode('message', {
                    label: t('noSourcesConfigured'),
                    description: t('addSourceUrl'),
                    icon: new vscode.ThemeIcon('repo'),
                }),
            ];
        }

        return this.sources.map(
            (source) =>
                new SimpleTreeNode('source', {
                    label: source.url.replace(/^https?:\/\//, ''),
                    description: source.installed
                        ? t('cached')
                        : t('notFetched'),
                    tooltip: `${source.url}\n${source.detail ?? ''}`,
                    icon: new vscode.ThemeIcon(
                        source.installed ? 'repo-clone' : 'repo',
                    ),
                    contextValue: 'source',
                    payload: source,
                }),
        );
    }
}
