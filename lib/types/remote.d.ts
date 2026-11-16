/**
 * 宿主端 ⇄ 客户端传输接线：走连接服务的泛型 RPC 通道。
 *
 *   - 宿主端：在 `webServer` 上挂 `/capability-panel` 前缀路由；
 *   - 客户端：`ctx.get("connection").rpc.call("/capability-panel", endpoint, payload, signal)`。
 *
 * handler 签名是 `(endpoint, payload, signal) -> value`。endpoint 按域前缀
 * 命名：`skills.*` / `mcp.*`，二者都只作用于当前工作区的项目级配置。
 * 所有返回值统一包一层 {@link RpcResult} 信封。
 *
 * @module dsh-workspace-skill-mcp/remote
 */
import { CHANNEL } from "./channel.js";
export { CHANNEL };
/**
 * RPC 通道的业务信封。
 *
 * 传输层**恒为 `{ ok: true }`**：连接通道对每个服务器响应做 zod 校验，
 * 插件的通用失败不属于宿主 RpcError 的判别联合，因此失败一律包成业务
 * 信封 `{ ok: true, value: { ok: false, errors } }`，由客户端适配器
 * （api-adapter）归一。
 */
export type RpcResult = {
    ok: true;
    value: unknown;
};
/** 业务失败信封（挂在 RpcResult.value 上）。 */
export interface BusinessFailure {
    ok: false;
    errors: string[];
}
/** 被路由的服务形状（各域的方法签名）。 */
export interface PanelRpcService {
    skills: {
        list(cwd?: string): Promise<unknown>;
        read(input: unknown): Promise<unknown>;
        create(input: unknown): Promise<unknown>;
        update(input: unknown): Promise<unknown>;
        remove(input: unknown): Promise<unknown>;
        setEnabled(input: unknown): Promise<unknown>;
        setInvocation(input: unknown): Promise<unknown>;
        sources(): Promise<unknown>;
        install(input: unknown): Promise<unknown>;
        export(input: unknown): Promise<unknown>;
    };
    mcp: {
        list(cwd?: string): Promise<unknown>;
        upsert(input: unknown): Promise<unknown>;
        remove(input: unknown): Promise<unknown>;
        setEnabled(input: unknown): Promise<unknown>;
        status(cwd?: string): unknown;
    };
}
/**
 * 把 `(endpoint, payload)` 路由到服务并规范化结果。
 * 从 payload 里解析可选的 `cwd`（限定项目作用域）。
 */
export declare function handleEndpoint(service: PanelRpcService, endpoint: string, payload: unknown, _signal?: AbortSignal): Promise<RpcResult>;
/**
 * 挂载插件自有的 HTTP RPC 通道。
 *
 * 不用 `connection.rpc.handle(...)`（当前宿主实现里它的 owner 解析成
 * connection 自己的 ctx，缺 `webServer` inject，会恒定抛错），改用三个
 * 公开 API：
 *
 *   - `ctx.inject(["connection", "webServer"], ...)`：等两端服务就位再挂；
 *   - `connection.requestRejection(req)`：Host/Origin 信任 + 会话认证；
 *   - `webServer.register({ kind: "prefix", path: CHANNEL, handler })`：前缀路由。
 *
 * 线上信封与 `dsh-client-connection` 客户端一致：请求
 * `{ type: "client-request", rpcId, method, payload }`，响应
 * `{ type: "server-response", rpcId, result }`。
 */
export declare function mountRpcChannel(ctx: any, service: PanelRpcService): () => void;
