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

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { parseSkill } from "./disk.js";
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
export function resolveLibraryDir(input?: string): string | undefined {
  const raw = input ?? process.env.DSH_SKILL_LIBRARY;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  const expanded = raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
  return resolve(expanded);
}

/** 列出技能库顶层的可安装条目。 */
export async function listSkillLibrary(dir: string | undefined): Promise<SkillLibraryView> {
  if (dir === undefined) return { skills: [], errors: [] };
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    return { dir, skills: [], errors: ["cannot read skill library \"" + dir + "\": " + message(error)] };
  }

  const skills: LibrarySkill[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    try {
      let skillFile: string;
      let format: SkillFormat;
      if (entry.isFile() && entry.name.endsWith(".md")) {
        skillFile = full;
        format = "flat";
      } else if (entry.isDirectory()) {
        skillFile = join(full, "SKILL.md");
        if (!(await isFile(skillFile))) continue;
        format = "directory";
      } else {
        continue;
      }
      const parsed = parseSkill(await readFile(skillFile, "utf8"));
      if (parsed === undefined) {
        errors.push(entry.name + ": invalid skill frontmatter");
        continue;
      }
      skills.push({ name: parsed.spec.name, description: parsed.spec.description, entry: entry.name, format });
    } catch (error) {
      errors.push(entry.name + ": " + message(error));
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { dir, skills, errors };
}

/**
 * 把技能库条目名解析成绝对路径。
 *
 * 只接受单个顶层路径段（不含分隔符、`.` / `..`），确保无法越出技能库目录。
 */
export function resolveLibraryEntry(dir: string | undefined, entry: unknown): string | undefined {
  if (dir === undefined) return undefined;
  if (typeof entry !== "string" || entry.length === 0) return undefined;
  if (entry === "." || entry === ".." || entry.includes("/") || entry.includes("\\") || entry.includes("\0")) return undefined;
  return join(dir, entry);
}

/** 判断路径是否为普通文件（错误一律视为否）。 */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** 统一错误文案。 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
