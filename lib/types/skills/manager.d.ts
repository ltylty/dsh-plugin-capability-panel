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
 * @module @chengdb/capability-panel/skills/manager
 */
import type { TransferFile } from "./transfer.js";
import type { SkillLibraryView } from "./library.js";
import type { SkillFormat, SkillSummaryView } from "./types.js";
/** 构建 `ctx.capabilityPanel.skills` 服务。 */
export declare function createService(config?: {
    skillLibrary?: string;
}): {
    list: (cwd?: string) => Promise<SkillSummaryView[]>;
    /** 创建 skill；目标根固定 `<项目根>/.agents/skills`。 */
    create(input: {
        cwd?: string;
        format: SkillFormat;
        spec: unknown;
        body: string;
        overwrite?: boolean;
    }): Promise<import("./crud.js").CreateResult>;
    /** 更新 skill。 */
    update(input: {
        cwd?: string;
        name: string;
        spec: unknown;
        body: string;
    }): Promise<import("./crud.js").CreateResult>;
    /** 删除 skill。 */
    remove(input: {
        cwd?: string;
        name: string;
    }): Promise<{
        ok: boolean;
        errors?: string[];
    }>;
    /** 一键启用/禁用 skill；只写 frontmatter 调用键，宿主原生生效。 */
    setEnabled(input: {
        cwd?: string;
        name: string;
        enabled: boolean;
    }): Promise<{
        ok: boolean;
        errors?: string[];
    }>;
    /** 细粒度调节调用方式：模型/用户两个方向分别启用或禁用。 */
    setInvocation(input: {
        cwd?: string;
        name: string;
        modelInvocable: boolean;
        userInvocable: boolean;
    }): Promise<{
        ok: boolean;
        errors?: string[];
    }>;
    /** 读取 skill 详情。 */
    read(input: {
        cwd?: string;
        name: string;
    }): Promise<import("./crud.js").ReadResult>;
    /** 技能库目录下的可安装条目（供安装对话框下拉框使用）。 */
    sources(): Promise<SkillLibraryView>;
    /**
     * 安装 skill：`entry` 从预置技能库选择，`url` 走 HTTP 下载
     * （GitHub 仓库 / .zip / raw .md），`files` 走客户端上传落盘。
     */
    install(input: {
        cwd?: string;
        entry?: string;
        url?: string;
        files?: TransferFile[];
        overwrite?: boolean;
    }): Promise<import("./transfer.js").TransferResult>;
    /** 导出 skill：给 `destDir` 复制到宿主目录；否则读成 base64 文件清单。 */
    export(input: {
        cwd?: string;
        name: string;
        destDir?: string;
        overwrite?: boolean;
    }): Promise<import("./transfer.js").TransferResult>;
};
