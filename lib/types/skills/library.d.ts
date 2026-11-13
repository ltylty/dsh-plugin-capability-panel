/**
 * 「技能库」：一个由宿主预置、供面板安装来源使用的目录。
 *
 * 只扫描**顶层**条目：每个 flat 的 `<name>.md`，或含 `SKILL.md` 的顶层
 * 目录，即一个可安装 skill。面板只列出这些条目供用户选择，不再接受任意
 * 宿主路径。
 *
 * 目录来源：插件配置 `skillLibrary`，回退环境变量 `DSH_SKILL_LIBRARY`。
 *
 * @module @chengdb/capability-panel/skills/library
 */
import type { SkillFormat } from "./types.js";
/** 技能库里的一个可安装条目。 */
export interface LibrarySkill {
    /** frontmatter 里的权威名称。 */
    name: string;
    /** 一句话描述。 */
    description: string;
    /** 顶层条目名（flat 为文件名，directory 为目录名）。 */
    entry: string;
    /** 磁盘布局。 */
    format: SkillFormat;
}
/** 技能库列表视图。 */
export interface SkillLibraryView {
    /** 技能库目录绝对路径；未配置时缺省。 */
    dir?: string;
    skills: LibrarySkill[];
    /** 跳过或读取失败的条目说明（不致命）。 */
    errors: string[];
}
/** 解析技能库目录：显式配置优先，其次环境变量；支持 `~/` 前缀。 */
export declare function resolveLibraryDir(input?: string): string | undefined;
/** 列出技能库顶层的可安装条目。 */
export declare function listSkillLibrary(dir: string | undefined): Promise<SkillLibraryView>;
/**
 * 把技能库条目名解析成绝对路径。
 *
 * 只接受单个顶层路径段（不含分隔符、`.` / `..`），确保无法越出技能库目录。
 */
export declare function resolveLibraryEntry(dir: string | undefined, entry: unknown): string | undefined;
