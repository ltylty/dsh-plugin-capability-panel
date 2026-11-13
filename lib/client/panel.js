import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { McpView } from "./mcp-panel.js";
import { Modal } from "./modal.js";
import { SkpSelect } from "./select.js";
import { hasWorkspaceLabel, useAsyncList } from "./panel-common.js";
import { locateSkillRoot, rerootEntries, stripCommonTopFolder } from "../shared/skill-locate.js";
import { unzip } from "./unzip.js";
import { base64ToBytes, buildZip, downloadBytes } from "./zip.js";
/** 每个域 Tab 的展示文案。 */
const DOMAIN_LABEL = {
    skills: "技能",
    mcp: "MCP",
};
/** 面板根组件：头部（标题 + 当前工作区 + 关闭按钮 + 域 Tab）+ 当前域视图。 */
export function CapabilityPanel({ api, onClose }) {
    const [domain, setDomain] = useState("skills");
    const [workspace, setWorkspace] = useState(() => api.workspaceLabel());
    const [projects, setProjects] = useState(() => api.projects());
    // 当前工作区随会话切换而变化；数据源是 SnapshotStore，本身不具备响应性，
    // 所以经由 adapter 暴露的 subscribeWorkspace 手动同步。
    useEffect(() => {
        let alive = true;
        const update = () => {
            if (!alive)
                return;
            setWorkspace(api.workspaceLabel());
            setProjects(api.projects());
        };
        const unsub = api.subscribeWorkspace(update);
        update();
        return () => {
            alive = false;
            unsub();
        };
    }, [api]);
    const workspaceValue = workspace !== undefined && workspace !== "（无工作区）" ? workspace : "";
    const workspaceOptions = [
        ...projects.map((p) => ({ value: p.path, label: p.title ?? p.path })),
        ...(workspaceValue.length > 0 && !projects.some((p) => p.path === workspaceValue)
            ? [{ value: workspaceValue, label: workspaceValue }]
            : []),
    ];
    return (_jsxs("section", { className: "skp-panel", "aria-label": "\u5DE5\u4F5C\u533A\u6280\u80FD", children: [_jsxs("header", { className: "skp-header", children: [_jsxs("div", { className: "skp-title-row", children: [_jsxs("div", { className: "skp-title-main", children: [(workspaceOptions.length > 0 || workspaceValue.length > 0) && (_jsx(SkpSelect, { className: "skp-dd-workspace", value: workspaceValue, title: workspaceValue, ariaLabel: "\u5DE5\u4F5C\u533A", options: workspaceOptions, onChange: (value) => api.selectProject(value) })), _jsx("h2", { children: "\u5DE5\u4F5C\u533A\u6280\u80FD" })] }), _jsx("div", { className: "skp-title-tools", children: onClose !== undefined && (_jsx("button", { className: "skp-close", type: "button", "aria-label": "\u5173\u95ED\u5DE5\u4F5C\u533A\u6280\u80FD", title: "\u5173\u95ED\u9762\u677F", onClick: onClose, children: "\u2715" })) })] }), _jsx("div", { className: "skp-tabs", role: "tablist", children: ["skills", "mcp"].map((d) => (_jsx("button", { role: "tab", "aria-selected": domain === d, className: domain === d ? "skp-tab skp-tab-active" : "skp-tab", onClick: () => setDomain(d), children: DOMAIN_LABEL[d] }, d))) })] }), domain === "skills" ? _jsx(SkillsView, { api: api, workspace: workspace }) : _jsx(McpView, { api: api, workspace: workspace })] }));
}
/**
 * 侧栏底部入口：Settings 旁的一个按钮，点击切换居中的浮层面板。
 */
