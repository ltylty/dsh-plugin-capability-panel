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
 * @module @chengdb/capability-panel/client/panel
 */
import type { CapabilityPanelApi } from "./api.js";
/** 面板根组件：头部（标题 + 当前工作区 + 关闭按钮 + 域 Tab）+ 当前域视图。 */
export declare function CapabilityPanel({ api, onClose }: {
    api: CapabilityPanelApi;
    onClose?: () => void;
}): import("react").JSX.Element;
/**
 * 侧栏底部入口：Settings 旁的一个按钮，点击切换居中的浮层面板。
 */
export declare function CapabilitiesFooterAction({ api, wide }: {
    api: CapabilityPanelApi;
    wide: boolean;
}): import("react").JSX.Element;
