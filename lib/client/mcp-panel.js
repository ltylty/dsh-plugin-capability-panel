import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Capability Panel 的 MCP 域视图。
 *
 * 只管理项目级 <项目根>/.mcp.json：列出真实条目，叠加每个 session 的实时
 * 挂载状态，按搜索词过滤。写入直接落配置文件，宿主在每次写操作后重挂受
 * 影响 session 的连接。
 *
 * @module dsh-workspace-skill-mcp/client/mcp-panel
 */
import { useMemo, useState } from "react";
import { summarizeEntry, transportOf, validateEntry } from "../mcp/entry-util.js";
import { Modal } from "./modal.js";
import { SkpSelect } from "./select.js";
import { hasWorkspaceLabel, useAsyncList } from "./panel-common.js";
import { aggregateMounts, MOUNT_LABEL } from "./mcp-common.js";
import { MCP_PRESETS } from "./mcp-presets.js";
/** 行圆点的 tooltip：以启用/禁用为主语义，挂载状态作为补充说明。 */
function rowDotTitle(server, mount) {
    if (!server.enabled)
        return "已禁用（不挂载）";
    if (mount === undefined)
        return "已启用 · 未挂载到当前会话";
    return mount.error !== undefined ? "已启用 · " + MOUNT_LABEL[mount.state] + "：" + mount.error : "已启用 · " + MOUNT_LABEL[mount.state];
}
/** MCP 视图主组件：状态管理 + 拉取/重拉 + 列表 + 详情/表单。 */
export function McpView({ api, workspace }) {
    const mcpApi = api.mcp;
    const [opError, setOpError] = useState(undefined);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(undefined);
    const [editServer, setEditServer] = useState(undefined);
    const [addOpen, setAddOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(undefined);
    const { data, loading, error, reload } = useAsyncList(async () => {
        const [list, statuses] = await Promise.all([mcpApi.list(), mcpApi.status().catch(() => [])]);
        return { servers: list.servers, listErrors: list.errors, mounts: aggregateMounts(statuses) };
    }, [mcpApi, workspace]);
    const servers = data?.servers ?? [];
    const listErrors = data?.listErrors ?? [];
    const mounts = data?.mounts ?? {};
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return servers.filter((server) => q.length === 0 || server.key.toLowerCase().includes(q) || server.summary.toLowerCase().includes(q));
    }, [servers, query]);
    const selectedServer = servers.find((server) => server.key === selected);
    const noWorkspace = !hasWorkspaceLabel(workspace);
    /** 执行一次写操作：失败写 opError；成功清错误并重拉列表。返回是否成功。 */
    const runOp = async (op) => {
        const result = await op;
        if (!result.ok) {
            setOpError(result.errors.join("; "));
            return false;
        }
        setOpError(undefined);
        reload();
        return true;
    };
    /** 启用/禁用切换（写入配置文件，落盘后宿主自动重挂）。 */
    const onToggle = (server) => {
        void runOp(mcpApi.setEnabled({ key: server.key, enabled: !server.enabled }));
    };
    /** 删除：第一次点击进入确认态；再次点击才真正删除并清空选中。 */
    const onDelete = (server) => {
        if (confirmDelete !== server.key) {
            setConfirmDelete(server.key);
            return;
        }
        setConfirmDelete(undefined);
        void runOp(mcpApi.remove({ key: server.key })).then((ok) => {
            if (ok)
                setSelected(undefined);
        });
    };
    return (_jsxs("div", { className: "skp-domain", children: [_jsxs("div", { className: "skp-subheader", children: [_jsx("input", { className: "skp-search", type: "search", placeholder: "\u641C\u7D22 MCP \u670D\u52A1\u5668\u2026", value: query, onChange: (e) => setQuery(e.target.value) }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: noWorkspace, title: noWorkspace ? "需要可写的工作区才能添加" : undefined, onClick: () => {
                            setEditServer(undefined);
                            setSelected(undefined);
                            setAddOpen(true);
                        }, children: "+ \u6DFB\u52A0" })] }), listErrors.length > 0 && _jsx("div", { className: "skp-error", children: listErrors.join("\n") }), opError && _jsx("div", { className: "skp-error", children: opError }), error && _jsx("div", { className: "skp-error", children: error }), loading && _jsx("div", { className: "skp-status", children: "\u52A0\u8F7D\u4E2D\u2026" }), !loading && (_jsxs("div", { className: "skp-body", children: [_jsxs("ul", { className: "skp-list", children: [visible.map((server) => {
                                const mount = mounts[server.key];
                                return (_jsx("li", { children: _jsxs("button", { className: selected === server.key ? "skp-row skp-row-active" : "skp-row", onClick: () => {
                                            setSelected(server.key);
                                            setEditServer(undefined);
                                            setConfirmDelete(undefined);
                                        }, children: [_jsxs("span", { className: "skp-row-name", children: [_jsx("span", { className: "skp-dot " + (server.enabled ? "skp-dot-enabled" : ""), title: rowDotTitle(server, mount) }), server.key] }), _jsxs("span", { className: "skp-row-meta", children: [_jsx("span", { className: "skp-tag skp-tag-flat", children: server.transport }), !server.enabled && _jsx("span", { className: "skp-tag skp-tag-readonly", children: "\u5DF2\u7981\u7528" }), server.enabled && mount?.state === "failed" && _jsx("span", { className: "skp-tag skp-tag-error", children: "\u6302\u8F7D\u5931\u8D25" }), server.enabled && mount?.state === "conflict" && _jsx("span", { className: "skp-tag skp-tag-warn", children: "\u51B2\u7A81" })] }), _jsx("span", { className: "skp-row-desc", children: server.summary })] }) }, server.key));
                            }), visible.length === 0 && (_jsx("li", { className: "skp-empty", children: noWorkspace ? "当前没有工作区。" : "本项目还没有 MCP 服务器。点「+ 添加」新增。" }))] }), _jsx("div", { className: "skp-detail", children: selectedServer ? (_jsx(McpDetail, { server: selectedServer, mount: mounts[selectedServer.key], confirmingDelete: confirmDelete === selectedServer.key, onEdit: () => setEditServer(selectedServer), onToggle: () => onToggle(selectedServer), onDelete: () => onDelete(selectedServer) })) : (_jsx("div", { className: "skp-detail-empty", children: "\u9009\u62E9\u4E00\u4E2A\u670D\u52A1\u5668\u67E5\u770B\u8BE6\u60C5\uFF0C\u6216\u65B0\u589E\u4E00\u4E2A\u3002" })) })] })), addOpen && (_jsx(McpAddDialog, { api: mcpApi, servers: servers, workspace: workspace, onClose: () => setAddOpen(false), onMutated: () => reload() })), editServer !== undefined && (_jsx(McpEditDialog, { api: mcpApi, server: editServer, workspace: workspace, onClose: () => setEditServer(undefined), onSaved: () => reload() }))] }));
}
// ---------------------------------------------------------------------------
// 详情卡片
// ---------------------------------------------------------------------------
/** 详情卡片：展示条目字段 + 挂载状态 + 写操作。 */
function McpDetail({ server, mount, confirmingDelete, onEdit, onToggle, onDelete, }) {
    return (_jsxs("div", { className: "skp-detail-card", children: [_jsx("div", { className: "skp-detail-head", children: _jsx("h3", { children: server.key }) }), _jsxs("div", { className: "skp-detail-actions", children: [_jsx("button", { type: "button", className: "skp-btn " + (server.enabled ? "skp-state-on" : "skp-state-off"), title: server.enabled ? "点击禁用（保留在配置文件中，不挂载）" : "点击启用（写入配置文件并挂载）", onClick: onToggle, children: server.enabled ? "已启用" : "已禁用" }), _jsx("button", { type: "button", className: "skp-btn", onClick: onEdit, children: "\u7F16\u8F91" }), _jsx("button", { type: "button", className: confirmingDelete ? "skp-btn skp-btn-danger" : "skp-btn skp-btn-danger-ghost", title: "\u5220\u9664\u672C\u9879\u76EE\u4E2D\u7684\u8FD9\u4E2A\u670D\u52A1\u5668", onClick: onDelete, children: confirmingDelete ? "确认删除？" : "删除" })] }), _jsxs("dl", { className: "skp-detail-fields", children: [_jsx("dt", { children: "\u547D\u540D\u7A7A\u95F4" }), _jsxs("dd", { children: ["mcp__", server.serverName, "__*"] }), server.transport === "stdio" ? (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u547D\u4EE4" }), _jsx("dd", { className: "skp-path", children: server.entry.command }), (server.entry.args ?? []).length > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u53C2\u6570" }), _jsx("dd", { className: "skp-path", children: (server.entry.args ?? []).join(" ") })] }))] })) : (_jsxs(_Fragment, { children: [_jsx("dt", { children: "URL" }), _jsx("dd", { className: "skp-path", children: server.entry.url })] })), _jsx("dt", { children: "\u914D\u7F6E\u6587\u4EF6" }), _jsx("dd", { className: "skp-path", children: server.filePath }), _jsx("dt", { children: "\u72B6\u6001" }), _jsx("dd", { children: mount === undefined ? "未挂载到当前会话" : MOUNT_LABEL[mount.state] }), mount?.error !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u9519\u8BEF" }), _jsx("dd", { className: "skp-path", children: mount.error })] }))] })] }));
}
// ---------------------------------------------------------------------------
// 新增 / 编辑表单
// ---------------------------------------------------------------------------
/** 新增 / 编辑表单。embedded 为 true 时褪掉卡片外壳。 */
function McpForm({ mode, server, workspace, embedded, actionsClass = "skp-detail-actions", onCancel, onSave, }) {
    const entry = server?.entry ?? {};
    const [key, setKey] = useState(server?.key ?? "");
    const [transport, setTransport] = useState(server?.transport ?? "stdio");
    const [command, setCommand] = useState(entry.command ?? "");
    const [args, setArgs] = useState((entry.args ?? []).join("\n"));
    const [env, setEnv] = useState(recordToLines(entry.env));
    const [url, setUrl] = useState(entry.url ?? "");
    const [headers, setHeaders] = useState(recordToLines(entry.headers));
    const [timeoutMs, setTimeoutMs] = useState(entry.timeoutMs !== undefined ? String(entry.timeoutMs) : "");
    const [disabled, setDisabled] = useState(entry.disabled === true);
    const [errors, setErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const isNew = mode === "new";
    const noWorkspace = !hasWorkspaceLabel(workspace);
    /** 客户端前置校验（与宿主的 validateEntry 保持同口径，快速反馈）。 */
    const submit = async () => {
        const problems = [];
        if (key.trim().length === 0)
            problems.push("名称不能为空");
        if (transport === "stdio" && command.trim().length === 0)
            problems.push("stdio 服务器需要填写「命令」");
        if (transport === "http" && url.trim().length === 0)
            problems.push("http 服务器需要填写「URL」");
        const envRecord = linesToRecord(env, "env", problems);
        const headerRecord = linesToRecord(headers, "headers", problems);
        const timeout = timeoutMs.trim().length === 0 ? undefined : Number(timeoutMs);
        if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0))
            problems.push("超时必须是正数（ms）");
        if (problems.length > 0) {
            setErrors(problems);
            return;
        }
        const next = transport === "stdio"
            ? {
                type: "stdio",
                command: command.trim(),
                args: linesToArray(args),
                ...(Object.keys(envRecord).length > 0 ? { env: envRecord } : {}),
                ...(timeout !== undefined ? { timeoutMs: timeout } : {}),
                ...(disabled ? { disabled: true } : {}),
            }
            : {
                type: "http",
                url: url.trim(),
                ...(Object.keys(headerRecord).length > 0 ? { headers: headerRecord } : {}),
                ...(timeout !== undefined ? { timeoutMs: timeout } : {}),
                ...(disabled ? { disabled: true } : {}),
            };
        setSaving(true);
        try {
            await onSave(key.trim(), next);
            setErrors([]);
        }
        catch (error) {
            setErrors([error instanceof Error ? error.message : String(error)]);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: embedded ? undefined : "skp-detail-card", children: [!embedded && _jsx("h3", { children: isNew ? "添加 MCP 服务器" : "编辑 " + (server?.key ?? "") }), errors.length > 0 && _jsx("div", { className: "skp-error", children: errors.join("\n") }), _jsxs("div", { className: "skp-form", children: [_jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u540D\u79F0" }), _jsx("input", { className: "skp-input", value: key, disabled: !isNew, placeholder: "github", onChange: (e) => setKey(e.target.value) })] }), _jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u4F20\u8F93\u65B9\u5F0F" }), _jsxs("select", { className: "skp-input", value: transport, onChange: (e) => setTransport(e.target.value === "http" ? "http" : "stdio"), children: [_jsx("option", { value: "stdio", children: "stdio\uFF08\u542F\u52A8\u672C\u5730\u547D\u4EE4\uFF09" }), _jsx("option", { value: "http", children: "http\uFF08\u6D41\u5F0F HTTP \u7AEF\u70B9\uFF09" })] })] }), transport === "stdio" ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u547D\u4EE4" }), _jsx("input", { className: "skp-input", value: command, placeholder: "npx", onChange: (e) => setCommand(e.target.value) })] }), _jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u53C2\u6570\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09" }), _jsx("textarea", { className: "skp-input skp-textarea", value: args, placeholder: "-y\n@modelcontextprotocol/server-github", onChange: (e) => setArgs(e.target.value) })] }), _jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u73AF\u5883\u53D8\u91CF\uFF08\u6BCF\u884C KEY=VALUE\uFF09" }), _jsx("textarea", { className: "skp-input skp-textarea", value: env, placeholder: "GITHUB_TOKEN=xxx", onChange: (e) => setEnv(e.target.value) })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "URL" }), _jsx("input", { className: "skp-input", value: url, placeholder: "http://localhost:3000/mcp", onChange: (e) => setUrl(e.target.value) })] }), _jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u8BF7\u6C42\u5934\uFF08\u6BCF\u884C KEY=VALUE\uFF09" }), _jsx("textarea", { className: "skp-input skp-textarea", value: headers, onChange: (e) => setHeaders(e.target.value) })] })] })), _jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u5DE5\u5177\u8C03\u7528\u8D85\u65F6\uFF08ms\uFF0C\u53EF\u9009\uFF09" }), _jsx("input", { className: "skp-input", value: timeoutMs, inputMode: "numeric", placeholder: "60000", onChange: (e) => setTimeoutMs(e.target.value) })] }), _jsxs("label", { className: "skp-field skp-field-inline", children: [_jsx("input", { type: "checkbox", checked: disabled, onChange: (e) => setDisabled(e.target.checked) }), _jsx("span", { children: "\u7981\u7528\uFF08\u4FDD\u7559\u5728\u914D\u7F6E\u6587\u4EF6\u4E2D\uFF0C\u4E0D\u6302\u8F7D\uFF09" })] }), isNew && noWorkspace && _jsx("div", { className: "skp-error", children: "\u9700\u8981\u53EF\u5199\u7684\u5DE5\u4F5C\u533A\u624D\u80FD\u6DFB\u52A0\u3002" }), _jsxs("div", { className: actionsClass, children: [_jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: saving || (isNew && noWorkspace), onClick: () => void submit(), children: saving ? (isNew ? "添加中…" : "保存中…") : isNew ? "添加" : "保存" }), _jsx("button", { type: "button", className: "skp-btn", onClick: onCancel, children: "\u53D6\u6D88" })] })] })] }));
}
// ---------------------------------------------------------------------------
// 添加弹窗（表单 / JSON）
// ---------------------------------------------------------------------------
/** 添加 MCP 服务器弹窗：表单 / JSON 两种模式。 */
function McpAddDialog({ api, servers, workspace, onClose, onMutated, }) {
    const [tab, setTab] = useState("preset");
    return (_jsxs(Modal, { title: "\u6DFB\u52A0 MCP \u670D\u52A1\u5668", onClose: onClose, children: [_jsx("div", { className: "skp-tabs", role: "tablist", children: ["preset", "form", "json"].map((t) => (_jsx("button", { role: "tab", "aria-selected": tab === t, className: tab === t ? "skp-tab skp-tab-active" : "skp-tab", onClick: () => setTab(t), children: t === "preset" ? "预置" : t === "form" ? "表单" : "JSON" }, t))) }), _jsx("div", { hidden: tab !== "preset", children: _jsx(McpPresetImport, { api: api, onClose: onClose, onMutated: onMutated }) }), _jsx("div", { hidden: tab !== "form", children: _jsx(McpForm, { mode: "new", workspace: workspace, embedded: true, actionsClass: "skp-modal-actions", onCancel: onClose, onSave: async (key, entry) => {
                        const result = await api.upsert({ key, entry });
                        if (!result.ok)
                            throw new Error(result.errors.join("; "));
                        onMutated();
                        onClose();
                    } }) }), _jsx("div", { hidden: tab !== "json", children: _jsx(McpJsonImport, { api: api, servers: servers, onClose: onClose, onMutated: onMutated }) })] }));
}
/** 编辑 MCP 服务器弹窗。 */
function McpEditDialog({ api, server, workspace, onClose, onSaved, }) {
    return (_jsx(Modal, { title: "编辑 " + server.key, onClose: onClose, children: _jsx(McpForm, { mode: "edit", server: server, workspace: workspace, embedded: true, actionsClass: "skp-modal-actions", onCancel: onClose, onSave: async (key, entry) => {
                const result = await api.upsert({ key, entry });
                if (!result.ok)
                    throw new Error(result.errors.join("; "));
                onSaved();
                onClose();
            } }) }));
}
/**
 * 预置 MCP 面板：从下拉框选择一个预置，按需填写认证 Header 后一键添加。
 */