export function CapabilitiesFooterAction({ api, wide }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const onPointerDown = (event) => {
            if (rootRef.current !== null && event.target instanceof Node && !rootRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event) => {
            if (event.key === "Escape")
                setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);
    return (_jsxs("div", { ref: rootRef, className: "skp-foot", children: [open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "skp-backdrop", onClick: () => setOpen(false) }), _jsx("div", { className: "skp-popover", children: _jsx(CapabilityPanel, { api: api, onClose: () => setOpen(false) }) })] })), _jsxs("button", { type: "button", className: "skp-foot-btn", "aria-expanded": open, title: "\u5DE5\u4F5C\u533A\u6280\u80FD", onClick: () => setOpen((value) => !value), children: [_jsx("span", { "aria-hidden": "true", className: "skp-foot-icon", children: "\u2726" }), wide && _jsx("span", { className: "skp-foot-label", children: "\u5DE5\u4F5C\u533A\u6280\u80FD" })] })] }));
}
// ---------------------------------------------------------------------------
// Skills 域视图
// ---------------------------------------------------------------------------
/** Skills 视图：列出当前项目 `.agents/skills` 下的全部技能。 */
function SkillsView({ api, workspace }) {
    const skillsApi = api.skills;
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(undefined);
    const [installOpen, setInstallOpen] = useState(false);
    const { data: allItems, loading, error, reload } = useAsyncList(() => skillsApi.list(), [skillsApi, workspace]);
    const items = allItems ?? [];
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => q.length === 0 || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
    }, [items, query]);
    const selectedItem = items.find((item) => item.name === selected);
    const noWorkspace = !hasWorkspaceLabel(workspace);
    return (_jsxs("div", { className: "skp-domain", children: [_jsxs("div", { className: "skp-subheader", children: [_jsx("input", { className: "skp-search", type: "search", placeholder: "\u641C\u7D22\u6280\u80FD\u2026", value: query, onChange: (e) => setQuery(e.target.value) }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: noWorkspace, title: noWorkspace ? "需要可写的工作区才能安装" : undefined, onClick: () => setInstallOpen(true), children: "+ \u5B89\u88C5" })] }), loading && _jsx("div", { className: "skp-status", children: "\u52A0\u8F7D\u4E2D\u2026" }), error && _jsx("div", { className: "skp-error", children: error }), !loading && !error && (_jsxs("div", { className: "skp-body", children: [_jsxs("ul", { className: "skp-list", children: [visible.map((item) => {
                                const state = invocationState(item);
                                return (_jsx("li", { children: _jsxs("button", { className: selected === item.name ? "skp-row skp-row-active" : "skp-row", onClick: () => setSelected(item.name), children: [_jsxs("span", { className: "skp-row-name", children: [_jsx("span", { className: `skp-dot ${state === "full" ? "skp-dot-enabled" : state === "partial" ? "skp-dot-partial" : ""}`, title: state === "none"
                                                            ? "已禁用（用户与模型都不可调用）"
                                                            : state === "partial"
                                                                ? item.modelInvocable
                                                                    ? "仅用户不可调用（模型仍会触发）"
                                                                    : "仅模型不可调用（用户可 /name 调用）"
                                                                : "已启用（模型与用户均可调用）" }), item.name] }), _jsx("span", { className: "skp-row-desc", children: item.description })] }) }, item.name));
                            }), visible.length === 0 && (_jsx("li", { className: "skp-empty", children: noWorkspace ? "当前没有工作区。" : "本项目还没有技能。点「+ 安装」添加。" }))] }), _jsx("div", { className: "skp-detail", children: selectedItem ? (_jsx(SkillDetail, { summary: selectedItem, api: skillsApi, onChanged: () => reload(), onRemoved: () => {
                                setSelected(undefined);
                                reload();
                            } }, selectedItem.name)) : (_jsx("div", { className: "skp-detail-empty", children: "\u9009\u62E9\u4E00\u9879\u6280\u80FD\u67E5\u770B\u8BE6\u60C5\u3002" })) })] })), installOpen && (_jsx(InstallDialog, { api: skillsApi, hasWorkspace: !noWorkspace, onClose: () => setInstallOpen(false), onInstalled: () => {
                    setInstallOpen(false);
                    reload();
                } }))] }));
}
/** 调用状态三分：全启用 / 全禁用 / 部分禁用（仅其中一个方向被关）。 */
function invocationState(item) {
    if (item.modelInvocable && item.userInvocable)
        return "full";
    if (!item.modelInvocable && !item.userInvocable)
        return "none";
    return "partial";
}
/**
 * 详情卡片：元信息 + 路径 + 写操作。
 *
 * 启用/禁用与调用方式都写项目 skill 的 frontmatter，宿主原生链路下一步即生效。
 */
