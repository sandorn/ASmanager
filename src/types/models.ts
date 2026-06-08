export type SkillStatus = 'ready' | 'warning' | 'error';

export interface SkillInfo {
    name: string;
    description: string;
    path: string;
    skillFile: string;
    fileCount: number;
    sizeBytes: number;
    updatedAt: Date;
    status: SkillStatus;
    issues: string[];
    tags: string[];
    category: string;
    score: number;
}

export interface AgentInfo {
    id: string;
    name: string;
    detected: boolean;
    detail: string;
    candidatePaths: string[];
}

export interface SourceInfo {
    url: string;
    configured: boolean;
    localPath?: string;
    installed?: boolean;
    detail?: string;
}

export interface SourceSkillInfo {
    name: string;
    description: string;
    path: string;
    sourceUrl: string;
}

export type SyncMode = 'copy' | 'symlink' | 'junction';

export interface SyncRecord {
    skillName: string;
    sourcePath: string;
    destinationPath: string;
    mode: SyncMode;
    syncedAt: string;
}

export interface DiagnosticIssue {
    skillName: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
}

export interface McpServerInfo {
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    disabled: boolean;
    sourcePath: string;
    toolId: string;
    toolName: string;
    healthy: boolean;
    healthDetail: string;
}
