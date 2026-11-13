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
 * @module @chengdb/capability-panel/mcp/loader
 */
import type { McpStatusView } from "./types.js";
/** 挂载器的构造依赖。 */
export interface McpLoaderDeps {
    /** 为 false 时不挂载任何 server（状态保持为空）。缺省 true。 */
    enabled?: boolean;
}
/** 挂载器对外接口：读状态 + 触发重挂。 */
export interface McpLoader {
    /** 实时挂载视图；传 cwd 时只返回该项目根下的 session。 */
    status(cwd?: string): McpStatusView[];
    /** 重新读配置并重挂匹配的 session（省略 projectRoot 重挂全部）。 */
    reload(projectRoot?: string): Promise<void>;
}
/** 创建挂载器：注册 agent 生命周期监听 + 存量 agent 补挂。 */
export declare function createMcpLoader(ctx: any, deps?: McpLoaderDeps): McpLoader;
