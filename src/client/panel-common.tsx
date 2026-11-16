/**
 * 能力域面板共用的模型与小组件（Skills / MCP 两域视图共用）。
 *
 *   - `hasWorkspaceLabel`：面板是否附着在可写工作区上；
 *   - `useAsyncList`：两域视图高度同构的"依赖变化时拉取 + 显式重拉"状态机
 *     （loading/error/请求序号守卫）。
 *
 * @module dsh-workspace-skill-mcp/client/panel-common
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** 面板是否附着在一个可写工作区上（workspaceLabel 无工作区时返回占位字符串）。 */
export function hasWorkspaceLabel(workspace: string | undefined): boolean {
  return workspace !== undefined && workspace !== "（无工作区）";
}

/**
 * 两域视图共用的"拉取 + 重拉"状态机。
 *
 * 依赖变化（挂载、工作区切换）与显式 `reload()` 都会触发拉取。内部用请求
 * 序号守卫：并发触发时只让**最新一次**请求的结果落地，防乱序旧响应覆盖新状态。
 */
export function useAsyncList<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): { data: T | undefined; loading: boolean; error: string | undefined; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const seq = useRef(0);

  const reload = useCallback(() => {
    const run = ++seq.current;
    setLoading(true);
    setError(undefined);
    load()
      .then((value) => {
        if (run !== seq.current) return;
        setData(value);
      })
      .catch((err) => {
        if (run !== seq.current) return;
        setError(String(err));
      })
      .finally(() => {
        if (run !== seq.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    return () => {
      seq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload };
}
