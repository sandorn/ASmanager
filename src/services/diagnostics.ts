import { DiagnosticIssue, SkillInfo } from '../types/models';
import { localize } from './localization';

function tokenize(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 1),
    );
}

function jaccardSimilarity(left: string, right: string): number {
    const tokensLeft = tokenize(left);
    const tokensRight = tokenize(right);

    if (tokensLeft.size === 0 || tokensRight.size === 0) {
        return 0;
    }

    let intersection = 0;
    for (const token of tokensLeft) {
        if (tokensRight.has(token)) {
            intersection += 1;
        }
    }

    const union = tokensLeft.size + tokensRight.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

export class DiagnosticsService {
    diagnose(skills: SkillInfo[]): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];

        for (const skill of skills) {
            for (const issue of skill.issues) {
                issues.push({
                    skillName: skill.name,
                    severity: skill.status === 'error' ? 'error' : 'warning',
                    message: issue,
                });
            }

            if (skill.fileCount > 200) {
                issues.push({
                    skillName: skill.name,
                    severity: 'warning',
                    message: localize(
                        `Contains ${skill.fileCount} files; review whether large assets should be included.`,
                        `包含 ${skill.fileCount} 个文件；请检查是否应包含大型资源。`,
                    ),
                });
            }
        }

        for (let i = 0; i < skills.length; i += 1) {
            for (let j = i + 1; j < skills.length; j += 1) {
                const sim = jaccardSimilarity(
                    skills[i].description,
                    skills[j].description,
                );
                if (sim >= 0.6) {
                    issues.push({
                        skillName: `${skills[i].name} / ${skills[j].name}`,
                        severity: sim >= 0.85 ? 'warning' : 'info',
                        message: localize(
                            `Descriptions are ${(sim * 100).toFixed(0)}% similar (Jaccard). Review possible overlap.`,
                            `描述相似度为 ${(sim * 100).toFixed(0)}%（Jaccard）。请检查是否存在重叠。`,
                        ),
                    });
                }

                const nameSim = jaccardSimilarity(
                    skills[i].name,
                    skills[j].name,
                );
                if (nameSim >= 0.7) {
                    issues.push({
                        skillName: `${skills[i].name} / ${skills[j].name}`,
                        severity: 'info',
                        message: localize(
                            `Skill names are ${(nameSim * 100).toFixed(0)}% similar. Review possible duplication.`,
                            `技能名称相似度为 ${(nameSim * 100).toFixed(0)}%。请检查是否重复。`,
                        ),
                    });
                }
            }
        }

        return issues;
    }
}
