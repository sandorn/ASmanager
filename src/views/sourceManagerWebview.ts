import * as vscode from 'vscode';
import {
    SkillSourceEntry,
    SkillSourceCategoryInfo,
} from '../types/models';
import {
    SKILL_SOURCE_CATALOG,
    SOURCE_CATEGORIES,
} from '../services/skillSourceCatalog';
import { isChineseLanguage } from '../services/localization';

export interface SourceManagerData {
    configuredUrls: string[];
    installedSources: Array<{ url: string; installed: boolean }>;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function catLabel(cat: SkillSourceCategoryInfo): string {
    return isChineseLanguage() ? cat.labelZh : cat.label;
}

function catDesc(cat: SkillSourceCategoryInfo): string {
    return isChineseLanguage() ? cat.descriptionZh : cat.description;
}

function entryLabel(entry: SkillSourceEntry): string {
    if (entry.isPlatform) {
        return entry.name;
    }
    return `${entry.maintainer} / ${entry.name}`;
}

function renderCategorySection(
    cat: SkillSourceCategoryInfo,
    entries: SkillSourceEntry[],
    configuredUrls: Set<string>,
    installedUrls: Set<string>,
): string {
    if (entries.length === 0) {
        return '';
    }

    const rows = entries
        .map((entry) => {
            const isConfigured = configuredUrls.has(entry.url);
            const isInstalled = installedUrls.has(entry.url);
            const checked = isConfigured ? 'checked' : '';
            const disabled = entry.isPlatform ? 'disabled title="' + escapeHtml(
                isChineseLanguage()
                    ? '平台链接不支持 Git 克隆，请直接在浏览器中访问'
                    : 'Platform links cannot be cloned via Git. Please visit in browser.',
            ) + '"' : '';
            const statusClass = entry.isPlatform
                ? 'muted'
                : isInstalled
                    ? 'ready'
                    : isConfigured
                        ? 'warning'
                        : 'muted';
            const statusText = entry.isPlatform
                ? (isChineseLanguage() ? '平台' : 'Platform')
                : isInstalled
                    ? (isChineseLanguage() ? '已缓存' : 'Cached')
                    : isConfigured
                        ? (isChineseLanguage() ? '待拉取' : 'Pending')
                        : '';

            return `
                <tr class="${isConfigured ? 'selected' : ''}">
                    <td class="check-col">
                        <input type="checkbox" class="source-check" data-url="${escapeHtml(entry.url)}" data-id="${escapeHtml(entry.id)}" ${checked} ${disabled}>
                    </td>
                    <td>
                        <strong>${escapeHtml(entryLabel(entry))}</strong>
                        <span>${escapeHtml(entry.description)}</span>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        ${entry.isPlatform
                            ? `<button class="secondary small visit-btn" data-url="${escapeHtml(entry.url)}">${isChineseLanguage() ? '访问' : 'Visit'} ↗</button>`
                            : `<a href="${escapeHtml(entry.url)}" class="gh-link" title="${escapeHtml(entry.url)}">${escapeHtml(entry.url.replace(/^https?:\/\/github\.com\//, ''))}</a>`
                        }
                    </td>
                </tr>`;
        })
        .join('');

    return `
        <div class="cat-section">
            <div class="cat-head">
                <span class="cat-icon">$(${cat.icon})</span>
                <div>
                    <h3>${escapeHtml(catLabel(cat))}</h3>
                    <p>${escapeHtml(catDesc(cat))}</p>
                </div>
                <span class="cat-count">${entries.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="check-col"></th>
                        <th>${isChineseLanguage() ? '来源名称' : 'Source'}</th>
                        <th style="width:80px">${isChineseLanguage() ? '状态' : 'Status'}</th>
                        <th style="width:240px">URL</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function renderCustomSourceRows(
    customUrls: string[],
    installedUrls: Set<string>,
): string {
    if (customUrls.length === 0) {
        return '';
    }

    const rows = customUrls
        .map((url) => {
            const isInstalled = installedUrls.has(url);
            const statusClass = isInstalled ? 'ready' : 'warning';
            const statusText = isInstalled
                ? (isChineseLanguage() ? '已缓存' : 'Cached')
                : (isChineseLanguage() ? '待拉取' : 'Pending');

            return `
                <tr>
                    <td class="check-col">
                        <input type="checkbox" class="source-check" data-url="${escapeHtml(url)}" checked>
                    </td>
                    <td>
                        <strong>${escapeHtml(url.replace(/^https?:\/\/github\.com\//, ''))}</strong>
                        <span>${isChineseLanguage() ? '自定义来源' : 'Custom source'}</span>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <a href="${escapeHtml(url)}" class="gh-link" title="${escapeHtml(url)}">${escapeHtml(url)}</a>
                    </td>
                </tr>`;
        })
        .join('');

    return `
        <div class="cat-section">
            <div class="cat-head">
                <span class="cat-icon">$(link)</span>
                <div>
                    <h3>${isChineseLanguage() ? '自定义来源' : 'Custom Sources'}</h3>
                    <p>${isChineseLanguage() ? '手动添加的来源' : 'Manually added sources'}</p>
                </div>
                <span class="cat-count">${customUrls.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="check-col"></th>
                        <th>${isChineseLanguage() ? '来源名称' : 'Source'}</th>
                        <th style="width:80px">${isChineseLanguage() ? '状态' : 'Status'}</th>
                        <th style="width:240px">URL</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

export function renderSourceManager(
    webview: vscode.Webview,
    data: SourceManagerData,
): string {
    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const configuredUrls = new Set(data.configuredUrls.map((u) => u.trim()));
    const installedUrls = new Set(
        data.installedSources.filter((s) => s.installed).map((s) => s.url),
    );

    // 按分类分组目录条目
    const officialEntries = SKILL_SOURCE_CATALOG.filter(
        (e) => e.category === 'official',
    );
    const communityEntries = SKILL_SOURCE_CATALOG.filter(
        (e) => e.category === 'community',
    );
    const platformEntries = SKILL_SOURCE_CATALOG.filter(
        (e) => e.category === 'platform',
    );

    // 找出不在目录中的自定义 URL
    const catalogUrls = new Set(
        SKILL_SOURCE_CATALOG.filter((e) => !e.isPlatform).map((e) => e.url),
    );
    const customUrls = data.configuredUrls.filter((u) => !catalogUrls.has(u.trim()));

    const totalSelected = data.configuredUrls.length;
    const totalInstalled = data.installedSources.filter((s) => s.installed).length;

    return `<!DOCTYPE html>
<html lang="${isChineseLanguage() ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>${isChineseLanguage() ? '技能来源管理' : 'Skill Source Manager'}</title>
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
            --sidebar: var(--vscode-sideBar-background);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --input-border: var(--vscode-input-border);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--fg);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .shell { max-width: 960px; margin: 0 auto; padding: 20px; }
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        h1 { font-size: 22px; margin: 0; font-weight: 650; }
        .header-actions { display: flex; gap: 8px; }
        button {
            border: 0;
            border-radius: 4px;
            padding: 7px 14px;
            background: var(--accent);
            color: var(--accent-fg);
            cursor: pointer;
            font: inherit;
            font-size: 13px;
            white-space: nowrap;
        }
        button:hover { opacity: 0.9; }
        button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        button.small { padding: 4px 10px; font-size: 12px; }
        button.danger { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border: 1px solid var(--vscode-inputValidation-errorBorder); }

        .stats-bar {
            display: flex;
            gap: 14px;
            margin-bottom: 18px;
            flex-wrap: wrap;
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--sidebar);
            font-size: 13px;
        }
        .stat strong { font-size: 16px; }

        .add-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
        }
        .add-bar input {
            flex: 1;
            padding: 7px 10px;
            border: 1px solid var(--input-border);
            border-radius: 4px;
            background: var(--input-bg);
            color: var(--input-fg);
            font: inherit;
            font-size: 13px;
        }
        .add-bar input::placeholder { color: var(--muted); }

        .cat-section {
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: hidden;
        }
        .cat-head {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: var(--sidebar);
            border-bottom: 1px solid var(--border);
        }
        .cat-icon { font-size: 16px; color: var(--accent); }
        .cat-head h3 { font-size: 14px; margin: 0; font-weight: 650; }
        .cat-head p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
        .cat-count {
            margin-left: auto;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
        }

        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; vertical-align: middle; padding: 9px 12px; border-bottom: 1px solid var(--border); }
        th { color: var(--muted); font-weight: 600; font-size: 12px; }
        tr:hover td { background: var(--row); }
        tr:last-child td { border-bottom: 0; }
        tr.selected td { background: var(--vscode-list-activeSelectionBackground); }
        tr.selected:hover td { background: var(--vscode-list-activeSelectionBackground); }
        .check-col { width: 36px; text-align: center; }
        td strong { display: block; font-size: 13px; }
        td span { display: block; color: var(--muted); font-size: 11px; margin-top: 2px; }
        .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 11px; border: 1px solid var(--border); white-space: nowrap; }
        .ready { color: var(--vscode-testing-iconPassed); }
        .warning { color: var(--vscode-testing-iconQueued); }
        .muted { color: var(--muted); }
        .gh-link { color: var(--muted); font-size: 12px; text-decoration: none; }
        .gh-link:hover { text-decoration: underline; }

        input[type="checkbox"] {
            accent-color: var(--accent);
            width: 15px;
            height: 15px;
            cursor: pointer;
        }
        input[type="checkbox"]:disabled { opacity: 0.4; cursor: not-allowed; }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--muted);
        }
    </style>
</head>
<body>
    <div class="shell">
        <header>
            <h1>${isChineseLanguage() ? '技能来源管理' : 'Skill Source Manager'}</h1>
            <div class="header-actions">
                <button id="btn-save" class="secondary">${isChineseLanguage() ? '取消' : 'Cancel'}</button>
                <button id="btn-apply">${isChineseLanguage() ? '保存并更新' : 'Save & Update'}</button>
            </div>
        </header>

