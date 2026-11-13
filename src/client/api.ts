/**
 * 客户端面板的 API 表面（传输无关）。
 *
 * 面板 UI 只依赖这套接口，不关心底层传输方式；具体的适配器
 * （插件自有通道 `/capability-panel` 上的 RPC，见 api-adapter.ts）由
 * `src/client.ts` 组装注入。
 *
 * 客户端类型（`Client*` 前缀）刻意与宿主类型保持独立：这是传输边界。
 *
 * @module @chengdb/capability-panel/client/api
 */

import type { SkillFormat, SkillSpec } from "../skills/types.js";
import type { McpServerEntry } from "../mcp/types.js";

// ---------------------------------------------------------------------------
// Skills 域
// ---------------------------------------------------------------------------

/** 面板列表里的一行 skill 摘要（调用策略已拍平为两个布尔）。 */
export interface ClientSkillSummary {
  name: string;
  description: string;
  whenToUse?: string;
  modelInvocable: boolean;
  userInvocable: boolean;
  source: string;
  format: SkillFormat;
  path?: string;
}

/** skill 详情 = 摘要 + 完整 spec + 正文 + 资源文件列表。 */
export interface ClientSkillDetail extends ClientSkillSummary {
  spec: SkillSpec;
  body: string;
  resources: string[];
}

/** 创建 skill 的入参。 */
export interface CreateSkillInput {
  format: SkillFormat;
  spec: SkillSpec;
  body: string;
  overwrite?: boolean;
}

/** 操作结果：成功或错误信息列表。 */
export type OpResult = { ok: true } | { ok: false; errors: string[] };

/** 安装结果：成功时带回实际落盘的 skill 名（以 frontmatter 名称为准）。 */
export type InstallResult = { ok: true; name?: string; existed?: boolean } | { ok: false; errors: string[] };

/** 上传/下载通道里的一个文件：相对路径 + base64 内容。 */
export interface SkillFilePayload {
  path: string;
  content: string;
}

/** 浏览器上传安装的入参（单 .md 文件或含 SKILL.md 的一组目录文件）。 */
export interface InstallUploadInput {
  files: SkillFilePayload[];
  overwrite?: boolean;
}

/** 从预置技能库安装的入参。 */
export interface InstallLibraryInput {
  /** 技能库目录内的条目名（下拉框选中值）。 */
  entry: string;
  overwrite?: boolean;
}

/** 技能库里的一个可安装条目。 */
export interface LibrarySkill {
  name: string;
  description: string;
  entry: string;
  format: SkillFormat;
}

/** 技能库列表视图。 */
export interface SkillLibraryView {
  /** 技能库目录绝对路径；未配置时缺省。 */
  dir?: string;
  skills: LibrarySkill[];
  errors: string[];
}

/** URL 下载安装的入参（GitHub 仓库 / .zip / raw .md）。 */
export interface InstallUrlInput {
  url: string;
  overwrite?: boolean;
}

/** 导出为文件清单的结果（客户端据此单文件下载或打 zip）。 */
export type ExportFilesResult =
  | { ok: true; name: string; format: SkillFormat; files: SkillFilePayload[] }
  | { ok: false; errors: string[] };

/** 按名称寻址一个 skill。 */
export interface SkillRef {
  name: string;
}

/** skills 域的面板 API。 */
export interface SkillsApi {
  /** 列出当前工作区项目级 skill 摘要。 */
  list(): Promise<ClientSkillSummary[]>;
  /** 读取单个 skill 详情；不存在返回 undefined。 */
  read(name: string): Promise<ClientSkillDetail | undefined>;
  create(input: CreateSkillInput): Promise<OpResult>;
  update(input: { name: string; spec: SkillSpec; body: string }): Promise<OpResult>;
  remove(input: SkillRef): Promise<OpResult>;
  /**
   * 一键启用/禁用 skill：禁用 = 用户与模型都不可调用；启用 = 清除两个键
   * 恢复缺省双启用。正文与其它元数据原样保留。
   */
  setEnabled(input: SkillRef & { enabled: boolean }): Promise<OpResult>;
  /**
   * 细粒度调节调用方式：模型（agent 自动触发）与用户（输入框 `/name`
   * 口令）两个方向分别启用/禁用。
   */
  setInvocation(input: SkillRef & { modelInvocable: boolean; userInvocable: boolean }): Promise<OpResult>;
  /** 浏览器上传安装。 */
  installUpload(input: InstallUploadInput): Promise<InstallResult>;
  /** 列出预置技能库中的可安装条目。 */
  sources(): Promise<SkillLibraryView>;
  /** 从预置技能库安装。 */
  installFromLibrary(input: InstallLibraryInput): Promise<InstallResult>;
  /** 从 URL 下载安装。 */
  installFromUrl(input: InstallUrlInput): Promise<InstallResult>;
  /** 导出为 base64 文件清单（供浏览器下载/打包）。 */
  exportFiles(input: SkillRef): Promise<ExportFilesResult>;
  /** 导出到宿主上的指定目录。 */
  exportToPath(input: SkillRef & { destDir: string; overwrite?: boolean }): Promise<OpResult>;
}

// ---------------------------------------------------------------------------
// MCP 域
// ---------------------------------------------------------------------------

/** 面板视角的一条 MCP server。 */
export interface ClientMcpServer {
  key: string;
  serverName: string;
  transport: "stdio" | "http";
  enabled: boolean;
  summary: string;
  entry: McpServerEntry;
  filePath: string;
}

/** 列表结果：servers + 非致命的读取错误。 */
export interface ClientMcpList {
  servers: ClientMcpServer[];
  errors: string[];
}

/** 一条 server 在一个 session 内的挂载状态。 */
export interface ClientMcpMount {
  key: string;
  serverName: string;
  state: "mounted" | "failed" | "conflict";
  error?: string;
}

/** 一个 session 的挂载状态视图。 */
export interface ClientMcpStatus {
  sessionId: string;
  projectRoot?: string;
  servers: ClientMcpMount[];
}

/** 新增/更新一条 server 的入参。 */
export interface McpUpsertInput {
  key: string;
  entry: McpServerEntry;
}

/** MCP 域的面板 API。 */
export interface McpApi {
  list(): Promise<ClientMcpList>;
  upsert(input: McpUpsertInput): Promise<OpResult>;
  remove(input: { key: string }): Promise<OpResult>;
  setEnabled(input: { key: string; enabled: boolean }): Promise<OpResult>;
  /** 当前项目下各 session 的实时挂载状态。 */
  status(): Promise<ClientMcpStatus[]>;
}

// ---------------------------------------------------------------------------
// 面板根
// ---------------------------------------------------------------------------

/** 工作区下拉框里的一个选项。 */
export interface WorkspaceOption {
  id: string;
  path: string;
  title?: string;
}

/** 面板需要的全部宿主能力，传输无关。 */
export interface CapabilityPanelApi {
  skills: SkillsApi;
  mcp: McpApi;
  /** 当前面板定位到的工作区目录（默认当前工作区；无工作区时为占位文案）。 */
  workspaceLabel(): string;
  /** 工作区下拉框可用的列表。 */
  projects(): WorkspaceOption[];
  /** 把面板切换到指定工作区（下拉框选择）。 */
  selectProject(path: string): void;
  /** 订阅当前工作区 / 工作区列表变化（切换会话、解析完成或手动选择时触发）。 */
  subscribeWorkspace(listener: () => void): () => void;
}
