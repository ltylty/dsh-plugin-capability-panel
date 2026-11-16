/**
 * dsh-workspace-skill-mcp 的客户端插件入口。
 *
 * 发布后的 bundle 会把本模块包裹进
 * `window.__ModuleLoader__.load({ id, factory })`（由 tsdown 生成，平台模块
 * 外部化）；这里的源码只导出 `inject` 与 `apply`。
 *
 * 面板入口是根作用域的侧栏导航行（`sidebar.panellist`，order 50），点击后
 * 在主内容区整页打开（`main` keyed slot），不再是弹层。面板默认定位到
 * 当前会话的工作区，顶部左侧下拉框可切换到其它已注册工作区。
 *
 * @module dsh-workspace-skill-mcp/client
 */
/** 客户端强依赖的服务。 */
export declare const inject: string[];
/** 客户端插件主体：注入样式、注册 locale、构造传输适配器、注册侧栏入口。 */
export declare function apply(ctx: any): void;
