# dsh-workspace-skill-mcp

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件：
在 Web GUI 里**可视化管理当前项目的全部能力**——Skills 与 MCP 服务器，
全部收敛到项目级 `.agents` 目录，不离开浏览器即可完成安装、启停与配置。

## 它能做什么

| 能力域 | 浏览/搜索 | 新增/安装 | 编辑 | 启用/禁用 | 删除 | 导入/导出 |
|---|---|---|---|---|---|---|
| **Skills** | ✅ | ✅ 上传 / 技能库 / URL 三种来源 | ✅ | ✅ 项目内启停 + 模型/用户方向独立开关 | ✅ 两击确认 | ✅ 下载 zip / 复制到宿主目录 |
| **MCP 服务器** | ✅ + 实时挂载状态 | ✅ 表单 / JSON 批量 | ✅ | ✅ 写后热重挂 | ✅ | — |

面板默认定位到**当前会话的工作区**；全部工作区在左侧平铺为导航列表，点击即可切换。

## 配置文件位置

| 配置 | 位置 |
|---|---|
| Skills | `<项目根>/.agents/skills`（flat `<name>.md` / 目录型 `<name>/SKILL.md`） |
| MCP 服务器 | `<项目根>/.mcp.json`（Claude Code 兼容格式） |

项目根由 `.git` / `.agents` / `dsh.json` 标记向上探测；用户主目录不会被
误判为项目根。

### 技能库目录（安装来源）

「安装技能 → 预置」列出的条目来自一个宿主预置目录：**只扫描顶层**，
目录下每个 `<name>.md` 或含 `SKILL.md` 的顶层子目录即一个可安装 skill。
配置方式任选其一：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-workspace-skill-mcp
  config:
    skillLibrary: /data/skills
```

或设置环境变量 `DSH_SKILL_LIBRARY=/data/skills`。未配置时该模式会提示
「未配置预置技能目录」。

## 亮点

### 🗂 一个面板，管住两个能力域

侧栏导航区新增「工作区技能」入口（排在「自动化任务」之后，order 50），点击后在
主内容区**整页打开**（不是弹层）。面板顶部在 **Skills / MCP** 两个域之间切换，
两个域都只列当前项目的条目，支持关键词搜索。

### 📥 Skills：三种方式安装，一键导出分享

- **浏览器上传**：拖入单个 `.md`、整个 skill 目录、或 `.zip` 压缩包
  （浏览器端 DecompressionStream 解压，零依赖）；路径防穿越，
  200 文件 / 20MB 上限。
- **预置**：从宿主预置的技能目录勾选一个或多个 skill（支持全选）批量安装（不再手填任意路径）。
- **URL 下载**：GitHub 仓库（可带 `/tree/<branch>/<子目录>`）、任意 `.zip`、
  raw `.md`（宿主端 30MB / 30s 限速）。

压缩包/仓库归档自动剥离公共顶层目录并定位唯一 `SKILL.md`；落盘名以
frontmatter 的 `name` 为准，同名冲突报错、可选覆盖。磁盘格式与官方
filesystem provider **逐字节兼容**，装完立刻可被 agent 调用。

导出同样简单：flat skill 直接下载 `.md`，目录型 skill 在浏览器端打成
store-only zip；也可以复制到宿主任意目录。

### ⚡ 一键启用/禁用，按方向细调调用方式

详情卡上有「已启用 / 已禁用」状态按钮。禁用只写入
`user-invocable: false` + `disable-model-invocation: true` 两个扁平键——
正文与其它元数据原样保留，启用即清除恢复。禁用的 skill 会立刻从宿主的
技能注入链路中消失。

「调用方式」字段上，「模型调用」与「用户调用」两个方向各自独立开关——比如
某个 skill 只希望用户 `/name` 手动触发、不需要 agent 自动注入，关掉
「模型调用」即可。写盘保持最小化，启用即清除对应键。

### 🔌 MCP：改配置即热挂载，不重启、不改 preset

- 配置文件与 **Claude Code 的 `.mcp.json` 格式兼容**：项目级
  `<项目根>/.mcp.json`；`env`/`headers`/`args` 支持 `${VAR}` 环境变量插值。
- host 插件监听 `agent/created`，把启用的 server 逐个挂进 agent 自己的
  Cordis context——工具以 `mcp__<serverName>__<tool>` 出现在**该 session
  内**，按 session 隔离，agent 销毁自动卸载。
- 面板里每次新增/编辑/删除/启停，都会**自动重挂受影响 session** 的
  MCP 连接；状态用行内圆点与标签呈现，详情卡保留完整挂载信息与错误。
- 新增支持「预置」下拉（首批：腾讯文档 MCP，需手动填 mcptoken）、表单逐字段填写，
  或粘贴 `.mcp.json` / 裸服务器映射批量导入。

## 工作原理

```
浏览器客户端                          宿主（host）
┌─────────────────────┐   RPC     ┌──────────────────────────────┐
│ sidebar.footer      │ ────────► │ ctx.capabilityPanel 服务      │
│  └ 工作区技能浮层    │ /capability│  ├ skills        磁盘 CRUD    │
└─────────────────────┘ -panel    │  └ mcp           配置 CRUD +   │
                                   │                  热挂载 loader │
                                   │ agent/created → dsh-mcp-client│
                                   └──────────────────────────────┘
```

- **不重复注册 skills provider**：面板列表直接读 `.agents/skills` 的磁盘
  （与官方 filesystem provider 口径逐字节一致），启停只写 frontmatter
  调用键，由宿主的文件 watcher 原生生效。
- **MCP 按 session 隔离**：挂在 agent 自己的 Cordis context 上，agent
  dispose 即自动卸载；桥接插件取**宿主那份** `@deepseek-ai/dsh-mcp-client`
  实例，同一项目多个 session 各自挂载、互不冲突。
- **UI 纯增量**：侧栏入口注册在宿主的列表槽里，不顶替、不遮蔽任何内置 UI。

## 安装

安装最新 release（推荐，版本钉死）：

```bash
dsh plugin --profile web add github:ltylty/dsh-workspace-skill-mcp
dsh web        # 打开 Web GUI，侧栏底部可见「工作区技能」
```

本地开发（link 安装，改动源码后需重新 `pnpm build`）：

```bash
cd <本仓库路径>
pnpm install
pnpm build
dsh plugin --profile web add "link:<本仓库路径>"
dsh web
```

## 卸载

```bash
dsh plugin --profile web remove dsh-workspace-skill-mcp
```

移除后重新运行 `dsh web` 即可。卸载**不会**触碰你已经管理的任何数据——
`.agents/skills`、`.mcp.json` 等文件全部原样保留，随时可重新安装接管。

## 目录结构

```
src/
  index.ts         宿主插件入口——暴露 ctx.capabilityPanel 服务
  client.ts        客户端插件入口（侧栏入口 + 面板浮层）
  remote.ts        host↔client RPC 接线（endpoint 按域前缀路由）
  shared/          项目根探测 / 文件写锁 / skill 根定位与来源分类（两端共用）
  skills/          skills 域：磁盘读写、CRUD、安装/导出、URL 下载、校验
  mcp/             MCP 域：.mcp.json 读写、agent 自动挂载、写后热重挂
  client/          React 面板（双域）、zip 工具、自含样式
```

## License

[MIT](LICENSE)
