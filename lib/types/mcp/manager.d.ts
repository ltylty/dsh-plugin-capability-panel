/**
 * MCP 管理服务（挂载为 `ctx.capabilityPanel.mcp`）：对项目级 MCP 配置
 * 文件 `<项目根>/.mcp.json` 的 CRUD，叠加 loader 报告的实时挂载状态。
 *
 * 每次成功写入都会触发一次针对该项目的 loader reload，让改动无需重启即可
 * 在存活 session 中生效。
 *
 * @module @chengdb/capability-panel/mcp/manager
 */
import type { McpListResult, McpServerEntry, McpStatusView } from "./types.js";
import type { McpLoader } from "./loader.js";
/** 一次写操作的最小入参。 */
export interface McpWriteInput {
    /** 项目作用域必填：工作区目录。 */
    cwd?: string;
    key: string;
}
/** upsert 的入参：在 McpWriteInput 之上多一个完整条目。 */
export interface McpUpsertInput extends McpWriteInput {
    entry: McpServerEntry;
}
/** 写操作的结果：成功或带错误信息列表。 */
export type McpOpResult = {
    ok: true;
} | {
    ok: false;
    errors: string[];
};
/** 创建管理服务；loader 由 index.ts 注入（自动挂载与状态共用同一实例）。 */
export declare function createMcpManager(loader: McpLoader): {
    list: (cwd?: string) => Promise<McpListResult>;
    upsert: (input: McpUpsertInput) => Promise<McpOpResult>;
    remove: (input: McpWriteInput) => Promise<McpOpResult>;
    setEnabled: (input: McpWriteInput & {
        enabled: boolean;
    }) => Promise<McpOpResult>;
    status: (cwd?: string) => McpStatusView[];
};
/** 管理服务的完整类型（构造函数的返回值）。 */
export type McpManager = ReturnType<typeof createMcpManager>;
