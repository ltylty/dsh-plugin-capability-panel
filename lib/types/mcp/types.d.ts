/**
 * MCP 管理域的共享类型。
 *
 * 磁盘形状刻意与 Claude Code 的 `.mcp.json` 兼容：
 *
 * ```jsonc
 * {
 *   "mcpServers": {
 *     "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "TOKEN": "${GITHUB_TOKEN}" } },
 *     "web":    { "type": "http", "url": "http://localhost:3000/mcp", "headers": { "Authorization": "Bearer ..." } }
 *   }
 * }
 * ```
 *
 * 扩展字段：`"disabled"`（保留条目但不挂载）、`"timeoutMs"`（单次工具调用
 * 超时）、`"cwd"`（stdio 子进程工作目录）。
 *
 * @module @chengdb/capability-panel/mcp/types
 */
/**
 * 磁盘上 `mcpServers` 的一条条目。`type` 对 stdio 条目可以省略
 * （Claude Code 惯例）；`"http"` 与 `"sse"` 都会映射到桥接层的
 * `streamable-http` 传输。
 */
export interface McpServerEntry {
    /** 传输方式：stdio / http / sse（缺省按 command 或 url 推断）。 */
    type?: "stdio" | "http" | "sse";
    /** stdio 传输时启动的命令。 */
    command?: string;
    /** 命令参数。 */
    args?: string[];
    /** 子进程环境变量（值支持 `${VAR}` 插值）。 */
    env?: Record<string, string>;
    /** stdio 子进程工作目录（缺省用项目根）。 */
    cwd?: string;
    /** http / sse 传输的端点 URL。 */
    url?: string;
    /** http 请求头（值支持 `${VAR}` 插值）。 */
    headers?: Record<string, string>;
    /** 单次工具调用超时（毫秒），映射到桥接层 toolCallTimeoutMs。 */
    timeoutMs?: number;
    /** 为 true 时保留条目但不挂载。 */
    disabled?: boolean;
}
/** 面板视角下的一条 server 配置。 */
export interface McpServerView {
    /** 文件里写的条目键名。 */
    key: string;
    /** 桥接层挂载用的规范化命名空间（工具形如 `mcp__<serverName>__*`）。 */
    serverName: string;
    /** 归类后的传输方式（stdio / http）。 */
    transport: "stdio" | "http";
    /** 是否启用（disabled 键缺省为启用）。 */
    enabled: boolean;
    /** 一行人类可读摘要（命令行或 URL）。 */
    summary: string;
    /** 原始条目，回填到编辑表单里。 */
    entry: McpServerEntry;
    /** 声明这条条目的文件绝对路径。 */
    filePath: string;
}
/** 列表结果；单个文件解析失败不致命，收集到 errors 里。 */
export interface McpListResult {
    servers: McpServerView[];
    errors: string[];
}
/** 一条 server 在一个 session 内的实时挂载状态。 */
export type McpMountState = "mounted" | "failed" | "conflict";
/** 某个 session 的 MCP 实时挂载状态视图。 */
export interface McpStatusView {
    sessionId: string;
    /** 该 session 的项目根（无工作区时缺省）。 */
    projectRoot?: string;
    servers: Array<{
        key: string;
        serverName: string;
        state: McpMountState;
        error?: string;
    }>;
}
