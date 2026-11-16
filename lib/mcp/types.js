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
 * @module dsh-workspace-skill-mcp/mcp/types
 */
export {};
