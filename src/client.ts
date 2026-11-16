/**
 * dsh-workspace-skill-mcp 的客户端插件入口。
 *
 * 发布后的 bundle 会把本模块包裹进
 * `window.__ModuleLoader__.load({ id, factory })`（由 tsdown 生成，平台模块
 * 外部化）；这里的源码只导出 `inject` 与 `apply`。
 *
 * 面板入口位于**侧栏底部**：向根作用域的 `sidebar.footer.action` 列表槽
 * 注册一个按钮，摆放在 Settings 旁边；点击后在其上方弹出锚定浮层面板。
 * 面板默认定位到**当前会话的工作区**，右上角下拉框可切换到其它已注册
 * 工作区（不提供"跟随当前会话"选项）。
 *
 * @module dsh-workspace-skill-mcp/client
 */

import { createElement } from "react";
import { createPanelApi } from "./client/api-adapter.js";
import { installStyles } from "./client/styles.js";
import { CapabilitiesFooterAction } from "./client/panel.js";

/** locale 字典的命名空间。 */
const NS = "capabilityPanel";

/** 简体中文词典（预留脚手架，组件当前硬编码文案）。 */
const zh = {
  "panel.title": "工作区技能",
  "panel.domain.skills": "技能",
  "panel.domain.mcp": "MCP",
  "panel.search": "搜索…",
  "panel.loading": "加载中…",
  "panel.empty": "没有匹配项。",
  "panel.none": "（无工作区）",
};

/** 英文词典，键集合与 zh 完全一致。 */
const en: Record<keyof typeof zh, string> = {
  "panel.title": "Workspace Skills",
  "panel.domain.skills": "Skills",
  "panel.domain.mcp": "MCP",
  "panel.search": "Search…",
  "panel.loading": "Loading…",
  "panel.empty": "Nothing matches.",
  "panel.none": "(no workspace)",
};

/** 客户端强依赖的服务。 */
export const inject = ["connection", "slots", "locale", "workspaces"];

/** 客户端插件主体：注入样式、注册 locale、构造传输适配器、注册侧栏入口。 */
export function apply(ctx: any) {
  const disposers: Array<() => void> = [];
  disposers.push(installStyles());

  if (ctx.locale?.register) {
    disposers.push(ctx.locale.register(NS, { zh, en }));
  }

  // 当前工作区是异步解析的 SnapshotStore；订阅图变化后，cwd 或工作区列表
  // 真正变化时通知面板刷新。
  const workspaceListeners = new Set<() => void>();
  const notifyWorkspaceListeners = () => {
    for (const listener of workspaceListeners) {
      try {
        listener();
      } catch {
        /* 单个监听器的失败不能影响其它监听器 */
      }
    }
  };

  // 下拉框的显式选择；undefined = 使用当前会话工作区（默认定位）。
  const selection: { cwd: string | undefined } = { cwd: undefined };
  const effectiveCwd = () => selection.cwd ?? currentWorkspaceCwd(ctx);

  const api = createPanelApi({
    rpc: ctx.get("connection")?.rpc,
    currentWorkspaceCwd: effectiveCwd,
    subscribeWorkspace: (listener) => {
      workspaceListeners.add(listener);
      return () => {
        workspaceListeners.delete(listener);
      };
    },
    listProjects: () => listWorkspaceOptions(ctx),
    selectProject: (path) => {
      if (selection.cwd === path) return;
      selection.cwd = path;
      notifyWorkspaceListeners();
    },
  });

  let lastCwd = effectiveCwd();
  let lastItemsKey = workspaceItemsKey(ctx);
  const onGraphChange = () => {
    const next = effectiveCwd();
    const itemsKey = workspaceItemsKey(ctx);
    if (next === lastCwd && itemsKey === lastItemsKey) return;
    lastCwd = next;
    lastItemsKey = itemsKey;
    notifyWorkspaceListeners();
  };
  const unsubSessions = ctx.get("sessions")?.list?.subscribe?.(onGraphChange);
  const unsubWorkspaces = ctx.get("workspaces")?.list?.subscribe?.(onGraphChange);
  if (typeof unsubSessions === "function") disposers.push(unsubSessions);
  if (typeof unsubWorkspaces === "function") disposers.push(unsubWorkspaces);

  // 注册侧栏底部入口（Settings 旁的按钮，点击切换 popover）。
  if (ctx.slots?.inject && ctx.slots.register) {
    const dispose = ctx.slots.inject("sidebar.footer.action", () =>
      ctx.slots.register({ name: "sidebar.footer.action", id: "capability-panel", order: 10, label: "工作区技能" }, (props: { wide?: boolean }) =>
        CapabilitiesFooterAction({ api, wide: props?.wide !== false }),
      ),
    );
    if (typeof dispose === "function") disposers.push(dispose);
  }

  ctx.effect?.(() => () => {
    for (const dispose of disposers) dispose();
  }, "dsh-workspace-skill-mcp: client");
}

/**
 * 推导当前活动的工作区目录（若存在）。
 *
 * 最高保真来源是当前 session 自己的工作目录（`sessions.list` →
 * `byId[current].cwd`）；session 存在但还没有 cwd 时，回退到包含它的
 * Workspace；没有当前 session 时用最近活跃的 workspace，再退到第一个注册的
 * workspace。
 */
function currentWorkspaceCwd(ctx: any): string | undefined {
  let current: string | undefined;
  try {
    const sessions = ctx.get("sessions");
    const snap = sessions?.list?.getSnapshot?.();
    current = snap?.current;
    if (typeof current === "string") {
      const cwd = snap?.byId?.[current]?.cwd;
      if (typeof cwd === "string" && cwd.length > 0) return cwd;
    }
  } catch {
    /* sessions 服务可能缺席 */
  }
  try {
    const workspaces = ctx.get("workspaces");
    const items: Array<{ workspaceId: string; path?: string; sessionIds?: string[] }> =
      workspaces?.list?.getSnapshot?.()?.items ?? [];
    if (typeof current === "string") {
      const owned = items.find((w) => w.sessionIds?.includes?.(current));
      if (owned?.path) return owned.path;
    }
    const recent = workspaces?.list?.getSnapshot?.()?.recentWorkspaceId;
    if (typeof recent === "string") {
      const item = items.find((w) => w.workspaceId === recent);
      if (item?.path) return item.path;
    }
    return items[0]?.path;
  } catch {
    return undefined;
  }
}

/** 读取已知工作区，供面板的项目下拉框使用。 */
function listWorkspaceOptions(ctx: any): Array<{ id: string; path: string; title?: string }> {
  try {
    const items: Array<{ workspaceId?: string; path?: string; title?: string }> =
      ctx.get("workspaces")?.list?.getSnapshot?.()?.items ?? [];
    return items
      .filter((w) => typeof w.path === "string" && w.path.length > 0)
      .map((w) => ({
        id: String(w.workspaceId ?? w.path),
        path: w.path as string,
        ...(typeof w.title === "string" && w.title.length > 0 ? { title: w.title } : {}),
      }));
  } catch {
    return [];
  }
}

/** 工作区列表的廉价变更检测键。 */
function workspaceItemsKey(ctx: any): string {
  return listWorkspaceOptions(ctx)
    .map((o) => o.id + ":" + o.path + ":" + (o.title ?? ""))
    .join("|");
}
