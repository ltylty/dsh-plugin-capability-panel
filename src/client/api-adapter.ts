/**
 * `CapabilityPanelApi` 的 Web 客户端适配器：每个调用都走插件自有 RPC 通道
 * （`/capability-panel`，见 channel.ts），endpoint 按域前缀命名
 * （`skills.*` / `mcp.*`，见 remote.ts 的路由表）。
 *
 * 这里负责：包上信封 → 调用通道 → 解信封（失败抛错）→ 把宿主返回的
 * 普通对象投影成客户端类型。
 *
 * @module @chengdb/capability-panel/client/api-adapter
 */

import { CHANNEL } from "../channel.js";
import type {
  CapabilityPanelApi,
  ClientMcpList,
  ClientMcpStatus,
  ClientSkillDetail,
  ClientSkillSummary,
  CreateSkillInput,
  InstallResult,
  McpUpsertInput,
  WorkspaceOption,
} from "./api.js";

/** 宿主 RPC 通道结果信封的薄包装（与 remote.ts 的 RpcResult 同构）。 */
type RawResult = { ok: true; value: unknown } | { ok: false; errors: string[] };

/** 适配器的构造依赖。 */
export interface AdapterDeps {
  rpc: { call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown> };
  /** 面板当前定位到的工作区目录（下拉选择优先，否则当前 session）。 */
  currentWorkspaceCwd(): string | undefined;
  /** 订阅工作区变化；返回取消订阅函数。 */
  subscribeWorkspace(listener: () => void): () => void;
  /** 工作区下拉框可用的列表。 */
  listProjects(): WorkspaceOption[];
  /** 切换面板定位的工作区。 */
  selectProject(path: string): void;
}

