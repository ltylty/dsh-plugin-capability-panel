/**
 * 「添加 MCP 服务器 → 预置」使用的静态预置清单。
 *
 * 每个预置给出一条可直接写入 `.mcp.json` 的条目，并可声明一个需要用户
 * 手动填写的认证 Header（如腾讯文档的 mcptoken）。
 *
 * @module @chengdb/capability-panel/client/mcp-presets
 */
import type { McpServerEntry } from "../mcp/types.js";
/** 预置条目需要用户填写的认证信息。 */
export interface McpPresetAuth {
    /** Header 名（如 Authorization）。 */
    header: string;
    /** 输入框标签（如 mcptoken）。 */
    label: string;
    /** 输入框占位提示。 */
    placeholder?: string;
}
/** 一个预置 MCP。 */
export interface McpPreset {
    id: string;
    /** 下拉框展示名。 */
    name: string;
    /** 下拉框右侧短说明。 */
    summary: string;
    /** 写入 `.mcp.json` 的键名。 */
    key: string;
    /** 预置条目（auth 的 Header 值由用户在提交时填写）。 */
    entry: McpServerEntry;
    /** 需要手动填写的认证 Header。 */
    auth?: McpPresetAuth;
    /** 授权 / 文档等参考链接。 */
    references?: Array<{
        label: string;
        url: string;
    }>;
}
/** 预置列表（后续可继续追加）。 */
export declare const MCP_PRESETS: McpPreset[];
