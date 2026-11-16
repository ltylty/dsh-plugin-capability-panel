/**
 * 解析 MCP 配置文件的位置。
 *
 * 只管理项目级配置：`<项目根>/.mcp.json`（与 Claude Code 的约定兼容）。
 * 项目根的探测复用 shared/project-root.ts。
 *
 * @module dsh-workspace-skill-mcp/mcp/paths
 */
/**
 * 项目作用域的 MCP 配置文件路径。
 *
 * @param cwd 工作区目录，用于向上探测项目根
 * @param projectRootOverride 预先算好的项目根（可选，避免重复探测）
 * @returns `<项目根>/.mcp.json` 的绝对路径
 */
export declare function projectMcpFile(cwd: string, projectRootOverride?: string): string;
