import { SkillSourceCategoryInfo, SkillSourceEntry } from '../types/models';

/** 源分类定义 */
export const SOURCE_CATEGORIES: SkillSourceCategoryInfo[] = [
    {
        key: 'official',
        label: 'Official / Enterprise',
        labelZh: '官方/大厂维护',
        icon: 'organization',
        description: 'Maintained by official AI labs and major companies',
        descriptionZh: '由官方 AI 实验室和大型企业维护的技能仓库',
    },
    {
        key: 'community',
        label: 'Community Collections',
        labelZh: '社区精选合集',
        icon: 'heart',
        description: 'Curated awesome-lists and community-driven collections',
        descriptionZh: '社区精选汇总与 Awesome 合集',
    },
    {
        key: 'platform',
        label: 'Platforms & Directories',
        labelZh: '平台与目录',
        icon: 'globe',
        description: 'Skill marketplaces, directories, and search platforms',
        descriptionZh: '技能市场、目录与搜索引擎平台',
    },
];

/** 所有内置技能源目录 */
export const SKILL_SOURCE_CATALOG: SkillSourceEntry[] = [
    // ─── 官方/大厂维护 ───
    {
        id: 'anthropics-skills',
        name: 'anthropics/skills',
        maintainer: 'Anthropic',
        url: 'https://github.com/anthropics/skills',
        description: 'Anthropic 官方技能集合，Claude 生态核心技能库',
        category: 'official',
    },
    {
        id: 'openai-skills',
        name: 'openai/skills',
        maintainer: 'OpenAI',
        url: 'https://github.com/openai/skills',
        description: 'OpenAI 官方技能目录，覆盖 ChatGPT / GPT 系列模型',
        category: 'official',
    },
    {
        id: 'microsoft-skills',
        name: 'microsoft/skills',
        maintainer: 'Microsoft',
        url: 'https://github.com/microsoft/skills',
        description: '专注于 Azure 开发的技能，云服务与 DevOps 最佳实践',
        category: 'official',
    },
    {
        id: 'vercel-agent-skills',
        name: 'vercel-labs/agent-skills',
        maintainer: 'Vercel',
        url: 'https://github.com/vercel-labs/agent-skills',
        description: '前端与 Next.js 最佳实践，Vercel 平台专属技能',
        category: 'official',
    },
    {
        id: 'getsentry-skills',
        name: 'getsentry/skills',
        maintainer: 'Sentry',
        url: 'https://github.com/getsentry/skills',
        description: '应用监控与错误追踪，Sentry 集成技能',
        category: 'official',
    },
    {
        id: 'trailofbits-skills',
        name: 'trailofbits/skills',
        maintainer: 'Trail of Bits',
        url: 'https://github.com/trailofbits/skills',
        description: '代码安全审计与漏洞检测，安全领域专业技能',
        category: 'official',
    },
    {
        id: 'expo-skills',
        name: 'expo/skills',
        maintainer: 'Expo',
        url: 'https://github.com/expo/skills',
        description: 'React Native 移动端开发，Expo 生态技能集',
        category: 'official',
    },
    {
        id: 'huggingface-skills',
        name: 'huggingface/skills',
        maintainer: 'Hugging Face',
        url: 'https://github.com/huggingface/skills',
        description: 'AI/ML 模型与生态，Hugging Face 平台技能',
        category: 'official',
    },
    // ─── 社区精选合集 ───
    {
        id: 'skillcreatorai-agent-skills',
        name: 'skillcreatorai/Ai-Agent-Skills',
        maintainer: 'SkillCreatorAI',
        url: 'https://github.com/skillcreatorai/ai-agent-skills',
        description: '社区技能集合，丰富的 Agent Skills 收录',
        category: 'community',
    },
    {
        id: 'heilcheng-awesome',
        name: 'heilcheng/awesome-agent-skills',
        maintainer: 'heilcheng',
        url: 'https://github.com/heilcheng/awesome-agent-skills',
        description: '社区技能汇总，含个人站点 agent-skill.co',
        category: 'community',
    },
    {
        id: 'voltagent-awesome',
        name: 'VoltAgent/awesome-agent-skills',
        maintainer: 'VoltAgent',
        url: 'https://github.com/VoltAgent/awesome-agent-skills',
        description: '综合性技能合集，覆盖多领域 Agent Skills',
        category: 'community',
    },
    {
        id: 'jackyst0-awesome',
        name: 'JackyST0/awesome-agent-skills',
        maintainer: 'JackyST0',
        url: 'https://github.com/JackyST0/awesome-agent-skills',
        description: '入门与实践指南，适合新手快速上手 Agent Skills',
        category: 'community',
    },
    {
        id: 'libukai-awesome',
        name: 'libukai/awesome-agent-skills',
        maintainer: 'libukai',
        url: 'https://github.com/libukai/awesome-agent-skills',
        description: '少而精的中文资源仓库，中文社区友好',
        category: 'community',
    },
    {
        id: 'composio-awesome-claude',
        name: 'ComposioHQ/awesome-claude-skills',
        maintainer: 'ComposioHQ',
        url: 'https://github.com/ComposioHQ/awesome-claude-skills',
        description: '为 Claude 用户精选的技能导航合集',
        category: 'community',
    },
    // ─── 平台与目录 ───
    {
        id: 'clawhub',
        name: 'ClawHub',
        maintainer: 'clawhub.ai',
        url: 'https://clawhub.ai',
        description: '提供超过 11,389 个可搜索技能，大型技能搜索引擎',
        category: 'platform',
        isPlatform: true,
    },
    {
        id: 'skills-sh',
        name: 'skills.sh',
        maintainer: 'Vercel',
        url: 'https://skills.sh',
        description: 'Vercel 推出的公共技能目录与排行榜',
        category: 'platform',
        isPlatform: true,
    },
    {
        id: 'langchain-skills',
        name: 'LangChain Skills',
        maintainer: 'LangChain',
        url: 'https://raw.githubusercontent.com/langchain-ai/deepagents/refs/heads/main/libs/cli/examples/skills/langgraph-docs/SKILL.md',
        description: 'LangChain 官方技能，托管于 deepagents 仓库',
        category: 'platform',
        isPlatform: true,
    },
];

/**
 * 从配置的 URL 列表中找出对应的目录条目。
 * 返回匹配的条目以及未在目录中找到的 URL。
 */
export function matchCatalogEntries(
    configuredUrls: string[],
): { matched: SkillSourceEntry[]; unmatched: string[] } {
    const matched: SkillSourceEntry[] = [];
    const unmatched: string[] = [];
    const urlSet = new Set(configuredUrls.map((u) => u.trim()));

    for (const entry of SKILL_SOURCE_CATALOG) {
        if (entry.isPlatform) {
            continue; // 平台链接不参与 Git 来源匹配
        }
        if (urlSet.has(entry.url)) {
            matched.push(entry);
        }
    }

    // 找出不在目录中的已配置 URL
    const catalogUrls = new Set(
        SKILL_SOURCE_CATALOG.filter((e) => !e.isPlatform).map((e) => e.url),
    );
    for (const url of urlSet) {
        if (!catalogUrls.has(url)) {
            unmatched.push(url);
        }
    }

    return { matched, unmatched };
}
