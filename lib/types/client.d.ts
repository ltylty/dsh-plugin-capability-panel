/**
 * capability-panel 的客户端插件入口。
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
 * @module @chengdb/capability-panel/client
 */
/** 客户端强依赖的服务。 */
export declare const inject: string[];
/** 客户端插件主体：注入样式、注册 locale、构造传输适配器、注册侧栏入口。 */
export declare function apply(ctx: any): void;
