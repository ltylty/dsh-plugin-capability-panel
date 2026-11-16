/**
 * Capability Panel 的 React 视图（侧栏底部按钮弹出的浮层面板）。
 *
 * 根容器按能力域分 Tab：
 *   - Skills：当前工作区项目级技能（`<项目根>/.agents/skills`）；
 *   - MCP：当前工作区项目级 `.mcp.json` 的 server 管理，带实时挂载状态
 *     （见 `mcp-panel.tsx`）。
 *
 * 工作区在左侧平铺为导航列表（不用下拉），默认高亮当前会话的工作区；
 * 点击任一行即把面板切换到该工作区，技能 / MCP 两个域共用同一选择。
 *
 * @module dsh-workspace-skill-mcp/client/panel
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CapabilityPanelApi,
  ClientSkillSummary,
  SkillFilePayload,
  SkillLibraryView,
  SkillRef,
  SkillsApi,
  WorkspaceOption,
} from "./api.js";
import { McpView } from "./mcp-panel.js";
import { Modal } from "./modal.js";
import { hasWorkspaceLabel, useAsyncList } from "./panel-common.js";
import { locateSkillRoot, rerootEntries, stripCommonTopFolder } from "../shared/skill-locate.js";
import { unzip } from "./unzip.js";
import { base64ToBytes, buildZip, downloadBytes } from "./zip.js";

/** 域 Tab 的取值。 */
type DomainTab = "skills" | "mcp";

/** 每个域 Tab 的展示文案。 */
const DOMAIN_LABEL: Record<DomainTab, string> = {
  skills: "技能",
  mcp: "MCP",
};

/** 面板根组件：头部（标题 + 当前工作区 + 关闭按钮 + 域 Tab）+ 当前域视图。 */
export function CapabilityPanel({ api }: { api: CapabilityPanelApi }) {
  const [domain, setDomain] = useState<DomainTab>("skills");
  const [workspace, setWorkspace] = useState<string | undefined>(() => api.workspaceLabel());
  const [projects, setProjects] = useState(() => api.projects());

  // 当前工作区随会话切换而变化；数据源是 SnapshotStore，本身不具备响应性，
  // 所以经由 adapter 暴露的 subscribeWorkspace 手动同步。
  useEffect(() => {
    let alive = true;
    const update = () => {
      if (!alive) return;
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
  const railItems: WorkspaceOption[] = [
    ...projects,
    ...(workspaceValue.length > 0 && !projects.some((p) => p.path === workspaceValue)
      ? [{ id: workspaceValue, path: workspaceValue }]
      : []),
  ];

  return (
    <section className="skp-panel" aria-label="工作区技能">
      <header className="skp-header">
        <div className="skp-title-row">
          <div className="skp-title-main">
            <h2>工作区技能</h2>
          </div>
        </div>
        <div className="skp-tabs" role="tablist">
          {(["skills", "mcp"] as DomainTab[]).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={domain === d}
              className={domain === d ? "skp-tab skp-tab-active" : "skp-tab"}
              onClick={() => setDomain(d)}
            >
              {DOMAIN_LABEL[d]}
            </button>
          ))}
        </div>
      </header>

      <div className="skp-main">
        <WorkspaceRail items={railItems} value={workspaceValue} onSelect={(path) => api.selectProject(path)} />
        <div className="skp-content">
          {domain === "skills" ? <SkillsView api={api} workspace={workspace} /> : <McpView api={api} workspace={workspace} />}
        </div>
      </div>
    </section>
  );
}

/**
 * 左侧工作区导航：把全部工作区平铺成列表（不再使用下拉）。
 *
 * 选中态由 `value`（当前生效的工作区路径）决定；点击即切换项目。
 */
function WorkspaceRail({
  items,
  value,
  onSelect,
}: {
  items: WorkspaceOption[];
  value: string;
  onSelect(path: string): void;
}) {
  return (
    <nav className="skp-wsrail" aria-label="工作区">
      <div className="skp-wsrail-head">
        <span>工作区</span>
        <span className="skp-wsrail-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="skp-wsrail-empty">（无工作区）</div>
      ) : (
        items.map((item) => {
          const active = item.path === value;
          const hasTitle = typeof item.title === "string" && item.title.length > 0;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "skp-ws-row skp-ws-row-active" : "skp-ws-row"}
              aria-current={active ? "true" : undefined}
              title={item.path}
              onClick={() => onSelect(item.path)}
            >
              <span className="skp-ws-name">{item.title ?? item.path}</span>
              {hasTitle && <span className="skp-ws-path">{item.path}</span>}
            </button>
          );
        })
      )}
    </nav>
  );
}

