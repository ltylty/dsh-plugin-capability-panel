/**
 * 「添加 MCP 服务器 → 预置」使用的静态预置清单。
 *
 * 每个预置给出一条可直接写入 `.mcp.json` 的条目，并可声明一个需要用户
 * 手动填写的认证 Header（如腾讯文档的 mcptoken）。
 *
 * @module @chengdb/capability-panel/client/mcp-presets
 */
/** 预置列表（后续可继续追加）。 */
export const MCP_PRESETS = [
    {
        id: "tencent-docs",
        name: "腾讯文档 MCP",
        summary: "腾讯文档开放平台",
        key: "tencent-docs",
        entry: { type: "http", url: "https://docs.qq.com/openapi/mcp" },
        auth: {
            header: "Authorization",
            label: "mcptoken",
            placeholder: "请输入腾讯文档 MCP 的 mcptoken",
        },
        references: [
            { label: "腾讯文档 MCP 授权页", url: "https://docs.qq.com/open/auth/mcp.html" },
            { label: "腾讯文档 MCP 使用指南", url: "https://developer.cloud.tencent.com/mcp/server/11803" },
        ],
    },
];
