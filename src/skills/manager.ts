/**
 * 传输无关的 skills 域服务（挂载为 `ctx.capabilityPanel.skills`）。
 *
 * 只管理**项目级** skill：根目录固定为 `<项目根>/.agents/skills`，直接读盘
 * 拿到 path/format 等管理列表需要的信息。
 *
 * 写入一律经由 `crud.ts`。启停与调用方向只写 frontmatter 的扁平调用键
 * （`disable-model-invocation` / `user-invocable`）——宿主的目录注入 /
 * `skill` 工具 / `/name` 注入三条链路都原生读这两个键（文件 watcher 使改动
 * 下一步即生效），本插件不维护任何平行的禁用状态。
 *
 * @module dsh-workspace-skill-mcp/skills/manager
 */

import { projectSkillsDir } from "./roots.js";
import { readSkill, resourceDirectory, skillFilePath } from "./disk.js";
import {
  createSkill,
  listSkillEntries,
  readSkillDetail,
  removeSkill,
  setSkillEnabled,
  setSkillInvocation,
  updateSkill,
} from "./crud.js";
import { installFromUrl } from "./download.js";
import { exportSkillFiles, exportToPath, installFromFiles, installFromPath } from "./transfer.js";
import type { TransferFile } from "./transfer.js";
import { listSkillLibrary, resolveLibraryDir, resolveLibraryEntry } from "./library.js";
import type { SkillLibraryView } from "./library.js";
import { invocationPolicy } from "./types.js";
import type { InvocationPolicy, SkillFormat, SkillSource, SkillSummaryView } from "./types.js";

/** 项目级 skill 的来源标记。 */
const SOURCE: SkillSource = "project-agents";

/** 需要工作区才能解析项目根；缺失时给出明确错误。 */
function rootFor(cwd: string | undefined): string {
  if (cwd === undefined) throw new Error("project scope requires a workspace path");
  return projectSkillsDir(cwd);
}

/** 构建 `ctx.capabilityPanel.skills` 服务。 */
export function createService(config: { skillLibrary?: string } = {}) {
  /** 供「从技能库安装」使用的预置目录；未配置时为 undefined。 */
  const libraryDir = resolveLibraryDir(config.skillLibrary);

  /** 项目级 skill 的只读磁盘视图（按名称排序）。 */
  async function list(cwd?: string): Promise<SkillSummaryView[]> {
    if (cwd === undefined) return [];
    const root = rootFor(cwd);
    const entries = await listSkillEntries(root);
    const loaded = await Promise.all(
      entries.map(async ({ name, format }) => {
        const parsed = await readSkill(root, name, format);
        if (parsed === undefined) return undefined;
        return summaryView({
          name: parsed.spec.name,
          description: parsed.spec.description,
          whenToUse: parsed.spec.whenToUse,
          invocation: invocationPolicy(parsed.spec.invocation),
          format,
          filePath: skillFilePath(root, name, format),
          resourceDirectory: format === "directory" ? resourceDirectory(root, name) : undefined,
        });
      }),
    );
    return loaded.filter((view): view is SkillSummaryView => view !== undefined).sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    list,
    /** 创建 skill；目标根固定 `<项目根>/.agents/skills`。 */
    async create(input: { cwd?: string; format: SkillFormat; spec: unknown; body: string; overwrite?: boolean }) {
      return createSkill({
        root: rootFor(input.cwd),
        format: input.format,
        spec: input.spec as never,
        body: input.body,
        overwrite: input.overwrite,
      });
    },
    /** 更新 skill。 */
    async update(input: { cwd?: string; name: string; spec: unknown; body: string }) {
      return updateSkill({ root: rootFor(input.cwd), name: input.name, spec: input.spec as never, body: input.body });
    },
    /** 删除 skill。 */
    async remove(input: { cwd?: string; name: string }) {
      return removeSkill(rootFor(input.cwd), input.name);
    },
    /** 一键启用/禁用 skill；只写 frontmatter 调用键，宿主原生生效。 */
    async setEnabled(input: { cwd?: string; name: string; enabled: boolean }) {
      return setSkillEnabled({ root: rootFor(input.cwd), name: input.name, enabled: input.enabled });
    },
    /** 细粒度调节调用方式：模型/用户两个方向分别启用或禁用。 */
    async setInvocation(input: { cwd?: string; name: string; modelInvocable: boolean; userInvocable: boolean }) {
      return setSkillInvocation({
        root: rootFor(input.cwd),
        name: input.name,
        modelInvocable: input.modelInvocable,
        userInvocable: input.userInvocable,
      });
    },
    /** 读取 skill 详情。 */
    async read(input: { cwd?: string; name: string }) {
      return readSkillDetail(rootFor(input.cwd), input.name);
    },
    /** 技能库目录下的可安装条目（供安装对话框下拉框使用）。 */
    async sources(): Promise<SkillLibraryView> {
      return listSkillLibrary(libraryDir);
    },
    /**
     * 安装 skill：`entry` 从预置技能库选择，`url` 走 HTTP 下载
     * （GitHub 仓库 / .zip / raw .md），`files` 走客户端上传落盘。
     */
    async install(input: {
      cwd?: string;
      entry?: string;
      url?: string;
      files?: TransferFile[];
      overwrite?: boolean;
    }) {
      const root = rootFor(input.cwd);
      if (typeof input.entry === "string" && input.entry.length > 0) {
        if (libraryDir === undefined) {
          return { ok: false, errors: ["skill library is not configured (set skillLibrary or DSH_SKILL_LIBRARY)"] };
        }
        const sourcePath = resolveLibraryEntry(libraryDir, input.entry);
        if (sourcePath === undefined) {
          return { ok: false, errors: [`invalid skill library entry "${input.entry}"`] };
        }
        return installFromPath({ root, sourcePath, overwrite: input.overwrite });
      }
      if (typeof input.url === "string" && input.url.length > 0) {
        return installFromUrl({ root, url: input.url, overwrite: input.overwrite });
      }
      if (Array.isArray(input.files)) {
        return installFromFiles({ root, files: input.files, overwrite: input.overwrite });
      }
      return { ok: false, errors: ["install requires an entry, a url, or a files list"] };
    },
    /** 导出 skill：给 `destDir` 复制到宿主目录；否则读成 base64 文件清单。 */
    async export(input: { cwd?: string; name: string; destDir?: string; overwrite?: boolean }) {
      const root = rootFor(input.cwd);
      if (typeof input.destDir === "string" && input.destDir.length > 0) {
        return exportToPath({ root, name: input.name, destDir: input.destDir, overwrite: input.overwrite });
      }
      return exportSkillFiles(root, input.name);
    },
  };
}

/** 组装一行面板摘要（可选字段缺省时不输出，减少序列化噪音）。 */
function summaryView(input: {
  name: string;
  description: string;
  whenToUse: string | undefined;
  invocation: InvocationPolicy;
  format: SkillFormat;
  /** skill 文件的绝对路径（directory 为 SKILL.md，flat 为 <name>.md）。 */
  filePath: string;
  /** directory 布局时的资源基准目录（flat 为 undefined）。 */
  resourceDirectory: string | undefined;
}): SkillSummaryView {
  return {
    name: input.name,
    description: input.description,
    ...(input.whenToUse !== undefined ? { whenToUse: input.whenToUse } : {}),
    invocation: input.invocation,
    source: SOURCE,
    format: input.format,
    path: input.filePath,
    ...(input.resourceDirectory !== undefined ? { resourceDirectory: input.resourceDirectory } : {}),
  };
}
