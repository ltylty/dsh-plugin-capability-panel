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
export type RpcResult = { ok: true; value: unknown };

/** 业务失败信封（挂在 RpcResult.value 上）。 */
export interface BusinessFailure {
  ok: false;
  errors: string[];
}

/** 构造一个始终通过通道校验的业务失败响应。 */
function failure(errors: readonly string[]): RpcResult {
  return { ok: true, value: { ok: false, errors: [...errors] } };
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
export async function handleEndpoint(
  service: PanelRpcService,
  endpoint: string,
  payload: unknown,
  _signal?: AbortSignal,
): Promise<RpcResult> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const cwd = typeof p.cwd === "string" ? p.cwd : undefined;
  try {
    switch (endpoint) {
      case "skills.list":
        return { ok: true, value: await service.skills.list(cwd) };
      case "skills.read":
        return { ok: true, value: await service.skills.read(p) };
      case "skills.create":
        return { ok: true, value: await service.skills.create(p) };
      case "skills.update":
        return { ok: true, value: await service.skills.update(p) };
      case "skills.remove":
        return { ok: true, value: await service.skills.remove(p) };
      case "skills.setEnabled":
        return { ok: true, value: await service.skills.setEnabled(p) };
      case "skills.setInvocation":
        return { ok: true, value: await service.skills.setInvocation(p) };
      case "skills.sources":
        return { ok: true, value: await service.skills.sources() };
      case "skills.install":
        return { ok: true, value: await service.skills.install(p) };
      case "skills.export":
        return { ok: true, value: await service.skills.export(p) };
      case "mcp.list":
        return { ok: true, value: await service.mcp.list(cwd) };
      case "mcp.upsert":
        return { ok: true, value: await service.mcp.upsert(p) };
      case "mcp.remove":
        return { ok: true, value: await service.mcp.remove(p) };
      case "mcp.setEnabled":
        return { ok: true, value: await service.mcp.setEnabled(p) };
      case "mcp.status":
        return { ok: true, value: service.mcp.status(cwd) };
      default:
        return failure([`unknown endpoint "${endpoint}"`]);
    }
  } catch (error) {
    return failure([error instanceof Error ? error.message : String(error)]);
  }
}

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
export function mountRpcChannel(ctx: any, service: PanelRpcService) {
  const handler = (endpoint: string, payload: unknown) => handleEndpoint(service, endpoint, payload);

  if (typeof ctx.inject !== "function") {
    ctx.logger?.warn?.("capability-panel: `ctx.inject` unavailable; host RPC channel not mounted");
    return () => undefined;
  }

  let disposeRoute: unknown;
  const stopInject = ctx.inject(["connection", "webServer"], (hostCtx: any) => {
    const connection = hostCtx.connection;
    const webServer = hostCtx.webServer;
    if (connection?.requestRejection === undefined || webServer?.register === undefined) {
      ctx.logger?.warn?.("capability-panel: `connection`/`webServer` unavailable; host RPC channel not mounted");
      return;
    }
    disposeRoute = hostCtx.effect(
      () => webServer.register({ kind: "prefix", path: CHANNEL, handler: createChannelRoute(connection, handler) }),
      `capability-panel: ${CHANNEL} rpc channel`,
    );
  });

  return () => {
    if (typeof disposeRoute === "function") (disposeRoute as () => void)();
    if (typeof stopInject === "function") (stopInject as () => void)();
    else void (stopInject as { dispose?: () => Promise<void> } | undefined)?.dispose?.();
  };
}

/** 通道请求体的字节上限，与 dsh-client-connection 的默认值对齐。 */
const MAX_REQUEST_BODY_BYTES = 300 * 1024 * 1024;

/** endpoint 单段字符集，与宿主 `endpointFromPath` 的校验保持一致。 */
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;

/** 从 `${CHANNEL}/<endpoint>` 抽出 endpoint；路径不合法时返回 undefined。 */
function endpointFromPath(pathname: string): string | undefined {
  if (!pathname.startsWith(`${CHANNEL}/`)) return undefined;
  const endpoint = pathname.slice(CHANNEL.length + 1);
  if (endpoint.split("/").some((segment) => segment === "" || segment === "." || segment === ".." || !ENDPOINT_SEGMENT_PATTERN.test(segment))) {
    return undefined;
  }
  return endpoint;
}

/**
 * 组装通道的 node:http 处理函数：先过信任/认证闸门，再解析
 * `{ type: "client-request", rpcId, method, payload }`，最后以
 * `{ type: "server-response", rpcId, result }` 回写。
 */
function createChannelRoute(connection: any, handler: (endpoint: string, payload: unknown) => Promise<RpcResult>) {
  const respond = (res: any, body: unknown) => {
    const payload = JSON.stringify(body);
    res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
    res.end(payload);
  };

  const badRequest = (res: any, rpcId: unknown, message: string) =>
    respond(res, {
      type: "server-response",
      rpcId: typeof rpcId === "string" ? rpcId : "invalid-request",
      result: { ok: false, error: { code: "gateway/bad-request", message, details: { issues: [] } } },
    });

  return async (req: any, res: any) => {
    const rejection = connection.requestRejection(req);
    if (rejection !== undefined) {
      res.writeHead(rejection);
      res.end(rejection === 401 ? "unauthorized" : "forbidden");
      return;
    }

    const endpoint = endpointFromPath(new URL(req.url ?? "/", "http://dsh.internal").pathname);
    if (req.method !== "POST" || endpoint === undefined) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      res.writeHead(415);
      res.end("content type must be application/json");
      return;
    }

    const declared = req.headers["content-length"];
    if (declared !== undefined && Number(declared) > MAX_REQUEST_BODY_BYTES) {
      res.writeHead(413, { connection: "close" });
      res.end();
      req.destroy();
      return;
    }
    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of req) {
      const buffer = chunk as Buffer;
      received += buffer.byteLength;
      if (received > MAX_REQUEST_BODY_BYTES) {
        res.writeHead(413, { connection: "close" });
        res.end();
        req.destroy();
        return;
      }
      chunks.push(buffer);
    }

    let body: any;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      res.writeHead(400);
      res.end("body is not JSON");
      return;
    }

    if (body === null || typeof body !== "object" || body.type !== "client-request" || typeof body.rpcId !== "string" || typeof body.method !== "string") {
      badRequest(res, body?.rpcId, "invalid client-request message");
      return;
    }
    if (body.method !== endpoint) {
      badRequest(res, body.rpcId, `method ${JSON.stringify(body.method)} does not match endpoint ${JSON.stringify(endpoint)}`);
      return;
    }

    try {
      respond(res, { type: "server-response", rpcId: body.rpcId, result: await handler(endpoint, body.payload) });
    } catch (error) {
      res.writeHead(500);
      res.end(`handler failure: ${String(error)}`);
    }
  };
}
