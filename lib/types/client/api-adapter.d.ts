/**
 * `CapabilityPanelApi` 的 Web 客户端适配器：每个调用都走插件自有 RPC 通道
 * （`/capability-panel`，见 channel.ts），endpoint 按域前缀命名
 * （`skills.*` / `mcp.*`，见 remote.ts 的路由表）。
 *
 * 这里负责：包上信封 → 调用通道 → 解信封（失败抛错）→ 把宿主返回的
 * 普通对象投影成客户端类型。
 *
 * @module dsh-workspace-skill-mcp/client/api-adapter
 */
import type { CapabilityPanelApi, WorkspaceOption } from "./api.js";
/** 适配器的构造依赖。 */
export interface AdapterDeps {
    rpc: {
        call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown>;
    };
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
export declare function createPanelApi(deps: AdapterDeps): CapabilityPanelApi;