function McpPresetImport({ api, onClose, onMutated }) {
    const [presetId, setPresetId] = useState(MCP_PRESETS[0]?.id ?? "");
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState([]);
    const preset = MCP_PRESETS.find((item) => item.id === presetId) ?? MCP_PRESETS[0];
    if (preset === undefined)
        return _jsx("div", { className: "skp-error", children: "\u6CA1\u6709\u53EF\u7528\u7684\u9884\u7F6E MCP\u3002" });
    const submit = async () => {
        setBusy(true);
        setErrors([]);
        const entry = { ...preset.entry };
        if (preset.auth !== undefined) {
            entry.headers = { ...(entry.headers ?? {}), [preset.auth.header]: token.trim() };
        }
        const result = await api.upsert({ key: preset.key, entry });
        if (!result.ok) {
            setErrors(result.errors);
            setBusy(false);
            return;
        }
        onMutated();
        onClose();
    };
    const canSubmit = !busy && (preset.auth === undefined || token.trim().length > 0);
    return (_jsxs("div", { className: "skp-form", children: [_jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u9884\u7F6E MCP" }), _jsx(SkpSelect, { value: preset.id, ariaLabel: "\u9884\u7F6E MCP", options: MCP_PRESETS.map((item) => ({ value: item.id, label: item.name, hint: item.summary })), onChange: setPresetId })] }), _jsxs("div", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u670D\u52A1\u5730\u5740" }), _jsx("span", { className: "skp-note skp-path", children: preset.entry.url })] }), preset.auth !== undefined && (_jsxs("label", { className: "skp-field", children: [_jsxs("span", { className: "skp-field-label", children: [preset.auth.label, "\uFF08Header: ", preset.auth.header, "\uFF09"] }), _jsx("input", { className: "skp-input", type: "password", autoComplete: "off", value: token, placeholder: preset.auth.placeholder ?? "", onChange: (e) => setToken(e.target.value) })] })), preset.references !== undefined && preset.references.length > 0 && (_jsx("span", { className: "skp-note", children: preset.references.map((reference, index) => (_jsxs("span", { children: [index > 0 && " · ", _jsx("a", { href: reference.url, target: "_blank", rel: "noreferrer", children: reference.label })] }, reference.url))) })), errors.length > 0 && _jsx("div", { className: "skp-error", children: errors.join("\n") }), _jsxs("div", { className: "skp-modal-actions", children: [_jsx("button", { type: "button", className: "skp-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: !canSubmit, onClick: () => void submit(), children: busy ? "添加中…" : "添加" })] })] }));
}
/**
 * 解析"添加 MCP 服务器"的 JSON 文本为条目清单。
 */
function parseMcpJson(text) {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (error) {
        return { ok: false, errors: ["JSON 解析失败：" + (error instanceof Error ? error.message : String(error))] };
    }
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, errors: ['JSON 顶层必须是对象，例如 { "mcpServers": { … } } 或 { "服务器名": { … } }'] };
    }
    const root = data;
    if (Object.keys(root).length > 0 && Object.values(root).every((v) => v === null || typeof v !== "object" || Array.isArray(v))) {
        return { ok: false, errors: ['看起来是单条服务器条目，缺少名称键；请用 { "服务器名": { … } } 包裹。'] };
    }
    let servers;
    if (typeof root.mcpServers === "object" && root.mcpServers !== null && !Array.isArray(root.mcpServers)) {
        servers = root.mcpServers;
    }
    else if ("mcpServers" in root && Object.keys(root).length === 1) {
        return { ok: false, errors: ["「mcpServers」必须是服务器对象映射。"] };
    }
    else {
        servers = root;
    }
    const entries = [];
    const problems = [];
    for (const [key, value] of Object.entries(servers)) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            problems.push(key + ": 条目必须是对象");
            continue;
        }
        const entry = value;
        const entryProblems = validateEntry(key, entry);
        if (entryProblems.length > 0) {
            problems.push(key + ": " + entryProblems.join("; "));
            continue;
        }
        entries.push({ key, entry });
    }
    if (problems.length > 0)
        return { ok: false, errors: problems };
    if (entries.length === 0)
        return { ok: false, errors: ["没有可添加的服务器条目。"] };
    return { ok: true, entries };
}
/** JSON 文本框占位示例（两种形状都能贴）。 */
const JSON_PLACEHOLDER = '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_TOKEN": "xxx" }\n    },\n    "web": { "type": "http", "url": "http://localhost:3000/mcp" }\n  }\n}';
/**
 * JSON 批量添加面板：逐条串行 upsert，避免读-改-写竞态。
 */
