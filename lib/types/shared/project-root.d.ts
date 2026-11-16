/**
 * 项目根目录探测——skills 与 mcp 两个域共享的基础工具。
 *
 * 能力配置统一落在项目根的 `.agents` 目录：skill 在
 * `.agents/skills`，MCP 在 `.mcp.json`。向上查找"项目根"是定位这两个
 * 路径的前提，因此把这段逻辑收拢在这里。
 *
 * @module dsh-workspace-skill-mcp/shared/project-root
 */
/**
 * 从 `cwd` 向上逐级查找项目根。
 *
 * 向上走到第一个含项目标记的祖先目录即停。两道护栏：
 *   - **用户主目录永远不被当作祖先级项目根**——主目录下常带
 *     `.agents` / `dsh.json` 等工具目录，若放行，主目录下任意无标记的
 *     子目录都会被误判成项目；
 *   - 找不到任何标记时回退到**原始 cwd**，而不是向上走到文件系统根。
 *
 * @param cwd 起始目录（工作区路径），须为绝对路径
 * @returns 项目根绝对路径
 */
export declare function findProjectRoot(cwd: string): string;
