/**
 * MCP 管理服务（挂载为 `ctx.capabilityPanel.mcp`）：对项目级 MCP 配置
 * 文件 `<项目根>/.mcp.json` 的 CRUD，叠加 loader 报告的实时挂载状态。
 *
 * 每次成功写入都会触发一次针对该项目的 loader reload，让改动无需重启即可
 * 在存活 session 中生效。
 *
 * @module @chengdb/capability-panel/mcp/manager
 */
import { findProjectRoot } from "../shared/project-root.js";
import { withFileLock } from "../shared/file-lock.js";
import { errMessage } from "../shared/errors.js";
import { readMcpFile, sanitizeServerName, summarizeEntry, transportOf, validateEntry, writeMcpFile } from "./config-file.js";
import { projectMcpFile } from "./paths.js";
/** 解析项目配置文件；缺少 cwd 时给出明确错误。 */
function fileFor(cwd) {
    if (cwd === undefined)
        throw new Error("project scope requires a workspace path");
    const root = findProjectRoot(cwd);
    return { file: projectMcpFile(cwd, root), root };
}
/** 创建管理服务；loader 由 index.ts 注入（自动挂载与状态共用同一实例）。 */
export function createMcpManager(loader) {
    /** 一次写操作的公共骨架：文件锁内读 → 改 → 写回。 */
    async function withLockedFile(input, mutate) {
        const { file } = fileFor(input.cwd);
        try {
            return await withFileLock(file, async () => {
                const servers = await readMcpFile(file);
                const result = await mutate(servers, file);
                if (!result.ok)
                    return result;
                await writeMcpFile(file, servers);
                return result;
            });
        }
        catch (error) {
            return { ok: false, errors: [errMessage(error)] };
        }
    }
    /** 执行写入后重挂该项目的 session。 */
    async function reloadFor(cwd) {
        if (cwd !== undefined)
            await loader.reload(findProjectRoot(cwd));
    }
    /** 列出项目配置文件里的全部 server，按 key 排序。 */
    async function list(cwd) {
        if (cwd === undefined)
            return { servers: [], errors: [] };
        const { file } = fileFor(cwd);
        const errors = [];
        const servers = await readMcpFile(file).catch((error) => {
            errors.push(errMessage(error));
            return {};
        });
        const rows = Object.entries(servers).map(([key, entry]) => ({
            key,
            serverName: sanitizeServerName(key),
            transport: transportOf(entry),
            enabled: entry.disabled !== true,
            summary: summarizeEntry(entry),
            entry,
            filePath: file,
        }));
        rows.sort((a, b) => a.key.localeCompare(b.key));
        return { servers: rows, errors };
    }
    /** 新增或整体覆盖一条 server（校验失败不落盘），成功后重挂。 */
    async function upsert(input) {
        const errors = validateEntry(input.key, input.entry);
        if (errors.length > 0)
            return { ok: false, errors };
        const result = await withLockedFile(input, async (servers) => {
            servers[input.key] = input.entry;
            return { ok: true };
        });
        if (!result.ok)
            return result;
        await reloadFor(input.cwd);
        return { ok: true };
    }
    /** 删除一条 server（不存在时返回错误信息），成功后重挂。 */
    async function remove(input) {
        const result = await withLockedFile(input, async (servers, readFile) => {
            // 用 Object.hasOwn 判存在：普通属性查找会把 `__proto__` 等原型链上
            // 的对象误判为"已存在"。
            if (!Object.hasOwn(servers, input.key)) {
                return { ok: false, errors: [`no MCP server named "${input.key}" in ${readFile}`] };
            }
            delete servers[input.key];
            return { ok: true };
        });
        if (!result.ok)
            return result;
        await reloadFor(input.cwd);
        return { ok: true };
    }
    /** 切换启用/禁用（保留条目，只动 disabled 键），成功后重挂。 */
    async function setEnabled(input) {
        const result = await withLockedFile(input, async (servers, readFile) => {
            const entry = Object.hasOwn(servers, input.key) ? servers[input.key] : undefined;
            if (entry === undefined) {
                return { ok: false, errors: [`no MCP server named "${input.key}" in ${readFile}`] };
            }
            if (input.enabled) {
                delete entry.disabled;
            }
            else {
                entry.disabled = true;
            }
            return { ok: true };
        });
        if (!result.ok)
            return result;
        await reloadFor(input.cwd);
        return { ok: true };
    }
    /** 实时挂载状态：直接透传 loader 的视图。 */
    function status(cwd) {
        return loader.status(cwd);
    }
    return { list, upsert, remove, setEnabled, status };
}
