/**
 * 能力域面板共用的模型与小组件（Skills / MCP 两域视图共用）。
 *
 *   - `hasWorkspaceLabel`：面板是否附着在可写工作区上；
 *   - `useAsyncList`：两域视图高度同构的"依赖变化时拉取 + 显式重拉"状态机
 *     （loading/error/请求序号守卫）。
 *
 * @module @chengdb/capability-panel/client/panel-common
 */
/** 面板是否附着在一个可写工作区上（workspaceLabel 无工作区时返回占位字符串）。 */
export declare function hasWorkspaceLabel(workspace: string | undefined): boolean;
/**
 * 两域视图共用的"拉取 + 重拉"状态机。
 *
 * 依赖变化（挂载、工作区切换）与显式 `reload()` 都会触发拉取。内部用请求
 * 序号守卫：并发触发时只让**最新一次**请求的结果落地，防乱序旧响应覆盖新状态。
 */
export declare function useAsyncList<T>(load: () => Promise<T>, deps: readonly unknown[]): {
    data: T | undefined;
    loading: boolean;
    error: string | undefined;
    reload: () => void;
};
