/**
 * Capability Panel 的 React 视图（侧栏底部按钮弹出的浮层面板）。
 *
 * 根容器按能力域分 Tab：
 *   - Skills：当前工作区项目级技能（`<项目根>/.agents/skills`）；
 *   - MCP：当前工作区项目级 `.mcp.json` 的 server 管理，带实时挂载状态
 *     （见 `mcp-panel.tsx`）。
 *
 * 面板始终直接定位到**当前会话的工作区**，不提供项目切换入口。
 *
 * @module dsh-workspace-skill-mcp/client/panel
 */
import type { CapabilityPanelApi } from "./api.js";
/** 面板根组件：头部（标题 + 当前工作区 + 关闭按钮 + 域 Tab）+ 当前域视图。 */
export declare function CapabilityPanel({ api }: {
    api: CapabilityPanelApi;
}): import("react").JSX.Element;
/**
 * 主面板整页：侧栏「工作区技能」导航行选中后渲染在主内容区。
 */
export declare function WorkspaceSkillsPage({ api }: {
    api: CapabilityPanelApi;
}): import("react").JSX.Element;
/**
 * 侧栏导航行图标（由宿主传入尺寸；currentColor 跟随选中/悬停色）。
 */
export declare function WorkspaceSkillsIcon({ size }: {
    size: number;
}): import("react").JSX.Element;