/**
 * 主面板整页：侧栏「工作区技能」导航行选中后渲染在主内容区。
 */
export function WorkspaceSkillsPage({ api }: { api: CapabilityPanelApi }) {
  return (
    <div className="skp-page">
      <CapabilityPanel api={api} />
    </div>
  );
}

/**
 * 侧栏导航行图标（由宿主传入尺寸；currentColor 跟随选中/悬停色）。
 */
export function WorkspaceSkillsIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z" />
      <path d="M18.6 15.6l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Skills 域视图
// ---------------------------------------------------------------------------

/** Skills 视图：列出当前项目 `.agents/skills` 下的全部技能。 */
function SkillsView({ api, workspace }: { api: CapabilityPanelApi; workspace?: string }) {
  const skillsApi = api.skills;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [installOpen, setInstallOpen] = useState(false);

  const { data: allItems, loading, error, reload } = useAsyncList(() => skillsApi.list(), [skillsApi, workspace]);
  const items = allItems ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) => q.length === 0 || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  const selectedItem = items.find((item) => item.name === selected);
  const noWorkspace = !hasWorkspaceLabel(workspace);

  return (
    <div className="skp-domain">
      <div className="skp-subheader">
        <input
          className="skp-search"
          type="search"
          placeholder="搜索技能…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="skp-btn skp-btn-primary"
          disabled={noWorkspace}
          title={noWorkspace ? "需要可写的工作区才能安装" : undefined}
          onClick={() => setInstallOpen(true)}
        >
          + 安装
        </button>
      </div>

      {loading && <div className="skp-status">加载中…</div>}
      {error && <div className="skp-error">{error}</div>}
      {!loading && !error && (
        <div className="skp-body">
          <ul className="skp-list">
            {visible.map((item) => {
              const state = invocationState(item);
              return (
                <li key={item.name}>
                  <button
                    className={selected === item.name ? "skp-row skp-row-active" : "skp-row"}
                    onClick={() => setSelected(item.name)}
                  >
                    <span className="skp-row-name">
                      <span
                        className={`skp-dot ${state === "full" ? "skp-dot-enabled" : state === "partial" ? "skp-dot-partial" : ""}`}
                        title={
                          state === "none"
                            ? "已禁用（用户与模型都不可调用）"
                            : state === "partial"
                              ? item.modelInvocable
                                ? "仅用户不可调用（模型仍会触发）"
                                : "仅模型不可调用（用户可 /name 调用）"
                              : "已启用（模型与用户均可调用）"
                        }
                      />
                      {item.name}
                    </span>
                    <span className="skp-row-desc">{item.description}</span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="skp-empty">{noWorkspace ? "当前没有工作区。" : "本项目还没有技能。点「+ 安装」添加。"}</li>
            )}
          </ul>
          <div className="skp-detail">
            {selectedItem ? (
              <SkillDetail
                key={selectedItem.name}
                summary={selectedItem}
                api={skillsApi}
                onChanged={() => reload()}
                onRemoved={() => {
                  setSelected(undefined);
                  reload();
                }}
              />
            ) : (
              <div className="skp-detail-empty">选择一项技能查看详情。</div>
            )}
          </div>
        </div>
      )}

      {installOpen && (
        <InstallDialog
          api={skillsApi}
          hasWorkspace={!noWorkspace}
          onClose={() => setInstallOpen(false)}
          onInstalled={() => {
            setInstallOpen(false);
            reload();
          }}
          onReload={reload}
        />
      )}
    </div>
  );
}

/** 调用状态三分：全启用 / 全禁用 / 部分禁用（仅其中一个方向被关）。 */
function invocationState(item: Pick<ClientSkillSummary, "modelInvocable" | "userInvocable">): "full" | "none" | "partial" {
  if (item.modelInvocable && item.userInvocable) return "full";
  if (!item.modelInvocable && !item.userInvocable) return "none";
  return "partial";
}

/**
 * 详情卡片：元信息 + 路径 + 写操作。
 *
 * 启用/禁用与调用方式都写项目 skill 的 frontmatter，宿主原生链路下一步即生效。
 */
function SkillDetail({
  summary,
  api,
  onChanged,
  onRemoved,
}: {
  summary: ClientSkillSummary;
  api: SkillsApi;
  /** 条目内容已变化（如启用/禁用）：保留选中，重拉列表即可。 */
  onChanged: () => void;
  /** 条目已删除：应清空选中。 */
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [exportPathOpen, setExportPathOpen] = useState(false);

  const doSetEnabled = async (next: boolean) => {
    setBusy(true);
    setOpError(undefined);
    try {
      const result = await api.setEnabled({ ...skillRef(summary), enabled: next });
      if (!result.ok) {
        setOpError(result.errors.join("; "));
        return;
      }
      onChanged();
    } catch (error) {
      setOpError(String(error));
    } finally {
      setBusy(false);
    }
  };

  const doSetInvocation = async (modelInvocable: boolean, userInvocable: boolean) => {
    setBusy(true);
    setOpError(undefined);
    try {
      const result = await api.setInvocation({ ...skillRef(summary), modelInvocable, userInvocable });
      if (!result.ok) {
        setOpError(result.errors.join("; "));
        return;
      }
      onChanged();
    } catch (error) {
      setOpError(String(error));
    } finally {
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
      } else {
        const zip = buildZip(result.files.map((file) => ({ name: `${result.name}/${file.path}`, data: base64ToBytes(file.content) })));
        downloadBytes(`${result.name}.zip`, zip, "application/zip");
      }
    } catch (error) {
      setOpError(String(error));
    } finally {
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
    } catch (error) {
      setOpError(String(error));
      setConfirmRemove(false);
    } finally {
      setBusy(false);
    }
  };

  const state = invocationState(summary);

  return (
    <div className="skp-detail-card">
      <div className="skp-detail-head">
        <h3>{summary.name}</h3>
      </div>
      <div className="skp-detail-actions">
        <button
          type="button"
          className={`skp-btn ${state === "full" ? "skp-state-on" : state === "partial" ? "skp-state-partial" : "skp-state-off"}`}
          disabled={busy}
          title={state === "full" ? "点击禁用（用户与模型都不可调用）" : "点击启用（恢复用户与模型调用）"}
          onClick={() => void doSetEnabled(state !== "full")}
        >
          {state === "full" ? "已启用" : state === "none" ? "已禁用" : "部分禁用"}
        </button>
        <button type="button" className="skp-btn" disabled={busy} onClick={doExportDownload}>
          导出
        </button>
        <button type="button" className="skp-btn" disabled={busy} onClick={() => setExportPathOpen(true)}>
          导出到路径…
        </button>
        <button
          type="button"
          className={confirmRemove ? "skp-btn skp-btn-danger" : "skp-btn skp-btn-danger-ghost"}
          disabled={busy}
          title="删除本项目中的这份技能"
          onClick={doRemove}
        >
          {confirmRemove ? "确认删除？" : "删除"}
        </button>
      </div>
      <dl className="skp-detail-fields">
        <dt>描述</dt>
        <dd>{summary.description}</dd>
        {summary.whenToUse !== undefined && (
          <>
            <dt>使用时机</dt>
            <dd>{summary.whenToUse}</dd>
          </>
        )}
        <dt>调用方式</dt>
        <dd>
          <div className="skp-invoke-btns">
            <button
              type="button"
              className={`skp-btn ${summary.modelInvocable ? "skp-state-on" : "skp-state-off"}`}
              disabled={busy}
              title={
                summary.modelInvocable
                  ? "点击关闭模型调用（agent 不再自动触发；用户仍可 /name 调用）"
                  : "点击开启模型调用（agent 可自动触发）"
              }
              onClick={() => void doSetInvocation(!summary.modelInvocable, summary.userInvocable)}
            >
              模型调用 {summary.modelInvocable ? "✓" : "✗"}
            </button>
            <button
              type="button"
              className={`skp-btn ${summary.userInvocable ? "skp-state-on" : "skp-state-off"}`}
              disabled={busy}
              title={
                summary.userInvocable
                  ? "点击关闭用户调用（输入框 /name 不再注入此技能；模型仍可自动触发）"
                  : "点击开启用户调用（输入框 /name 可注入此技能）"
              }
              onClick={() => void doSetInvocation(summary.modelInvocable, !summary.userInvocable)}
            >
              用户调用 {summary.userInvocable ? "✓" : "✗"}
            </button>
          </div>
        </dd>
        <dt>来源</dt>
        <dd>{summary.source}</dd>
        {summary.path !== undefined && (
          <>
            <dt>路径</dt>
            <dd className="skp-path">{summary.path}</dd>
          </>
        )}
      </dl>
      {opError !== undefined && <div className="skp-error">{opError}</div>}
      {exportPathOpen && <ExportToPathDialog summary={summary} api={api} onClose={() => setExportPathOpen(false)} />}
    </div>
  );
}

/** 组装一行的寻址入参：项目技能只按名称寻址。 */
function skillRef(summary: ClientSkillSummary): SkillRef {
  return { name: summary.name };
}

// ---------------------------------------------------------------------------
// 模态框
// ---------------------------------------------------------------------------

/** 安装对话框的来源模式与 Tab 文案。 */
const INSTALL_MODE = { upload: "上传", library: "预置", url: "URL" } as const;
type InstallMode = keyof typeof INSTALL_MODE;

/**
 * 安装对话框：三种来源——浏览器上传（单个 .md / 整个 skill 目录 / .zip
 * 压缩包）、宿主磁盘路径、URL 下载。目标固定为项目 `.agents/skills`。
 */
function InstallDialog({
  api,
  hasWorkspace,
  onClose,
  onInstalled,
  onReload,
}: {
  api: SkillsApi;
  hasWorkspace: boolean;
  onClose: () => void;
  onInstalled: () => void;
  /** 仅刷新列表、不关闭对话框（批量安装部分成功时使用）。 */
  onReload: () => void;
}) {
  const [mode, setMode] = useState<InstallMode>("upload");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [library, setLibrary] = useState<SkillLibraryView | undefined>(undefined);
  const [libraryError, setLibraryError] = useState<string | undefined>(undefined);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<{ label: string; files: SkillFilePayload[] } | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  // 切到「预置」时拉取可安装条目（默认不选中，用户可多选或全选）。
  useEffect(() => {
    if (mode !== "library") return;
    let alive = true;
    setLibraryError(undefined);
    api
      .sources()
      .then((view) => {
        if (!alive) return;
        setLibrary(view);
        setSelectedEntries([]);
      })
      .catch((error) => {
        if (alive) setLibraryError(String(error));
      });
    return () => {
      alive = false;
    };
  }, [mode, api]);

  /** 选中单个 .md 文件（flat 安装）。 */
  const onPickFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) return;
    setErrors([]);
    try {
      const content = await fileToBase64(file);
      setPicked({ label: file.name, files: [{ path: file.name, content }] });
    } catch (error) {
      setErrors([String(error)]);
    }
  };

  /** 选中整个目录（directory 安装）：剥掉首段得到 skill 内部相对路径。 */
  const onPickDirectory = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;
    setErrors([]);
    try {
      const payload: SkillFilePayload[] = [];
      let folder = "";
      for (const file of files) {
        const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const segments = relative.split("/");
        folder = segments[0] ?? folder;
        const inner = segments.slice(1).join("/");
        if (inner.length === 0) continue;
        payload.push({ path: inner, content: await fileToBase64(file) });
      }
      if (!payload.some((entry) => entry.path === "SKILL.md")) {
        setPicked(undefined);
        setErrors([`文件夹 "${folder}" 的根目录下没有 SKILL.md`]);
        return;
      }
      setPicked({ label: `${folder}/（${payload.length} 个文件）`, files: payload });
    } catch (error) {
      setErrors([String(error)]);
    }
  };

  /** 选中 .zip 压缩包：浏览器端解压 → 剥公共顶层目录 → 定位 skill 根。 */
  const onPickArchive = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) return;
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
    } catch (error) {
      setPicked(undefined);
      setErrors([String(error)]);
    }
  };

  const doInstall = async () => {
    setBusy(true);
    setErrors([]);
    try {
      if (mode === "library") {
        if (selectedEntries.length === 0) {
          setErrors(["请选择至少一个预置技能"]);
          return;
        }
        const failures: string[] = [];
        let installed = 0;
        for (const entry of selectedEntries) {
          const result = await api.installFromLibrary({ entry, overwrite });
          if (result.ok) installed += 1;
          else failures.push(entry + "：" + result.errors.join("; "));
        }
        if (failures.length > 0) {
          onReload();
          setErrors(["已安装 " + installed + " 个，失败 " + failures.length + " 个：", ...failures]);
          return;
        }
        onInstalled();
        return;
      }
      const result =
        mode === "upload"
          ? await api.installUpload({ files: picked?.files ?? [], overwrite })
          : await api.installFromUrl({ url: url.trim(), overwrite });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onInstalled();
    } catch (error) {
      setErrors([String(error)]);
    } finally {
      setBusy(false);
    }
  };

  const librarySkills = library?.skills ?? [];
  const allSelected = librarySkills.length > 0 && selectedEntries.length === librarySkills.length;
  const someSelected = selectedEntries.length > 0 && !allSelected;
  const toggleEntry = (entry: string) => {
    setSelectedEntries((prev) => (prev.includes(entry) ? prev.filter((item) => item !== entry) : [...prev, entry]));
  };

  const canSubmit =
    !busy &&
    hasWorkspace &&
    (mode === "upload" ? picked !== undefined : mode === "library" ? selectedEntries.length > 0 : url.trim().length > 0);

  return (
    <Modal title="安装技能" onClose={onClose}>
      <div className="skp-form">
        <div className="skp-tabs" role="tablist">
          {(Object.keys(INSTALL_MODE) as InstallMode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "skp-tab skp-tab-active" : "skp-tab"} onClick={() => setMode(m)}>
              {INSTALL_MODE[m]}
            </button>
          ))}
        </div>

        {mode === "upload" && (
          <div className="skp-field">
            <span className="skp-field-label">来源</span>
            <div className="skp-subheader-row">
              <button type="button" className="skp-btn" onClick={() => fileInputRef.current?.click()}>
                选择 .md 文件
              </button>
              <button type="button" className="skp-btn" onClick={() => dirInputRef.current?.click()}>
                选择文件夹
              </button>
              <button type="button" className="skp-btn" onClick={() => zipInputRef.current?.click()}>
                选择 .zip
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".md,text/markdown" hidden onChange={(e) => void onPickFile(e.currentTarget)} />
            <input
              ref={(el) => {
                dirInputRef.current = el;
                el?.setAttribute("webkitdirectory", "");
              }}
              type="file"
              multiple
              hidden
              onChange={(e) => void onPickDirectory(e.currentTarget)}
            />
            <input ref={zipInputRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => void onPickArchive(e.currentTarget)} />
            <span className="skp-note">
              {picked !== undefined ? `已选择：${picked.label}` : "选择单个 <名称>.md 文件、包含 SKILL.md 的文件夹，或 .zip 压缩包。"}
            </span>
          </div>
        )}

        {mode === "library" && (
          <div className="skp-field">
            <span className="skp-field-label">预置</span>
            {libraryError !== undefined && <div className="skp-error">{libraryError}</div>}
            {library !== undefined && library.dir === undefined && (
              <span className="skp-note">
                未配置预置技能目录。请在插件配置中设置 skillLibrary，或设置环境变量 DSH_SKILL_LIBRARY。
              </span>
            )}
            {library !== undefined && library.dir !== undefined && library.skills.length === 0 && (
              <span className="skp-note">预置技能为空：{library.dir}</span>
            )}
            {library !== undefined && library.skills.length > 0 && (
              <>
                <label className="skp-pick-all">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el !== null) el.indeterminate = someSelected;
                    }}
                    onChange={() => setSelectedEntries(allSelected ? [] : library.skills.map((skill) => skill.entry))}
                  />
                  <span>全选（{selectedEntries.length}/{library.skills.length}）</span>
                </label>
                <ul className="skp-pick-list">
                  {library.skills.map((skill) => (
                    <li key={skill.entry}>
                      <label className="skp-pick-row">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(skill.entry)}
                          onChange={() => toggleEntry(skill.entry)}
                        />
                        <span className="skp-pick-name">{skill.name}</span>
                        <span className="skp-pick-desc" title={skill.description}>
                          {skill.description}
                        </span>
                        <span className="skp-tag skp-tag-flat">{skill.format === "directory" ? "目录" : "单文件"}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <span className="skp-note">目录：{library.dir}</span>
              </>
            )}
            {library !== undefined && library.errors.length > 0 && <div className="skp-error">{library.errors.join("\n")}</div>}
          </div>
        )}

        {mode === "url" && (
          <div className="skp-field">
            <span className="skp-field-label">下载 URL</span>
            <input
              className="skp-input"
              type="url"
              placeholder="https://github.com/<owner>/<repo>[/tree/<branch>/<dir>] 或 .zip / .md 链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <span className="skp-note">支持 GitHub 仓库（整库或 /tree/… 子目录）、.zip 链接或 raw .md 链接。</span>
          </div>
        )}

        <label className="skp-field skp-field-inline">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          同名技能已存在时覆盖
        </label>

        {!hasWorkspace && <div className="skp-error">需要可写的工作区才能安装。</div>}
        {errors.length > 0 && <div className="skp-error">{errors.join("\n")}</div>}

        <div className="skp-modal-actions">
          <button type="button" className="skp-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="skp-btn skp-btn-primary" disabled={!canSubmit} onClick={doInstall}>
            {busy ? "安装中…" : mode === "library" && selectedEntries.length > 0 ? "安装 " + selectedEntries.length + " 个" : "安装"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** 导出到宿主路径的小对话框：目标目录 + 覆盖开关。 */
function ExportToPathDialog({ summary, api, onClose }: { summary: ClientSkillSummary; api: SkillsApi; onClose: () => void }) {
  const [destDir, setDestDir] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
    } catch (error) {
      setErrors([String(error)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`将「${summary.name}」导出到路径`} onClose={onClose}>
      <div className="skp-form">
        <div className="skp-field">
          <span className="skp-field-label">宿主上的目标目录</span>
          <input
            className="skp-input"
            type="text"
            placeholder="/path/to/目标目录"
            value={destDir}
            onChange={(e) => setDestDir(e.target.value)}
          />
        </div>
        <label className="skp-field skp-field-inline">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          目标已存在时覆盖
        </label>
        {errors.length > 0 && <div className="skp-error">{errors.join("\n")}</div>}
        <div className="skp-modal-actions">
          <button type="button" className="skp-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="skp-btn skp-btn-primary" disabled={busy || destDir.trim().length === 0} onClick={doExport}>
            {busy ? "导出中…" : "导出"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** File → base64（readAsDataURL 剥掉 `data:…;base64,` 前缀）。 */
function fileToBase64(file: File): Promise<string> {
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
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
