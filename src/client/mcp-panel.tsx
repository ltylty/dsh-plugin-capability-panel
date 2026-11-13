/**
 * Capability Panel 的 MCP 域视图。
 *
 * 只管理项目级 <项目根>/.mcp.json：列出真实条目，叠加每个 session 的实时
 * 挂载状态，按搜索词过滤。写入直接落配置文件，宿主在每次写操作后重挂受
 * 影响 session 的连接。
 *
 * @module @chengdb/capability-panel/client/mcp-panel
 */

import { useMemo, useState } from "react";
import type { CapabilityPanelApi, ClientMcpServer, McpApi, OpResult } from "./api.js";
import { summarizeEntry, transportOf, validateEntry } from "../mcp/entry-util.js";
import type { McpServerEntry } from "../mcp/types.js";
import { Modal } from "./modal.js";
import { SkpSelect } from "./select.js";
import { hasWorkspaceLabel, useAsyncList } from "./panel-common.js";
import { aggregateMounts, MOUNT_LABEL, type MountInfo } from "./mcp-common.js";
import { MCP_PRESETS } from "./mcp-presets.js";

/** 行圆点的 tooltip：以启用/禁用为主语义，挂载状态作为补充说明。 */
function rowDotTitle(server: ClientMcpServer, mount: MountInfo | undefined): string {
  if (!server.enabled) return "已禁用（不挂载）";
  if (mount === undefined) return "已启用 · 未挂载到当前会话";
  return mount.error !== undefined ? "已启用 · " + MOUNT_LABEL[mount.state] + "：" + mount.error : "已启用 · " + MOUNT_LABEL[mount.state];
}