/** 构建传输无关的面板 API（RPC 实现）。 */
export function createPanelApi(deps: AdapterDeps): CapabilityPanelApi {
  /** 调用一次宿主 RPC，并把响应归一成与旧信封同构的 RawResult。 */
  async function rpc(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RawResult> {
    const raw = await deps.rpc.call(CHANNEL, endpoint, payload, signal);
    if (raw && typeof raw === "object" && "ok" in raw) {
      const record = raw as Record<string, unknown>;
      if (record.ok === true && record.value !== null && typeof record.value === "object") {
        const inner = record.value as Record<string, unknown>;
        if (inner.ok === false && Array.isArray(inner.errors)) {
          const { ok: _ok, errors, ...rest } = inner;
          return { ok: false, errors: errors as string[], ...rest } as RawResult;
        }
        return raw as RawResult;
      }
      return {
        ok: false,
        errors: Array.isArray(record.errors)
          ? (record.errors as string[])
          : [typeof record.message === "string" ? record.message : "操作失败"],
      };
    }
    return { ok: false, errors: [`unexpected response from ${CHANNEL}`] };
  }

  /**
   * 解开双层信封：宿主把业务结果包进 RPC 信封 `{ ok: true, value }`，
   * 所以信封 ok 不代表业务成功。value 自身带 ok 字段时以业务层为准。
   */
  function unwrap(result: RawResult): RawResult {
    if (result.ok && result.value !== null && typeof result.value === "object" && "ok" in (result.value as Record<string, unknown>)) {
      return result.value as RawResult;
    }
    return result;
  }

  return {
    skills: {
      async list() {
        const cwd = deps.currentWorkspaceCwd();
        const result = await rpc("skills.list", { cwd });
        if (!result.ok) throw new Error(result.errors.join("; "));
        const values = (result.value as unknown[]).filter((v) => v !== null && typeof v === "object") as Record<string, unknown>[];
        return values.map(toSummary);
      },

      async read(name) {
        const cwd = deps.currentWorkspaceCwd();
        const result = await rpc("skills.read", { name, cwd });
        if (!result.ok) throw new Error(result.errors.join("; "));
        const detail = result.value as Partial<ClientSkillDetail> | undefined;
        if (detail === undefined) return undefined;
        return detail as ClientSkillDetail;
      },

      async create(input: CreateSkillInput) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.create", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },

      async update(input) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.update", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },

      async remove(input) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.remove", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },

      async setEnabled(input) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.setEnabled", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },

      async setInvocation(input) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.setInvocation", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },

      async installUpload(input) {
        const cwd = deps.currentWorkspaceCwd();
        return toInstallResult(unwrap(await rpc("skills.install", { ...input, cwd })));
      },

      async installFromPath(input) {
        const cwd = deps.currentWorkspaceCwd();
        return toInstallResult(unwrap(await rpc("skills.install", { ...input, cwd })));
      },

      async installFromUrl(input) {
        const cwd = deps.currentWorkspaceCwd();
        return toInstallResult(unwrap(await rpc("skills.install", { ...input, cwd })));
      },

      async exportFiles(input) {
        const cwd = deps.currentWorkspaceCwd();
        const result = unwrap(await rpc("skills.export", { ...input, cwd }));
        if (!result.ok) return { ok: false, errors: result.errors };
        const self = result as unknown as Record<string, unknown>;
        if (!Array.isArray(self.files)) return { ok: false, errors: ["export returned no files"] };
        return {
          ok: true,
          name: typeof self.name === "string" ? self.name : input.name,
          format: self.format === "directory" ? "directory" : "flat",
          files: self.files as { path: string; content: string }[],
        };
      },

      async exportToPath(input) {
        const cwd = deps.currentWorkspaceCwd();
        return unwrap(await rpc("skills.export", { ...input, cwd })) as { ok: true } | { ok: false; errors: string[] };
      },
    },

    mcp: {
      async list(): Promise<ClientMcpList> {
        const cwd = deps.currentWorkspaceCwd();
        const result = await rpc("mcp.list", { cwd });
        if (!result.ok) throw new Error(result.errors.join("; "));
        return result.value as ClientMcpList;
      },

      async upsert(input: McpUpsertInput) {
        const cwd = deps.currentWorkspaceCwd();
        return rpc("mcp.upsert", { ...input, cwd });
      },

      async remove(input) {
        const cwd = deps.currentWorkspaceCwd();
        return rpc("mcp.remove", { ...input, cwd });
      },

      async setEnabled(input) {
        const cwd = deps.currentWorkspaceCwd();
        return rpc("mcp.setEnabled", { ...input, cwd });
      },

      async status(): Promise<ClientMcpStatus[]> {
        const cwd = deps.currentWorkspaceCwd();
        const result = await rpc("mcp.status", { cwd });
        if (!result.ok) throw new Error(result.errors.join("; "));
        return result.value as ClientMcpStatus[];
      },
    },

    workspaceLabel() {
      return deps.currentWorkspaceCwd() ?? "（无工作区）";
    },

    projects() {
      return deps.listProjects();
    },

    selectProject(path) {
      deps.selectProject(path);
    },

    subscribeWorkspace(listener) {
      return deps.subscribeWorkspace(listener);
    },
  };
}

/** 把宿主返回的行对象投影成客户端摘要。 */
function toSummary(value: Record<string, unknown>): ClientSkillSummary {
  const inv = (value.invocation ?? {}) as Record<string, unknown>;
  return {
    name: String(value.name),
    description: String(value.description ?? ""),
    ...(typeof value.whenToUse === "string" ? { whenToUse: value.whenToUse } : {}),
    modelInvocable: inv.modelInvocable !== false,
    userInvocable: inv.userInvocable !== false,
    source: String(value.source ?? "unknown"),
    format: value.format === "directory" ? "directory" : "flat",
    ...(typeof value.path === "string" ? { path: value.path } : {}),
  };
}

/** 把解开信封后的安装结果投影成 InstallResult。 */
function toInstallResult(result: RawResult): InstallResult {
  if (!result.ok) return { ok: false, errors: result.errors };
  const self = result as unknown as Record<string, unknown>;
  return {
    ok: true,
    ...(typeof self.name === "string" ? { name: self.name } : {}),
    ...(self.existed === true ? { existed: true } : {}),
  };
}