function SkillDetail({ summary, api, onChanged, onRemoved, }) {
    const [busy, setBusy] = useState(false);
    const [opError, setOpError] = useState(undefined);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [exportPathOpen, setExportPathOpen] = useState(false);
    const doSetEnabled = async (next) => {
        setBusy(true);
        setOpError(undefined);
        try {
            const result = await api.setEnabled({ ...skillRef(summary), enabled: next });
            if (!result.ok) {
                setOpError(result.errors.join("; "));
                return;
            }
            onChanged();
        }
        catch (error) {
            setOpError(String(error));
        }
        finally {
            setBusy(false);
        }
    };
    const doSetInvocation = async (modelInvocable, userInvocable) => {
        setBusy(true);
        setOpError(undefined);
        try {
            const result = await api.setInvocation({ ...skillRef(summary), modelInvocable, userInvocable });
            if (!result.ok) {
                setOpError(result.errors.join("; "));
                return;
            }
            onChanged();
        }
        catch (error) {
            setOpError(String(error));
        }
        finally {
            setBusy(false);
        }
    };
    /** 导出为浏览器下载：flat ⇒ 单个 .md；directory ⇒ 打 zip（store-only）。 */
    const doExportDownload = async () => {
        setBusy(true);
        setOpError(undefined);
        try {
            const result = await api.exportFiles(skillRef(summary));
            if (!result.ok) {
                setOpError(result.errors.join("; "));
                return;
            }
            if (result.format === "flat" && result.files.length === 1) {
                downloadBytes(`${result.name}.md`, base64ToBytes(result.files[0].content), "text/markdown");
            }
            else {
                const zip = buildZip(result.files.map((file) => ({ name: `${result.name}/${file.path}`, data: base64ToBytes(file.content) })));
                downloadBytes(`${result.name}.zip`, zip, "application/zip");
            }
        }
        catch (error) {
            setOpError(String(error));
        }
        finally {
            setBusy(false);
        }
    };
    /** 移除：两击确认。 */
    const doRemove = async () => {
        if (!confirmRemove) {
            setConfirmRemove(true);
            return;
        }
        setBusy(true);
        setOpError(undefined);
        try {
            const result = await api.remove(skillRef(summary));
            if (!result.ok) {
                setOpError(result.errors.join("; "));
                setConfirmRemove(false);
                return;
            }
            onRemoved();
        }
        catch (error) {
            setOpError(String(error));
            setConfirmRemove(false);
        }
        finally {
            setBusy(false);
        }
    };
    const state = invocationState(summary);
    return (_jsxs("div", { className: "skp-detail-card", children: [_jsx("div", { className: "skp-detail-head", children: _jsx("h3", { children: summary.name }) }), _jsxs("div", { className: "skp-detail-actions", children: [_jsx("button", { type: "button", className: `skp-btn ${state === "full" ? "skp-state-on" : state === "partial" ? "skp-state-partial" : "skp-state-off"}`, disabled: busy, title: state === "full" ? "点击禁用（用户与模型都不可调用）" : "点击启用（恢复用户与模型调用）", onClick: () => void doSetEnabled(state !== "full"), children: state === "full" ? "已启用" : state === "none" ? "已禁用" : "部分禁用" }), _jsx("button", { type: "button", className: "skp-btn", disabled: busy, onClick: doExportDownload, children: "\u5BFC\u51FA" }), _jsx("button", { type: "button", className: "skp-btn", disabled: busy, onClick: () => setExportPathOpen(true), children: "\u5BFC\u51FA\u5230\u8DEF\u5F84\u2026" }), _jsx("button", { type: "button", className: confirmRemove ? "skp-btn skp-btn-danger" : "skp-btn skp-btn-danger-ghost", disabled: busy, title: "\u5220\u9664\u672C\u9879\u76EE\u4E2D\u7684\u8FD9\u4EFD\u6280\u80FD", onClick: doRemove, children: confirmRemove ? "确认删除？" : "删除" })] }), _jsxs("dl", { className: "skp-detail-fields", children: [_jsx("dt", { children: "\u63CF\u8FF0" }), _jsx("dd", { children: summary.description }), summary.whenToUse !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u4F7F\u7528\u65F6\u673A" }), _jsx("dd", { children: summary.whenToUse })] })), _jsx("dt", { children: "\u8C03\u7528\u65B9\u5F0F" }), _jsx("dd", { children: _jsxs("div", { className: "skp-invoke-btns", children: [_jsxs("button", { type: "button", className: `skp-btn ${summary.modelInvocable ? "skp-state-on" : "skp-state-off"}`, disabled: busy, title: summary.modelInvocable
                                        ? "点击关闭模型调用（agent 不再自动触发；用户仍可 /name 调用）"
                                        : "点击开启模型调用（agent 可自动触发）", onClick: () => void doSetInvocation(!summary.modelInvocable, summary.userInvocable), children: ["\u6A21\u578B\u8C03\u7528 ", summary.modelInvocable ? "✓" : "✗"] }), _jsxs("button", { type: "button", className: `skp-btn ${summary.userInvocable ? "skp-state-on" : "skp-state-off"}`, disabled: busy, title: summary.userInvocable
                                        ? "点击关闭用户调用（输入框 /name 不再注入此技能；模型仍可自动触发）"
                                        : "点击开启用户调用（输入框 /name 可注入此技能）", onClick: () => void doSetInvocation(summary.modelInvocable, !summary.userInvocable), children: ["\u7528\u6237\u8C03\u7528 ", summary.userInvocable ? "✓" : "✗"] })] }) }), _jsx("dt", { children: "\u6765\u6E90" }), _jsx("dd", { children: summary.source }), summary.path !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u8DEF\u5F84" }), _jsx("dd", { className: "skp-path", children: summary.path })] }))] }), opError !== undefined && _jsx("div", { className: "skp-error", children: opError }), exportPathOpen && _jsx(ExportToPathDialog, { summary: summary, api: api, onClose: () => setExportPathOpen(false) })] }));
}
/** 组装一行的寻址入参：项目技能只按名称寻址。 */
function skillRef(summary) {
    return { name: summary.name };
}
// ---------------------------------------------------------------------------
// 模态框
// ---------------------------------------------------------------------------
/** 安装对话框的来源模式与 Tab 文案。 */
const INSTALL_MODE = { upload: "上传", library: "预置", url: "URL" };
/**
 * 安装对话框：三种来源——浏览器上传（单个 .md / 整个 skill 目录 / .zip
 * 压缩包）、宿主磁盘路径、URL 下载。目标固定为项目 `.agents/skills`。
 */