/** MCP 视图主组件：状态管理 + 拉取/重拉 + 列表 + 详情/表单。 */
export function McpView({ api, workspace }: { api: CapabilityPanelApi; workspace?: string }) {
  const mcpApi = api.mcp;
  const [opError, setOpError] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [editServer, setEditServer] = useState<ClientMcpServer | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | undefined>(undefined);

  const { data, loading, error, reload } = useAsyncList(
    async () => {
      const [list, statuses] = await Promise.all([mcpApi.list(), mcpApi.status().catch(() => [])]);
      return { servers: list.servers, listErrors: list.errors, mounts: aggregateMounts(statuses) };
    },
    [mcpApi, workspace],
  );
  const servers = data?.servers ?? [];
  const listErrors = data?.listErrors ?? [];
  const mounts = data?.mounts ?? {};

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servers.filter(
      (server) => q.length === 0 || server.key.toLowerCase().includes(q) || server.summary.toLowerCase().includes(q),
    );
  }, [servers, query]);

  const selectedServer = servers.find((server) => server.key === selected);
  const noWorkspace = !hasWorkspaceLabel(workspace);

  /** 执行一次写操作：失败写 opError；成功清错误并重拉列表。返回是否成功。 */
  const runOp = async (op: Promise<OpResult>): Promise<boolean> => {
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
  const onToggle = (server: ClientMcpServer) => {
    void runOp(mcpApi.setEnabled({ key: server.key, enabled: !server.enabled }));
  };

  /** 删除：第一次点击进入确认态；再次点击才真正删除并清空选中。 */
  const onDelete = (server: ClientMcpServer) => {
    if (confirmDelete !== server.key) {
      setConfirmDelete(server.key);
      return;
    }
    setConfirmDelete(undefined);
    void runOp(mcpApi.remove({ key: server.key })).then((ok) => {
      if (ok) setSelected(undefined);
    });
  };

  return (
    <div className="skp-domain">
      <div className="skp-subheader">
        <input
          className="skp-search"
          type="search"
          placeholder="搜索 MCP 服务器…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="skp-btn skp-btn-primary"
          disabled={noWorkspace}
          title={noWorkspace ? "需要可写的工作区才能添加" : undefined}
          onClick={() => {
            setEditServer(undefined);
            setSelected(undefined);
            setAddOpen(true);
          }}
        >
          + 添加
        </button>
      </div>

      {listErrors.length > 0 && <div className="skp-error">{listErrors.join("\n")}</div>}
      {opError && <div className="skp-error">{opError}</div>}
      {error && <div className="skp-error">{error}</div>}
      {loading && <div className="skp-status">加载中…</div>}

      {!loading && (
        <div className="skp-body">
          <ul className="skp-list">
            {visible.map((server) => {
              const mount = mounts[server.key];
              return (
                <li key={server.key}>
                  <button
                    className={selected === server.key ? "skp-row skp-row-active" : "skp-row"}
                    onClick={() => {
                      setSelected(server.key);
                      setEditServer(undefined);
                      setConfirmDelete(undefined);
                    }}
                  >
                    <span className="skp-row-name">
                      <span className={"skp-dot " + (server.enabled ? "skp-dot-enabled" : "")} title={rowDotTitle(server, mount)} />
                      {server.key}
                    </span>
                    <span className="skp-row-meta">
                      <span className="skp-tag skp-tag-flat">{server.transport}</span>
                      {!server.enabled && <span className="skp-tag skp-tag-readonly">已禁用</span>}
                      {server.enabled && mount?.state === "failed" && <span className="skp-tag skp-tag-error">挂载失败</span>}
                      {server.enabled && mount?.state === "conflict" && <span className="skp-tag skp-tag-warn">冲突</span>}
                    </span>
                    <span className="skp-row-desc">{server.summary}</span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="skp-empty">{noWorkspace ? "当前没有工作区。" : "本项目还没有 MCP 服务器。点「+ 添加」新增。"}</li>
            )}
          </ul>

          <div className="skp-detail">
            {selectedServer ? (
              <McpDetail
                server={selectedServer}
                mount={mounts[selectedServer.key]}
                confirmingDelete={confirmDelete === selectedServer.key}
                onEdit={() => setEditServer(selectedServer)}
                onToggle={() => onToggle(selectedServer)}
                onDelete={() => onDelete(selectedServer)}
              />
            ) : (
              <div className="skp-detail-empty">选择一个服务器查看详情，或新增一个。</div>
            )}
          </div>
        </div>
      )}

      {addOpen && (
        <McpAddDialog
          api={mcpApi}
          servers={servers}
          workspace={workspace}
          onClose={() => setAddOpen(false)}
          onMutated={() => reload()}
        />
      )}
      {editServer !== undefined && (
        <McpEditDialog api={mcpApi} server={editServer} workspace={workspace} onClose={() => setEditServer(undefined)} onSaved={() => reload()} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 详情卡片
// ---------------------------------------------------------------------------

/** 详情卡片：展示条目字段 + 挂载状态 + 写操作。 */
function McpDetail({
  server,
  mount,
  confirmingDelete,
  onEdit,
  onToggle,
  onDelete,
}: {
  server: ClientMcpServer;
  mount?: MountInfo;
  confirmingDelete: boolean;
  onEdit(): void;
  onToggle(): void;
  onDelete(): void;
}) {
  return (
    <div className="skp-detail-card">
      <div className="skp-detail-head">
        <h3>{server.key}</h3>
      </div>
      <div className="skp-detail-actions">
        <button
          type="button"
          className={"skp-btn " + (server.enabled ? "skp-state-on" : "skp-state-off")}
          title={server.enabled ? "点击禁用（保留在配置文件中，不挂载）" : "点击启用（写入配置文件并挂载）"}
          onClick={onToggle}
        >
          {server.enabled ? "已启用" : "已禁用"}
        </button>
        <button type="button" className="skp-btn" onClick={onEdit}>
          编辑
        </button>
        <button
          type="button"
          className={confirmingDelete ? "skp-btn skp-btn-danger" : "skp-btn skp-btn-danger-ghost"}
          title="删除本项目中的这个服务器"
          onClick={onDelete}
        >
          {confirmingDelete ? "确认删除？" : "删除"}
        </button>
      </div>
      <dl className="skp-detail-fields">
        <dt>命名空间</dt>
        <dd>mcp__{server.serverName}__*</dd>
        {server.transport === "stdio" ? (
          <>
            <dt>命令</dt>
            <dd className="skp-path">{server.entry.command}</dd>
            {(server.entry.args ?? []).length > 0 && (
              <>
                <dt>参数</dt>
                <dd className="skp-path">{(server.entry.args ?? []).join(" ")}</dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt>URL</dt>
            <dd className="skp-path">{server.entry.url}</dd>
          </>
        )}
        <dt>配置文件</dt>
        <dd className="skp-path">{server.filePath}</dd>
        <dt>状态</dt>
        <dd>{mount === undefined ? "未挂载到当前会话" : MOUNT_LABEL[mount.state]}</dd>
        {mount?.error !== undefined && (
          <>
            <dt>错误</dt>
            <dd className="skp-path">{mount.error}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 新增 / 编辑表单
// ---------------------------------------------------------------------------

/** 新增 / 编辑表单。embedded 为 true 时褪掉卡片外壳。 */
function McpForm({
  mode,
  server,
  workspace,
  embedded,
  actionsClass = "skp-detail-actions",
  onCancel,
  onSave,
}: {
  mode: "new" | "edit";
  server?: ClientMcpServer;
  workspace?: string;
  embedded?: boolean;
  actionsClass?: string;
  onCancel(): void;
  onSave(key: string, entry: McpServerEntry): Promise<void>;
}) {
  const entry = server?.entry ?? {};
  const [key, setKey] = useState(server?.key ?? "");
  const [transport, setTransport] = useState<"stdio" | "http">(server?.transport ?? "stdio");
  const [command, setCommand] = useState(entry.command ?? "");
  const [args, setArgs] = useState((entry.args ?? []).join("\n"));
  const [env, setEnv] = useState(recordToLines(entry.env));
  const [url, setUrl] = useState(entry.url ?? "");
  const [headers, setHeaders] = useState(recordToLines(entry.headers));
  const [timeoutMs, setTimeoutMs] = useState(entry.timeoutMs !== undefined ? String(entry.timeoutMs) : "");
  const [disabled, setDisabled] = useState(entry.disabled === true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isNew = mode === "new";
  const noWorkspace = !hasWorkspaceLabel(workspace);

  /** 客户端前置校验（与宿主的 validateEntry 保持同口径，快速反馈）。 */
  const submit = async () => {
    const problems: string[] = [];
    if (key.trim().length === 0) problems.push("名称不能为空");
    if (transport === "stdio" && command.trim().length === 0) problems.push("stdio 服务器需要填写「命令」");
    if (transport === "http" && url.trim().length === 0) problems.push("http 服务器需要填写「URL」");
    const envRecord = linesToRecord(env, "env", problems);
    const headerRecord = linesToRecord(headers, "headers", problems);
    const timeout = timeoutMs.trim().length === 0 ? undefined : Number(timeoutMs);
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) problems.push("超时必须是正数（ms）");
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    const next: McpServerEntry =
      transport === "stdio"
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
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? undefined : "skp-detail-card"}>
      {!embedded && <h3>{isNew ? "添加 MCP 服务器" : "编辑 " + (server?.key ?? "")}</h3>}
      {errors.length > 0 && <div className="skp-error">{errors.join("\n")}</div>}
      <div className="skp-form">
        <label className="skp-field">
          <span className="skp-field-label">名称</span>
          <input className="skp-input" value={key} disabled={!isNew} placeholder="github" onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="skp-field">
          <span className="skp-field-label">传输方式</span>
          <select className="skp-input" value={transport} onChange={(e) => setTransport(e.target.value === "http" ? "http" : "stdio")}>
            <option value="stdio">stdio（启动本地命令）</option>
            <option value="http">http（流式 HTTP 端点）</option>
          </select>
        </label>
        {transport === "stdio" ? (
          <>
            <label className="skp-field">
              <span className="skp-field-label">命令</span>
              <input className="skp-input" value={command} placeholder="npx" onChange={(e) => setCommand(e.target.value)} />
            </label>
            <label className="skp-field">
              <span className="skp-field-label">参数（每行一个）</span>
              <textarea className="skp-input skp-textarea" value={args} placeholder={"-y\n@modelcontextprotocol/server-github"} onChange={(e) => setArgs(e.target.value)} />
            </label>
            <label className="skp-field">
              <span className="skp-field-label">环境变量（每行 KEY=VALUE）</span>
              <textarea className="skp-input skp-textarea" value={env} placeholder={"GITHUB_TOKEN=xxx"} onChange={(e) => setEnv(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="skp-field">
              <span className="skp-field-label">URL</span>
              <input className="skp-input" value={url} placeholder="http://localhost:3000/mcp" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="skp-field">
              <span className="skp-field-label">请求头（每行 KEY=VALUE）</span>
              <textarea className="skp-input skp-textarea" value={headers} onChange={(e) => setHeaders(e.target.value)} />
            </label>
          </>
        )}
        <label className="skp-field">
          <span className="skp-field-label">工具调用超时（ms，可选）</span>
          <input className="skp-input" value={timeoutMs} inputMode="numeric" placeholder="60000" onChange={(e) => setTimeoutMs(e.target.value)} />
        </label>
        <label className="skp-field skp-field-inline">
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />
          <span>禁用（保留在配置文件中，不挂载）</span>
        </label>
        {isNew && noWorkspace && <div className="skp-error">需要可写的工作区才能添加。</div>}
        <div className={actionsClass}>
          <button type="button" className="skp-btn skp-btn-primary" disabled={saving || (isNew && noWorkspace)} onClick={() => void submit()}>
            {saving ? (isNew ? "添加中…" : "保存中…") : isNew ? "添加" : "保存"}
          </button>
          <button type="button" className="skp-btn" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 添加弹窗（表单 / JSON）
// ---------------------------------------------------------------------------

/** 添加 MCP 服务器弹窗：表单 / JSON 两种模式。 */
function McpAddDialog({
  api,
  servers,
  workspace,
  onClose,
  onMutated,
}: {
  api: McpApi;
  servers: ClientMcpServer[];
  workspace?: string;
  onClose(): void;
  onMutated(): void;
}) {
  const [tab, setTab] = useState<"preset" | "form" | "json">("preset");

  return (
    <Modal title="添加 MCP 服务器" onClose={onClose}>
      <div className="skp-tabs" role="tablist">
        {(["preset", "form", "json"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "skp-tab skp-tab-active" : "skp-tab"}
            onClick={() => setTab(t)}
          >
            {t === "preset" ? "预置" : t === "form" ? "表单" : "JSON"}
          </button>
        ))}
      </div>
      <div hidden={tab !== "preset"}>
        <McpPresetImport api={api} onClose={onClose} onMutated={onMutated} />
      </div>
      <div hidden={tab !== "form"}>
        <McpForm
          mode="new"
          workspace={workspace}
          embedded
          actionsClass="skp-modal-actions"
          onCancel={onClose}
          onSave={async (key, entry) => {
            const result = await api.upsert({ key, entry });
            if (!result.ok) throw new Error(result.errors.join("; "));
            onMutated();
            onClose();
          }}
        />
      </div>
      <div hidden={tab !== "json"}>
        <McpJsonImport api={api} servers={servers} onClose={onClose} onMutated={onMutated} />
      </div>
    </Modal>
  );
}

/** 编辑 MCP 服务器弹窗。 */
function McpEditDialog({
  api,
  server,
  workspace,
  onClose,
  onSaved,
}: {
  api: McpApi;
  server: ClientMcpServer;
  workspace?: string;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <Modal title={"编辑 " + server.key} onClose={onClose}>
      <McpForm
        mode="edit"
        server={server}
        workspace={workspace}
        embedded
        actionsClass="skp-modal-actions"
        onCancel={onClose}
        onSave={async (key, entry) => {
          const result = await api.upsert({ key, entry });
          if (!result.ok) throw new Error(result.errors.join("; "));
          onSaved();
          onClose();
        }}
      />
    </Modal>
  );
}

/**
 * 预置 MCP 面板：从下拉框选择一个预置，按需填写认证 Header 后一键添加。
 */
function McpPresetImport({ api, onClose, onMutated }: { api: McpApi; onClose(): void; onMutated(): void }) {
  const [presetId, setPresetId] = useState(MCP_PRESETS[0]?.id ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const preset = MCP_PRESETS.find((item) => item.id === presetId) ?? MCP_PRESETS[0];
  if (preset === undefined) return <div className="skp-error">没有可用的预置 MCP。</div>;

  const submit = async () => {
    setBusy(true);
    setErrors([]);
    const entry: McpServerEntry = { ...preset.entry };
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

  return (
    <div className="skp-form">
      <label className="skp-field">
        <span className="skp-field-label">预置 MCP</span>
        <SkpSelect
          value={preset.id}
          ariaLabel="预置 MCP"
          options={MCP_PRESETS.map((item) => ({ value: item.id, label: item.name, hint: item.summary }))}
          onChange={setPresetId}
        />
      </label>

      <div className="skp-field">
        <span className="skp-field-label">服务地址</span>
        <span className="skp-note skp-path">{preset.entry.url}</span>
      </div>

      {preset.auth !== undefined && (
        <label className="skp-field">
          <span className="skp-field-label">
            {preset.auth.label}（Header: {preset.auth.header}）
          </span>
          <input
            className="skp-input"
            type="password"
            autoComplete="off"
            value={token}
            placeholder={preset.auth.placeholder ?? ""}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
      )}

      {preset.references !== undefined && preset.references.length > 0 && (
        <span className="skp-note">
          {preset.references.map((reference, index) => (
            <span key={reference.url}>
              {index > 0 && " · "}
              <a href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}
              </a>
            </span>
          ))}
        </span>
      )}

      {errors.length > 0 && <div className="skp-error">{errors.join("\n")}</div>}

      <div className="skp-modal-actions">
        <button type="button" className="skp-btn" onClick={onClose}>
          取消
        </button>
        <button type="button" className="skp-btn skp-btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? "添加中…" : "添加"}
        </button>
      </div>
    </div>
  );
}

/** parseMcpJson 解析出的单个条目（键 + 原始条目）。 */
type ParsedMcpEntry = { key: string; entry: McpServerEntry };

/**
 * 解析"添加 MCP 服务器"的 JSON 文本为条目清单。
 */
function parseMcpJson(text: string): { ok: true; entries: ParsedMcpEntry[] } | { ok: false; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: ["JSON 解析失败：" + (error instanceof Error ? error.message : String(error))] };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ['JSON 顶层必须是对象，例如 { "mcpServers": { … } } 或 { "服务器名": { … } }'] };
  }
  const root = data as Record<string, unknown>;
  if (Object.keys(root).length > 0 && Object.values(root).every((v) => v === null || typeof v !== "object" || Array.isArray(v))) {
    return { ok: false, errors: ['看起来是单条服务器条目，缺少名称键；请用 { "服务器名": { … } } 包裹。'] };
  }
  let servers: unknown;
  if (typeof root.mcpServers === "object" && root.mcpServers !== null && !Array.isArray(root.mcpServers)) {
    servers = root.mcpServers;
  } else if ("mcpServers" in root && Object.keys(root).length === 1) {
    return { ok: false, errors: ["「mcpServers」必须是服务器对象映射。"] };
  } else {
    servers = root;
  }
  const entries: ParsedMcpEntry[] = [];
  const problems: string[] = [];
  for (const [key, value] of Object.entries(servers as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      problems.push(key + ": 条目必须是对象");
      continue;
    }
    const entry = value as McpServerEntry;
    const entryProblems = validateEntry(key, entry);
    if (entryProblems.length > 0) {
      problems.push(key + ": " + entryProblems.join("; "));
      continue;
    }
    entries.push({ key, entry });
  }
  if (problems.length > 0) return { ok: false, errors: problems };
  if (entries.length === 0) return { ok: false, errors: ["没有可添加的服务器条目。"] };
  return { ok: true, entries };
}

/** JSON 文本框占位示例（两种形状都能贴）。 */
const JSON_PLACEHOLDER = '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_TOKEN": "xxx" }\n    },\n    "web": { "type": "http", "url": "http://localhost:3000/mcp" }\n  }\n}';

/**
 * JSON 批量添加面板：逐条串行 upsert，避免读-改-写竞态。
 */
function McpJsonImport({
  api,
  servers,
  onClose,
  onMutated,
}: {
  api: McpApi;
  servers: ClientMcpServer[];
  onClose(): void;
  onMutated(): void;
}) {
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opErrors, setOpErrors] = useState<string[]>([]);

  const parse = useMemo(() => parseMcpJson(text), [text]);

  const preview = useMemo(() => {
    if (!parse.ok) return undefined;
    return parse.entries.map(({ key, entry }) => {
      const exists = servers.some((s) => s.key === key);
      return { key, entry, exists, overwriting: exists && overwrite, skipped: exists && !overwrite };
    });
  }, [parse, servers, overwrite]);

  const addable = preview?.filter((item) => !item.skipped) ?? [];

  const doAdd = async () => {
    setBusy(true);
    setOpErrors([]);
    const failures: string[] = [];
    let added = 0;
    for (const { key, entry } of addable) {
      const result = await api.upsert({ key, entry });
      if (result.ok) added += 1;
      else failures.push(key + ": " + result.errors.join("; "));
    }
    onMutated();
    if (failures.length > 0) {
      setOpErrors(["已添加 " + added + " 个，失败 " + failures.length + " 个：", ...failures]);
      setBusy(false);
      return;
    }
    onClose();
  };

  return (
    <div className="skp-form">
      <label className="skp-field">
        <span className="skp-field-label">JSON 配置</span>
        <textarea
          className="skp-input skp-textarea skp-json-field"
          value={text}
          spellCheck={false}
          placeholder={JSON_PLACEHOLDER}
          onChange={(e) => {
            setText(e.target.value);
            setOpErrors([]);
          }}
        />
        <span className="skp-note">支持完整 .mcp.json（含 mcpServers 键）或裸服务器映射。</span>
      </label>

      {!parse.ok && text.trim().length > 0 && <div className="skp-error">{parse.errors.join("\n")}</div>}

      {preview !== undefined && preview.length > 0 && (
        <div className="skp-field">
          <span className="skp-field-label">将添加 {addable.length}/{preview.length} 个</span>
          <ul className="skp-import-list">
            {preview.map(({ key, entry, overwriting, skipped }) => (
              <li key={key} className="skp-import-item">
                <span className="skp-import-name">{key}</span>
                <span className="skp-tag skp-tag-flat">{transportOf(entry)}</span>
                <span className="skp-import-desc">{summarizeEntry(entry)}</span>
                <span className={"skp-import-note " + (overwriting ? "skp-import-note-over" : skipped ? "skp-import-note-skip" : "skp-import-note-add")}>
                  {overwriting ? "将覆盖" : skipped ? "已存在，跳过" : "将新增"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="skp-field skp-field-inline">
        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
        同名服务器已存在时覆盖
      </label>

      {opErrors.length > 0 && <div className="skp-error">{opErrors.join("\n")}</div>}

      <div className="skp-modal-actions">
        <button type="button" className="skp-btn" onClick={onClose}>
          取消
        </button>
        <button type="button" className="skp-btn skp-btn-primary" disabled={busy || addable.length === 0} onClick={() => void doAdd()}>
          {busy ? "添加中…" : "添加 " + addable.length + " 个"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 文本帮助函数（KEY=VALUE 行 ⇄ 记录、一行一个 ⇄ 数组）
// ---------------------------------------------------------------------------

/** 记录 → 每行 KEY=VALUE 的文本。 */
function recordToLines(record: Record<string, string> | undefined): string {
  return Object.entries(record ?? {})
    .map(([k, v]) => k + "=" + v)
    .join("\n");
}

/** 文本 → 记录；非法行记入 problems 并跳过。 */
function linesToRecord(text: string, field: string, problems: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
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
function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