function McpJsonImport({ api, servers, onClose, onMutated, }) {
    const [text, setText] = useState("");
    const [overwrite, setOverwrite] = useState(false);
    const [busy, setBusy] = useState(false);
    const [opErrors, setOpErrors] = useState([]);
    const parse = useMemo(() => parseMcpJson(text), [text]);
    const preview = useMemo(() => {
        if (!parse.ok)
            return undefined;
        return parse.entries.map(({ key, entry }) => {
            const exists = servers.some((s) => s.key === key);
            return { key, entry, exists, overwriting: exists && overwrite, skipped: exists && !overwrite };
        });
    }, [parse, servers, overwrite]);
    const addable = preview?.filter((item) => !item.skipped) ?? [];
    const doAdd = async () => {
        setBusy(true);
        setOpErrors([]);
        const failures = [];
        let added = 0;
        for (const { key, entry } of addable) {
            const result = await api.upsert({ key, entry });
            if (result.ok)
                added += 1;
            else
                failures.push(key + ": " + result.errors.join("; "));
        }
        onMutated();
        if (failures.length > 0) {
            setOpErrors(["已添加 " + added + " 个，失败 " + failures.length + " 个：", ...failures]);
            setBusy(false);
            return;
        }
        onClose();
    };
    return (_jsxs("div", { className: "skp-form", children: [_jsxs("label", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "JSON \u914D\u7F6E" }), _jsx("textarea", { className: "skp-input skp-textarea skp-json-field", value: text, spellCheck: false, placeholder: JSON_PLACEHOLDER, onChange: (e) => {
                            setText(e.target.value);
                            setOpErrors([]);
                        } }), _jsx("span", { className: "skp-note", children: "\u652F\u6301\u5B8C\u6574 .mcp.json\uFF08\u542B mcpServers \u952E\uFF09\u6216\u88F8\u670D\u52A1\u5668\u6620\u5C04\u3002" })] }), !parse.ok && text.trim().length > 0 && _jsx("div", { className: "skp-error", children: parse.errors.join("\n") }), preview !== undefined && preview.length > 0 && (_jsxs("div", { className: "skp-field", children: [_jsxs("span", { className: "skp-field-label", children: ["\u5C06\u6DFB\u52A0 ", addable.length, "/", preview.length, " \u4E2A"] }), _jsx("ul", { className: "skp-import-list", children: preview.map(({ key, entry, overwriting, skipped }) => (_jsxs("li", { className: "skp-import-item", children: [_jsx("span", { className: "skp-import-name", children: key }), _jsx("span", { className: "skp-tag skp-tag-flat", children: transportOf(entry) }), _jsx("span", { className: "skp-import-desc", children: summarizeEntry(entry) }), _jsx("span", { className: "skp-import-note " + (overwriting ? "skp-import-note-over" : skipped ? "skp-import-note-skip" : "skp-import-note-add"), children: overwriting ? "将覆盖" : skipped ? "已存在，跳过" : "将新增" })] }, key))) })] })), _jsxs("label", { className: "skp-field skp-field-inline", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked) }), "\u540C\u540D\u670D\u52A1\u5668\u5DF2\u5B58\u5728\u65F6\u8986\u76D6"] }), opErrors.length > 0 && _jsx("div", { className: "skp-error", children: opErrors.join("\n") }), _jsxs("div", { className: "skp-modal-actions", children: [_jsx("button", { type: "button", className: "skp-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: busy || addable.length === 0, onClick: () => void doAdd(), children: busy ? "添加中…" : "添加 " + addable.length + " 个" })] })] }));
}
// ---------------------------------------------------------------------------
// 文本帮助函数（KEY=VALUE 行 ⇄ 记录、一行一个 ⇄ 数组）
// ---------------------------------------------------------------------------
/** 记录 → 每行 KEY=VALUE 的文本。 */
function recordToLines(record) {
    return Object.entries(record ?? {})
        .map(([k, v]) => k + "=" + v)
        .join("\n");
}
/** 文本 → 记录；非法行记入 problems 并跳过。 */
function linesToRecord(text, field, problems) {
    const out = {};
    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (line.length === 0)
            continue;
        const eq = line.indexOf("=");
        if (eq <= 0) {
            problems.push(field + "：行「" + line + "」不是 KEY=VALUE 格式");
            continue;
        }
        out[line.slice(0, eq).trim()] = line.slice(eq + 1);
    }
    return out;
}
/** 文本 → 参数数组：按行拆分、trim、跳过空行。 */
function linesToArray(text) {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