function InstallDialog({ api, hasWorkspace, onClose, onInstalled, }) {
    const [mode, setMode] = useState("upload");
    const [overwrite, setOverwrite] = useState(false);
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState([]);
    const [library, setLibrary] = useState(undefined);
    const [libraryError, setLibraryError] = useState(undefined);
    const [entry, setEntry] = useState("");
    const [url, setUrl] = useState("");
    const [picked, setPicked] = useState(undefined);
    const fileInputRef = useRef(null);
    const dirInputRef = useRef(null);
    const zipInputRef = useRef(null);
    // 切到「预置」时拉取可安装条目；首次进入自动选中第一条。
    useEffect(() => {
        if (mode !== "library")
            return;
        let alive = true;
        setLibraryError(undefined);
        api
            .sources()
            .then((view) => {
            if (!alive)
                return;
            setLibrary(view);
            setEntry(view.skills[0]?.entry ?? "");
        })
            .catch((error) => {
            if (alive)
                setLibraryError(String(error));
        });
        return () => {
            alive = false;
        };
    }, [mode, api]);
    /** 选中单个 .md 文件（flat 安装）。 */
    const onPickFile = async (input) => {
        const file = input.files?.[0];
        input.value = "";
        if (file === undefined)
            return;
        setErrors([]);
        try {
            const content = await fileToBase64(file);
            setPicked({ label: file.name, files: [{ path: file.name, content }] });
        }
        catch (error) {
            setErrors([String(error)]);
        }
    };
    /** 选中整个目录（directory 安装）：剥掉首段得到 skill 内部相对路径。 */
    const onPickDirectory = async (input) => {
        const files = Array.from(input.files ?? []);
        input.value = "";
        if (files.length === 0)
            return;
        setErrors([]);
        try {
            const payload = [];
            let folder = "";
            for (const file of files) {
                const relative = file.webkitRelativePath || file.name;
                const segments = relative.split("/");
                folder = segments[0] ?? folder;
                const inner = segments.slice(1).join("/");
                if (inner.length === 0)
                    continue;
                payload.push({ path: inner, content: await fileToBase64(file) });
            }
            if (!payload.some((entry) => entry.path === "SKILL.md")) {
                setPicked(undefined);
                setErrors([`文件夹 "${folder}" 的根目录下没有 SKILL.md`]);
                return;
            }
            setPicked({ label: `${folder}/（${payload.length} 个文件）`, files: payload });
        }
        catch (error) {
            setErrors([String(error)]);
        }
    };
    /** 选中 .zip 压缩包：浏览器端解压 → 剥公共顶层目录 → 定位 skill 根。 */
    const onPickArchive = async (input) => {
        const file = input.files?.[0];
        input.value = "";
        if (file === undefined)
            return;
        setErrors([]);
        try {
            const entries = await unzip(new Uint8Array(await file.arrayBuffer()));
            const stripped = stripCommonTopFolder(entries.map((entry) => entry.path));
            const normalized = entries.map((entry, i) => ({ ...entry, path: stripped[i] }));
            const located = locateSkillRoot(normalized.map((entry) => entry.path));
            if (!located.ok) {
                setPicked(undefined);
                setErrors([located.error]);
                return;
            }
            const payload = rerootEntries(normalized, located.root).map((entry) => ({ path: entry.path, content: bytesToBase64(entry.data) }));
            setPicked({ label: `${file.name}（${payload.length} 个文件）`, files: payload });
        }
        catch (error) {
            setPicked(undefined);
            setErrors([String(error)]);
        }
    };
    const doInstall = async () => {
        setBusy(true);
        setErrors([]);
        try {
            const result = mode === "upload"
                ? await api.installUpload({ files: picked?.files ?? [], overwrite })
                : mode === "library"
                    ? await api.installFromLibrary({ entry, overwrite })
                    : await api.installFromUrl({ url: url.trim(), overwrite });
            if (!result.ok) {
                setErrors(result.errors);
                return;
            }
            onInstalled();
        }
        catch (error) {
            setErrors([String(error)]);
        }
        finally {
            setBusy(false);
        }
    };
    const canSubmit = !busy && hasWorkspace && (mode === "upload" ? picked !== undefined : mode === "library" ? entry.length > 0 : url.trim().length > 0);
    return (_jsx(Modal, { title: "\u5B89\u88C5\u6280\u80FD", onClose: onClose, children: _jsxs("div", { className: "skp-form", children: [_jsx("div", { className: "skp-tabs", role: "tablist", children: Object.keys(INSTALL_MODE).map((m) => (_jsx("button", { role: "tab", "aria-selected": mode === m, className: mode === m ? "skp-tab skp-tab-active" : "skp-tab", onClick: () => setMode(m), children: INSTALL_MODE[m] }, m))) }), mode === "upload" && (_jsxs("div", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u6765\u6E90" }), _jsxs("div", { className: "skp-subheader-row", children: [_jsx("button", { type: "button", className: "skp-btn", onClick: () => fileInputRef.current?.click(), children: "\u9009\u62E9 .md \u6587\u4EF6" }), _jsx("button", { type: "button", className: "skp-btn", onClick: () => dirInputRef.current?.click(), children: "\u9009\u62E9\u6587\u4EF6\u5939" }), _jsx("button", { type: "button", className: "skp-btn", onClick: () => zipInputRef.current?.click(), children: "\u9009\u62E9 .zip" })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".md,text/markdown", hidden: true, onChange: (e) => void onPickFile(e.currentTarget) }), _jsx("input", { ref: (el) => {
                                dirInputRef.current = el;
                                el?.setAttribute("webkitdirectory", "");
                            }, type: "file", multiple: true, hidden: true, onChange: (e) => void onPickDirectory(e.currentTarget) }), _jsx("input", { ref: zipInputRef, type: "file", accept: ".zip,application/zip", hidden: true, onChange: (e) => void onPickArchive(e.currentTarget) }), _jsx("span", { className: "skp-note", children: picked !== undefined ? `已选择：${picked.label}` : "选择单个 <名称>.md 文件、包含 SKILL.md 的文件夹，或 .zip 压缩包。" })] })), mode === "library" && (_jsxs("div", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u9884\u7F6E" }), libraryError !== undefined && _jsx("div", { className: "skp-error", children: libraryError }), library !== undefined && library.dir === undefined && (_jsx("span", { className: "skp-note", children: "\u672A\u914D\u7F6E\u9884\u7F6E\u6280\u80FD\u76EE\u5F55\u3002\u8BF7\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\u8BBE\u7F6E skillLibrary\uFF0C\u6216\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF DSH_SKILL_LIBRARY\u3002" })), library !== undefined && library.dir !== undefined && library.skills.length === 0 && (_jsxs("span", { className: "skp-note", children: ["\u9884\u7F6E\u6280\u80FD\u4E3A\u7A7A\uFF1A", library.dir] })), library !== undefined && library.skills.length > 0 && (_jsxs(_Fragment, { children: [_jsx(SkpSelect, { value: entry, ariaLabel: "\u9884\u7F6E\u6280\u80FD\u6761\u76EE", options: library.skills.map((skill) => ({ value: skill.entry, label: skill.name, hint: skill.description })), onChange: setEntry }), _jsxs("span", { className: "skp-note", children: ["\u76EE\u5F55\uFF1A", library.dir] })] })), library !== undefined && library.errors.length > 0 && _jsx("div", { className: "skp-error", children: library.errors.join("\n") })] })), mode === "url" && (_jsxs("div", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u4E0B\u8F7D URL" }), _jsx("input", { className: "skp-input", type: "url", placeholder: "https://github.com/<owner>/<repo>[/tree/<branch>/<dir>] \u6216 .zip / .md \u94FE\u63A5", value: url, onChange: (e) => setUrl(e.target.value) }), _jsx("span", { className: "skp-note", children: "\u652F\u6301 GitHub \u4ED3\u5E93\uFF08\u6574\u5E93\u6216 /tree/\u2026 \u5B50\u76EE\u5F55\uFF09\u3001.zip \u94FE\u63A5\u6216 raw .md \u94FE\u63A5\u3002" })] })), _jsxs("label", { className: "skp-field skp-field-inline", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked) }), "\u540C\u540D\u6280\u80FD\u5DF2\u5B58\u5728\u65F6\u8986\u76D6"] }), !hasWorkspace && _jsx("div", { className: "skp-error", children: "\u9700\u8981\u53EF\u5199\u7684\u5DE5\u4F5C\u533A\u624D\u80FD\u5B89\u88C5\u3002" }), errors.length > 0 && _jsx("div", { className: "skp-error", children: errors.join("\n") }), _jsxs("div", { className: "skp-modal-actions", children: [_jsx("button", { type: "button", className: "skp-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: !canSubmit, onClick: doInstall, children: busy ? "安装中…" : "安装" })] })] }) }));
}
/** 导出到宿主路径的小对话框：目标目录 + 覆盖开关。 */
function ExportToPathDialog({ summary, api, onClose }) {
    const [destDir, setDestDir] = useState("");
    const [overwrite, setOverwrite] = useState(false);
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState([]);
    const doExport = async () => {
        setBusy(true);
        setErrors([]);
        try {
            const result = await api.exportToPath({ ...skillRef(summary), destDir: destDir.trim(), overwrite });
            if (!result.ok) {
                setErrors(result.errors);
                return;
            }
            onClose();
        }
        catch (error) {
            setErrors([String(error)]);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Modal, { title: `将「${summary.name}」导出到路径`, onClose: onClose, children: _jsxs("div", { className: "skp-form", children: [_jsxs("div", { className: "skp-field", children: [_jsx("span", { className: "skp-field-label", children: "\u5BBF\u4E3B\u4E0A\u7684\u76EE\u6807\u76EE\u5F55" }), _jsx("input", { className: "skp-input", type: "text", placeholder: "/path/to/\u76EE\u6807\u76EE\u5F55", value: destDir, onChange: (e) => setDestDir(e.target.value) })] }), _jsxs("label", { className: "skp-field skp-field-inline", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked) }), "\u76EE\u6807\u5DF2\u5B58\u5728\u65F6\u8986\u76D6"] }), errors.length > 0 && _jsx("div", { className: "skp-error", children: errors.join("\n") }), _jsxs("div", { className: "skp-modal-actions", children: [_jsx("button", { type: "button", className: "skp-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "skp-btn skp-btn-primary", disabled: busy || destDir.trim().length === 0, onClick: doExport, children: busy ? "导出中…" : "导出" })] })] }) }));
}
/** File → base64（readAsDataURL 剥掉 `data:…;base64,` 前缀）。 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
        reader.onload = () => {
            const dataUrl = String(reader.result);
            resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
        };
        reader.readAsDataURL(file);
    });
}
/** 字节 → base64（分块避免 fromCharCode 参数过长）。 */
function bytesToBase64(bytes) {
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}
