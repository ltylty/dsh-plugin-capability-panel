/**
 * Capability Panel 的 MCP 域视图。
 *
 * 只管理项目级 <项目根>/.mcp.json：列出真实条目，叠加每个 session 的实时
 * 挂载状态，按搜索词过滤。写入直接落配置文件，宿主在每次写操作后重挂受
 * 影响 session 的连接。
 *
 * @module dsh-workspace-skill-mcp/client/mcp-panel
 */
import type { CapabilityPanelApi } from "./api.js";
/** MCP 视图主组件：状态管理 + 拉取/重拉 + 列表 + 详情/表单。 */
export declare function McpView({ api, workspace }: {
    api: CapabilityPanelApi;
    workspace?: string;
}): import("react").JSX.Element;