        <div class="stats-bar">
            <div class="stat">
                $(repo) <strong>${totalSelected}</strong> ${isChineseLanguage() ? '个已选来源' : 'sources selected'}
            </div>
            <div class="stat">
                $(database) <strong>${totalInstalled}</strong> ${isChineseLanguage() ? '个已缓存' : 'cached'}
            </div>
        </div>

        <div class="add-bar">
            <input type="text" id="custom-url-input" placeholder="${isChineseLanguage() ? '输入自定义 GitHub 技能仓库 URL...' : 'Enter custom GitHub skills repo URL...'}">
            <button id="btn-add-custom" class="secondary">${isChineseLanguage() ? '添加' : 'Add'}</button>
        </div>

        ${renderCategorySection(SOURCE_CATEGORIES[0], officialEntries, configuredUrls, installedUrls)}
        ${renderCategorySection(SOURCE_CATEGORIES[1], communityEntries, configuredUrls, installedUrls)}
        ${renderCategorySection(SOURCE_CATEGORIES[2], platformEntries, configuredUrls, installedUrls)}
        ${renderCustomSourceRows(customUrls, installedUrls)}
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // 收集当前选中的 URL
        function getSelectedUrls() {
            const checks = document.querySelectorAll('.source-check:checked');
            return Array.from(checks).map(cb => cb.dataset.url);
        }

        // 保存按钮
        document.getElementById('btn-apply').addEventListener('click', () => {
            const urls = getSelectedUrls();
            vscode.postMessage({ command: 'applySources', payload: { urls } });
        });

        // 取消按钮
        document.getElementById('btn-save').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        // 添加自定义来源
        document.getElementById('btn-add-custom').addEventListener('click', () => {
            const input = document.getElementById('custom-url-input');
            const url = input.value.trim();
            if (!url) return;
            vscode.postMessage({ command: 'addCustomSource', payload: { url } });
        });

        // 回车添加
        document.getElementById('custom-url-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btn-add-custom').click();
            }
        });

        // 平台访问按钮
        document.querySelectorAll('.visit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                vscode.postMessage({ command: 'openUrl', payload: { url: btn.dataset.url } });
            });
        });
    </script>
</body>
</html>`;
}
