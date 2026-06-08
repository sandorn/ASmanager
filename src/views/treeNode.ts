import * as vscode from 'vscode';

export type TreeNodeKind = 'skill' | 'agent' | 'source' | 'message';

export interface TreeNodeOptions {
    label: string;
    description?: string;
    tooltip?: string;
    icon?: vscode.ThemeIcon;
    contextValue?: string;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    resourceUri?: vscode.Uri;
    payload?: unknown;
}

export class SimpleTreeNode extends vscode.TreeItem {
    readonly kind: TreeNodeKind;
    readonly payload?: unknown;

    constructor(kind: TreeNodeKind, options: TreeNodeOptions) {
        super(
            options.label,
            options.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
        );
        this.kind = kind;
        this.description = options.description;
        this.tooltip = options.tooltip;
        this.iconPath = options.icon;
        this.contextValue = options.contextValue;
        this.resourceUri = options.resourceUri;
        this.payload = options.payload;
    }
}
