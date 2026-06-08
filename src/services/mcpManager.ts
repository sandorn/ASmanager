import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { McpServerInfo } from '../types/models';
import { fileExists, readJsonFile, writeJsonFile } from './fileSystem';
import { localize, t } from './localization';

const execFileAsync = promisify(execFile);

interface McpConfigDocument {
    mcpServers?: Record<
        string,
        {
            type?: string;
            command?: string;
            args?: string[];
            env?: Record<string, string>;
            disabled?: boolean;
            url?: string;
        }
    >;
    servers?: McpConfigDocument['mcpServers'];
}

interface ToolMcpSource {
    toolId: string;
    toolName: string;
    configPaths: string[];
}

function buildToolSources(): ToolMcpSource[] {
    const home = os.homedir();
    const appData =
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const workspaceMcpPaths = (vscode.workspace.workspaceFolders ?? []).map(
        (folder) => path.join(folder.uri.fsPath, '.vscode', 'mcp.json'),
    );

    return [
        {
            toolId: 'claude-code',
            toolName: 'Claude Code',
            configPaths: [
                path.join(home, '.claude', 'mcp.json'),
                path.join(home, '.claude.json'),
                path.join(home, '.config', 'claude', 'mcp.json'),
                path.join(appData, 'Claude', 'mcp.json'),
            ],
        },
        {
            toolId: 'cursor',
            toolName: 'Cursor',
            configPaths: [
                path.join(appData, 'Cursor', 'User', 'mcp.json'),
                path.join(home, '.cursor', 'mcp.json'),
                path.join(home, '.cursor', 'mcp_servers.json'),
            ],
        },
        {
            toolId: 'copilot',
            toolName: 'VS Code / Copilot',
            configPaths: [
                path.join(appData, 'Code', 'User', 'mcp.json'),
                path.join(home, '.vscode', 'mcp.json'),
                ...workspaceMcpPaths,
            ],
        },
        {
            toolId: 'cline',
            toolName: 'Cline',
            configPaths: [
                path.join(
                    appData,
                    'Code',
                    'User',
                    'globalStorage',
                    'saoudrizwan.claude-dev',
                    'settings',
                    'cline_mcp_settings.json',
                ),
            ],
        },
        {
            toolId: 'roo-code',
            toolName: 'Roo Code',
            configPaths: [
                path.join(
                    appData,
                    'Code',
                    'User',
                    'globalStorage',
                    'rooveterinaryinc.roo-cline',
                    'settings',
                    'cline_mcp_settings.json',
                ),
            ],
        },
        {
            toolId: 'gemini-cli',
            toolName: 'Gemini CLI',
            configPaths: [
                path.join(home, '.gemini', 'mcp.json'),
                path.join(home, '.config', 'gemini', 'mcp.json'),
            ],
        },
    ];
}

function normalizeServers(
    raw: Record<
        string,
        {
            type?: string;
            command?: string;
            args?: string[];
            env?: Record<string, string>;
            disabled?: boolean;
            url?: string;
        }
    >,
    sourcePath: string,
    toolId: string,
    toolName: string,
): McpServerInfo[] {
    return Object.entries(raw).map(([name, entry]) => ({
        name,
        command: entry.command || entry.url || entry.type || '',
        args: Array.isArray(entry.args) ? entry.args : [],
        env: entry.env || {},
        disabled: Boolean(entry.disabled),
        sourcePath,
        toolId,
        toolName,
        healthy: false,
        healthDetail: t('notChecked'),
    }));
}

function getServerRecords(
    doc: McpConfigDocument,
): Array<NonNullable<McpConfigDocument['mcpServers']>> {
    return [doc.mcpServers, doc.servers].filter(
        (servers): servers is NonNullable<McpConfigDocument['mcpServers']> =>
            Boolean(servers) && typeof servers === 'object',
    );
}

export class McpManager {
    async detectAll(): Promise<McpServerInfo[]> {
        const sources = buildToolSources();
        const servers: McpServerInfo[] = [];

        for (const source of sources) {
            for (const configPath of source.configPaths) {
                if (!(await fileExists(configPath))) {
                    continue;
                }

                const doc = await readJsonFile<McpConfigDocument>(
                    configPath,
                    {},
                );

                const serverRecords = getServerRecords(doc);
                for (const serverRecord of serverRecords) {
                    servers.push(
                        ...normalizeServers(
                            serverRecord,
                            configPath,
                            source.toolId,
                            source.toolName,
                        ),
                    );
                }
            }
        }

        const uniqueServers = servers.filter(
            (server, index, list) =>
                list.findIndex(
                    (candidate) =>
                        candidate.name === server.name &&
                        candidate.sourcePath === server.sourcePath &&
                        candidate.toolId === server.toolId,
                ) === index,
        );

        return uniqueServers.sort((left, right) =>
            `${left.toolId}:${left.name}`.localeCompare(
                `${right.toolId}:${right.name}`,
            ),
        );
    }

    async setEnabled(server: McpServerInfo, enabled: boolean): Promise<void> {
        const doc = await readJsonFile<McpConfigDocument>(
            server.sourcePath,
            {},
        );

        if (!doc.mcpServers || !doc.mcpServers[server.name]) {
            throw new Error(
                `MCP server "${server.name}" not found in ${server.sourcePath}.`,
            );
        }

        if (enabled) {
            delete doc.mcpServers[server.name].disabled;
        } else {
            doc.mcpServers[server.name].disabled = true;
        }

        await writeJsonFile(server.sourcePath, doc);
    }

    async toggleEnabled(server: McpServerInfo): Promise<boolean> {
        const nextState = !server.disabled;
        await this.setEnabled(server, nextState);
        return nextState;
    }

    async syncServer(server: McpServerInfo, targetPath: string): Promise<void> {
        const doc = await readJsonFile<McpConfigDocument>(targetPath, {
            mcpServers: {},
        });

        doc.mcpServers = doc.mcpServers || {};
        doc.mcpServers[server.name] = {
            command: server.command,
            args: server.args,
            env: server.env,
            disabled: server.disabled,
        };

        await writeJsonFile(targetPath, doc);
    }

    async healthCheck(server: McpServerInfo): Promise<McpServerInfo> {
        try {
            await execFileAsync(server.command, ['--version'], {
                timeout: 8000,
                env: { ...process.env, ...server.env },
            });
            server.healthy = true;
            server.healthDetail = localize(
                'Responds to --version',
                '响应 --version',
            );
        } catch {
            try {
                await execFileAsync(server.command, ['--help'], {
                    timeout: 8000,
                    env: { ...process.env, ...server.env },
                });
                server.healthy = true;
                server.healthDetail = localize(
                    'Responds to --help',
                    '响应 --help',
                );
            } catch {
                server.healthy = false;
                server.healthDetail = localize(
                    'Unreachable or timed out',
                    '无法访问或已超时',
                );
            }
        }

        return server;
    }

    async healthCheckAll(servers: McpServerInfo[]): Promise<McpServerInfo[]> {
        const results: McpServerInfo[] = [];
        for (const server of servers) {
            results.push(await this.healthCheck(server));
        }
        return results;
    }
}
