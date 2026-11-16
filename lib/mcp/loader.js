/**
 * 按 session 隔离的 MCP 自动挂载器。
 *
 * 在宿主根上下文上监听 `agent/created`，为每个新 agent 读取项目级
 * `<projectRoot>/.mcp.json`，把每个启用的条目以
 * `agent.ctx.plugin(dsh-mcp-client, config)` 的形式**挂在 agent 自己的
 * Cordis 上下文上**（插件实例优先取宿主那份，见
 * {@link createMcpClientResolver}），因此：
 *
 *   - 工具（`mcp__<serverName>__*`）只在该 session 内可见，agent 被释放时
 *     自动消失；
 *   - A 项目的 session 永远不会看到 B 项目的 server。
 *
 * 面板的写操作调用 {@link McpLoader.reload}，dispose 掉受影响 session 的
 * 旧挂载并重新挂载。
 *
 * @module dsh-workspace-skill-mcp/mcp/loader
 */
import { errMessage } from "../shared/errors.js";
import { findProjectRoot } from "../shared/project-root.js";
import { readMcpFile, toClientConfig } from "./config-file.js";
import { projectMcpFile } from "./paths.js";
/**
 * 解析要挂载的 MCP 桥接插件实例（懒加载 + 缓存一次）。
 *
 * **必须优先用宿主自己的那份** `@deepseek-ai/dsh-mcp-client`：宿主那份按
 * agent 作用域预留 `serverName`，多会话才能各自拿到工具；插件自带副本
 * 只在宿主没有 loader 时（headless 等）兜底。
 */
function createMcpClientResolver(ctx) {
    let resolved;
    return () => {
        resolved ??= (async () => {
            const loader = ctx.get?.("loader");
            if (typeof loader?.import === "function") {
                try {
                    const mod = await loader.import("@deepseek-ai/dsh-mcp-client");
                    if (mod !== null && mod !== undefined) {
                        return typeof loader.unwrapExports === "function" ? loader.unwrapExports(mod) : mod;
                    }
                }
                catch (error) {
                    ctx.logger?.warn?.(`capability-panel: host mcp-client unavailable (${errMessage(error)}); falling back to the bundled copy`);
                }
            }
            return await import("@deepseek-ai/dsh-mcp-client");
        })();
        return resolved;
    };
}
/** 创建挂载器：注册 agent 生命周期监听 + 存量 agent 补挂。 */
export function createMcpLoader(ctx, deps = {}) {
    const sessions = new Map();
    const enabled = deps.enabled !== false;
    const logger = ctx.logger ?? console;
    const mcpClient = createMcpClientResolver(ctx);
    /** 为某个工作区解析项目配置里的启用 server 列表。 */
    async function resolveServers(cwd) {
        if (cwd === undefined)
            return [];
        const servers = await readMcpFile(projectMcpFile(cwd)).catch((error) => {
            logger.warn?.(`capability-panel: ${errMessage(error)}`);
            return {};
        });
        return Object.entries(servers)
            .filter(([, entry]) => entry.disabled !== true)
            .map(([key, entry]) => ({ key, entry }));
    }
    /**
     * 重挂一个 session：先 dispose 上一代 fiber，再逐个挂载本代。
     * `failOnStartupError: false` 保证不可达 server 依然能 resolve。
     */
    async function remount(record) {
        const previous = record.fibers;
        record.fibers = [];
        record.mounts = [];
        await Promise.all(previous.map((fiber) => fiber.dispose().catch(() => undefined)));
        if (!enabled)
            return;
        const servers = await resolveServers(record.cwd);
        for (const { key, entry } of servers) {
            const config = toClientConfig(key, entry, record.projectRoot ?? record.cwd);
            const serverName = config.serverName;
            try {
                const fiber = record.agent.ctx.plugin(await mcpClient(), config);
                record.fibers.push({ dispose: () => fiber.dispose() });
                // await 激活：同步的配置/命名空间失败要归因到这一条。
                await fiber;
                record.mounts.push({ key, serverName, state: "mounted" });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const conflict = /already in use/.test(message);
                const note = "同一 serverName 全应用仅挂载一份：已由本应用的其他会话挂载，本会话不重复挂载";
                record.mounts.push({ key, serverName, state: conflict ? "conflict" : "failed", error: conflict ? note : message });
                logger.warn?.(`capability-panel: MCP server "${key}" not mounted for session ${record.agent.id}: ${message}`);
            }
        }
    }
    /** 每个 session 串行化重挂：并发触发会落在队尾合并执行。 */
    function scheduleRemount(record) {
        const run = record.queue.then(() => remount(record));
        record.queue = run.catch(() => undefined);
        return run;
    }
    /** 登记一个新 agent 并触发首轮挂载（跳过无 ctx/id 的 stub）。 */
    function mountAgent(agent) {
        if (agent?.ctx === undefined || agent?.id === undefined)
            return;
        if (sessions.has(agent.id))
            return;
        const cwd = typeof agent.session?.header?.cwd === "string" ? agent.session.header.cwd : undefined;
        const record = {
            agent,
            cwd,
            projectRoot: cwd !== undefined ? findProjectRoot(cwd) : undefined,
            fibers: [],
            mounts: [],
            queue: Promise.resolve(),
        };
        sessions.set(agent.id, record);
        scheduleRemount(record).catch((error) => {
            logger.warn?.(`capability-panel: MCP mount sweep failed for session ${agent.id}: ${String(error)}`);
        });
    }
    if (enabled) {
        ctx.on("agent/created", ({ agent }) => mountAgent(agent));
        ctx.on("agent/disposed", ({ agent }) => {
            if (agent?.id !== undefined)
                sessions.delete(agent.id);
        });
        for (const agent of ctx.get("agents")?.list?.() ?? []) {
            mountAgent(agent);
        }
    }
    return {
        /** 状态视图；传 cwd 时按项目根过滤。 */
        status(cwd) {
            const projectRoot = cwd !== undefined ? findProjectRoot(cwd) : undefined;
            const views = [];
            for (const [sessionId, record] of sessions) {
                if (projectRoot !== undefined && record.projectRoot !== projectRoot)
                    continue;
                views.push({
                    sessionId,
                    ...(record.projectRoot !== undefined ? { projectRoot: record.projectRoot } : {}),
                    servers: record.mounts.map((mount) => ({ ...mount })),
                });
            }
            return views;
        },
        /** 定向重挂：传 projectRoot 只重挂该项目根的 session，否则全部。 */
        async reload(projectRoot) {
            const tasks = [];
            for (const record of sessions.values()) {
                if (projectRoot !== undefined && record.projectRoot !== projectRoot)
                    continue;
                tasks.push(scheduleRemount(record));
            }
            await Promise.allSettled(tasks);
        },
    };
}
