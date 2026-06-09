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
}

export interface AgentInfo {
    id: string;
    name: string;
    detected: boolean;
    detail: string;
    candidatePaths: string[];
    /** 技能在智能体配置目录下的子路径，如 "skills"。为空字符串则直接同步到配置根目录。 */
    skillsSubPath: string;
}

export interface SourceInfo {
    url: string;
    configured: boolean;
    localPath?: string;
    installed?: boolean;
    detail?: string;
}

/** 技能源目录项 */
export interface SkillSourceEntry {
    id: string;
    name: string;
    maintainer: string;
    url: string;
    description: string;
    category: SkillSourceCategory;
    /** 是否为非 git 仓库来源（如平台链接） */
    isPlatform?: boolean;
}

/** 源分类 */
export type SkillSourceCategory = 'official' | 'community' | 'platform';

/** 源分类的显示信息 */
export interface SkillSourceCategoryInfo {
    key: SkillSourceCategory;
    label: string;
    labelZh: string;
    icon: string;
    description: string;
    descriptionZh: string;
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
