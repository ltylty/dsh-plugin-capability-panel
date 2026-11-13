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
export {};
