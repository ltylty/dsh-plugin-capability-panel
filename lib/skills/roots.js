/**
 * 解析 skills 域的物理根目录。
 *
 * 目录布局与文件系统 provider（`dsh-skill-filesystem`）扫描的布局严格对齐：
 * 项目级 skill 固定在 `<项目根>/.agents/skills`。
 *
 * @module dsh-workspace-skill-mcp/skills/roots
 */
import { join } from "node:path";
import { findProjectRoot } from "../shared/project-root.js";
/** 项目 skills 目录：`<项目根>/.agents/skills`。 */
export function projectSkillsDir(cwd, projectRootOverride) {
    const root = projectRootOverride ?? findProjectRoot(cwd);
    return join(root, ".agents", "skills");
}
