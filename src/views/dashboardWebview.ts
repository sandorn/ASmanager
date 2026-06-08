import * as vscode from 'vscode';
import {
    AgentInfo,
    McpServerInfo,
    SkillInfo,
    SourceInfo,
    SyncRecord,
} from '../types/models';
import { formatBytes } from '../services/config';

export interface DashboardData {
    repositoryPath: string;
    skills: SkillInfo[];
    sources: SourceInfo[];
    agents: AgentInfo[];
    mcpServers: McpServerInfo[];
    syncRecords: SyncRecord[];
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function statusClass(value: string): string {
    return value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

function renderSkillRows(skills: SkillInfo[]): string {
    if (skills.length === 0) {
        return '<tr><td colspan="7" class="empty">No skills found.</td></tr>';
    }

    return skills
        .map(
            (skill) => `
                <tr>
                    <td><strong>${escapeHtml(skill.name)}</strong><span>${escapeHtml(skill.description)}${skill.category ? ` [${escapeHtml(skill.category)}]` : ''}${skill.tags.length > 0 ? ` Tags: ${escapeHtml(skill.tags.join(', '))}` : ''}</span></td>
                    <td><span class="badge ${statusClass(skill.status)}">${escapeHtml(skill.status)}</span></td>
                    <td><span class="badge muted">${skill.score}/10</span></td>
                    <td>${skill.fileCount}</td>
                    <td>${formatBytes(skill.sizeBytes)}</td>
                    <td title="${escapeHtml(skill.path)}">${escapeHtml(skill.path)}</td>
                    <td><button data-command="deleteSkill" data-payload="${escapeHtml(JSON.stringify({ path: skill.path, name: skill.name }))}" class="secondary small">Delete</button></td>
                </tr>`,
        )
        .join('');
}

function renderSourceRows(sources: SourceInfo[]): string {
    if (sources.length === 0) {
        return '<tr><td colspan="4" class="empty">No sources configured.</td></tr>';
    }

    return sources
        .map(
            (source) => `
                <tr>
                    <td><strong>${escapeHtml(source.url)}</strong><span>${escapeHtml(source.localPath ?? '')}</span></td>
                    <td><span class="badge ${source.installed ? 'ready' : 'warning'}">${source.installed ? 'Cached' : 'Not fetched'}</span></td>
                    <td>${escapeHtml(source.detail ?? '')}</td>
                    <td><button data-command="removeSource" data-payload="${escapeHtml(JSON.stringify({ url: source.url }))}" class="secondary small">Remove</button></td>
                </tr>`,
        )
        .join('');
}

function renderAgentRows(agents: AgentInfo[]): string {
    if (agents.length === 0) {
        return '<tr><td colspan="3" class="empty">Agents not detected yet.</td></tr>';
    }

    return agents
        .map(
            (agent) => `
                <tr>
                    <td><strong>${escapeHtml(agent.name)}</strong><span>${escapeHtml(agent.id)}</span></td>
                    <td><span class="badge ${agent.detected ? 'ready' : 'muted'}">${agent.detected ? 'Detected' : 'Not detected'}</span></td>
                    <td>${escapeHtml(agent.detail)}</td>
                </tr>`,
        )
        .join('');
}

function renderRecordRows(records: SyncRecord[]): string {
    if (records.length === 0) {
        return '<tr><td colspan="4" class="empty">No sync records yet.</td></tr>';
    }

    return records
        .slice(0, 20)
        .map(
            (record) => `
                <tr>
                    <td><strong>${escapeHtml(record.skillName)}</strong><span>${escapeHtml(record.sourcePath)}</span></td>
                    <td><span class="badge muted">${escapeHtml(record.mode)}</span></td>
                    <td>${escapeHtml(record.destinationPath)}</td>
                    <td>${escapeHtml(record.syncedAt)}</td>
                </tr>`,
        )
        .join('');
}

function renderMcpRows(servers: McpServerInfo[]): string {
    if (servers.length === 0) {
        return '<tr><td colspan="6" class="empty">No MCP servers detected. Run Detect MCP.</td></tr>';
    }

    return servers
        .map(
            (server) => `
                <tr>
                    <td><strong>${escapeHtml(server.name)}</strong><span>${escapeHtml(server.toolName)}</span></td>
                    <td><span class="badge ${server.disabled ? 'warning' : 'ready'}">${server.disabled ? 'Disabled' : 'Enabled'}</span></td>
                    <td><span class="badge ${server.healthy ? 'ready' : server.healthDetail === 'Not checked' ? 'muted' : 'error'}">${escapeHtml(server.healthDetail)}</span></td>
                    <td>${escapeHtml(server.command)} ${escapeHtml(server.args.join(' '))}</td>
                    <td title="${escapeHtml(server.sourcePath)}">${escapeHtml(server.sourcePath)}</td>
                    <td>
                        <button data-command="toggleMcpServer" data-payload="${escapeHtml(JSON.stringify({ name: server.name, sourcePath: server.sourcePath }))}" class="secondary small">${server.disabled ? 'Enable' : 'Disable'}</button>
                        <button data-command="syncMcpServer" data-payload="${escapeHtml(JSON.stringify({ name: server.name, sourcePath: server.sourcePath }))}" class="secondary small">Sync</button>
                    </td>
                </tr>`,
        )
        .join('');
}

export function renderDashboard(
    webview: vscode.Webview,
    data: DashboardData,
): string {
    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const detectedAgents = data.agents.filter((agent) => agent.detected).length;
    const problemSkills = data.skills.filter(
        (skill) => skill.status !== 'ready',
    ).length;
    const cachedSources = data.sources.filter(
        (source) => source.installed,
    ).length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>ASmanager</title>
    <style>
        :root {
            color-scheme: light dark;
            --border: var(--vscode-panel-border);
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --muted: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-fg: var(--vscode-button-foreground);
            --row: var(--vscode-list-hoverBackground);
        }
        body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--fg);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .shell { padding: 20px; max-width: 1280px; margin: 0 auto; }
        header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
        h1 { font-size: 24px; margin: 0 0 6px; font-weight: 650; }
        h2 { font-size: 15px; margin: 0 0 10px; font-weight: 650; }
        p { margin: 0; color: var(--muted); }
        .toolbar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        button {
            border: 0;
            border-radius: 4px;
            padding: 7px 10px;
            background: var(--accent);
            color: var(--accent-fg);
            cursor: pointer;
            font: inherit;
        }
        button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        button.small { padding: 4px 8px; font-size: 12px; }
        .metrics { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); gap: 10px; margin: 16px 0 18px; }
        .metric { border: 1px solid var(--border); border-radius: 6px; padding: 12px; background: var(--vscode-sideBar-background); }
        .metric strong { display: block; font-size: 24px; margin-bottom: 4px; }
        .metric span, td span { color: var(--muted); display: block; font-size: 12px; margin-top: 3px; overflow-wrap: anywhere; }
        section { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
        .section-head { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border); background: var(--vscode-sideBar-background); }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
        th { color: var(--muted); font-weight: 600; font-size: 12px; }
        tr:hover td { background: var(--row); }
        tr:last-child td { border-bottom: 0; }
        .empty { color: var(--muted); text-align: center; padding: 20px; }
        .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 12px; border: 1px solid var(--border); }
        .ready { color: var(--vscode-testing-iconPassed); }
        .warning { color: var(--vscode-testing-iconQueued); }
        .error { color: var(--vscode-testing-iconFailed); }
        .muted { color: var(--muted); }
        @media (max-width: 820px) {
            header { display: block; }
            .toolbar { justify-content: flex-start; margin-top: 12px; }
            .metrics { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
            th:nth-child(n+4), td:nth-child(n+4) { display: none; }
        }
    </style>
</head>
<body>
    <div class="shell">
        <header>
            <div>
                <h1>ASmanager</h1>
                <p title="${escapeHtml(data.repositoryPath)}">${escapeHtml(data.repositoryPath)}</p>
            </div>
            <div class="toolbar">
                <button data-command="refresh">Refresh</button>
                <button data-command="updateSources">Update Sources</button>
                <button data-command="installSkillFromSource">Install Skill</button>
                <button data-command="syncSkillToAgents">Sync to Agents</button>
                <button data-command="detectAgents">Detect Agents</button>
                <button data-command="backupRepository" class="secondary">Backup</button>
                <button data-command="openRepository" class="secondary">Open Repository</button>
            </div>
        </header>

        <div class="metrics">
            <div class="metric"><strong>${data.skills.length}</strong><span>Skills</span></div>
            <div class="metric"><strong>${problemSkills}</strong><span>Skills needing review</span></div>
            <div class="metric"><strong>${cachedSources}/${data.sources.length}</strong><span>Cached sources</span></div>
            <div class="metric"><strong>${detectedAgents}/${data.agents.length}</strong><span>Detected agents</span></div>
        </div>

        <section>
            <div class="section-head"><h2>Skills</h2><button data-command="diagnoseSkills" class="secondary">Diagnose</button></div>
            <table><thead><tr><th>Skill</th><th>Status</th><th>Score</th><th>Files</th><th>Size</th><th>Path</th><th></th></tr></thead><tbody>${renderSkillRows(data.skills)}</tbody></table>
        </section>

        <section>
            <div class="section-head"><h2>Sources</h2><button data-command="addSource" class="secondary">Add Source</button></div>
            <table><thead><tr><th>Source</th><th>Status</th><th>Detail</th><th></th></tr></thead><tbody>${renderSourceRows(data.sources)}</tbody></table>
        </section>

        <section>
            <div class="section-head"><h2>Agents</h2><button data-command="detectAgents" class="secondary">Detect</button></div>
            <table><thead><tr><th>Agent</th><th>Status</th><th>Detail</th></tr></thead><tbody>${renderAgentRows(data.agents)}</tbody></table>
        </section>

        <section>
            <div class="section-head"><h2>MCP Servers</h2><button data-command="detectMcp" class="secondary">Detect MCP</button><button data-command="healthCheckMcp" class="secondary">Health Check</button></div>
            <table><thead><tr><th>Server</th><th>Status</th><th>Health</th><th>Command</th><th>Source</th><th></th></tr></thead><tbody>${renderMcpRows(data.mcpServers)}</tbody></table>
        </section>

        <section>
            <div class="section-head"><h2>Recent Syncs</h2><button data-command="showSyncRecords" class="secondary">Open Records</button></div>
            <table><thead><tr><th>Skill</th><th>Mode</th><th>Destination</th><th>Time</th></tr></thead><tbody>${renderRecordRows(data.syncRecords)}</tbody></table>
        </section>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('button[data-command]').forEach((button) => {
            button.addEventListener('click', () => {
                const command = button.dataset.command;
                const payload = button.dataset.payload;
                vscode.postMessage({ command, payload: payload ? JSON.parse(payload) : undefined });
            });
        });
    </script>
</body>
</html>`;
}
