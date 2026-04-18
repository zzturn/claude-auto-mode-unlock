# Claude Code Unlocker

解除 Claude Code CLI 的功能限制，使**所有 API 代理和模型**都能使用全部功能。

支持 OpenRouter、bigmodel.cn、AWS Bedrock、自建 Anthropic 兼容 API 等第三方代理。

本项目包含两个独立的补丁工具：

- **`claude-auto-mode-patcher.mjs`** — 解锁 auto 模式，无需逐条确认权限，自动执行。
- **`claude-buddy-patcher.mjs`** — 解锁 buddy 互动功能，小伙伴用你配置的 haiku 模型发表评论。

## 环境要求

- **Claude Code CLI**（精确匹配已支持版本）
- Node.js 18+
- **Windows / macOS / Linux**

## 支持版本

| 版本 | 平台 | 状态 |
|------|------|------|
| v2.1.92 | Windows | 已验证 |
| v2.1.96 | macOS/Linux | 已验证 |
| v2.1.104 | Windows | 已验证 |
| v2.1.105 | Windows | 已验证 |
| v2.1.109 | Windows | 已验证 |

**版本匹配策略**：精确匹配，不支持回退。每个版本的混淆变量名不同，补丁无法跨版本复用。不支持的版本会直接报错。

## 快速开始

```bash
git clone https://github.com/zzturn/claude-auto-mode-unlock.git
cd claude-auto-mode-unlock

node claude-auto-mode-patcher.mjs    # auto mode 补丁
node claude-buddy-patcher.mjs        # buddy 补丁
```

---

## Auto Mode 补丁

解锁 auto 模式，自动执行无需逐条确认。

### 用法

```bash
# 应用补丁
node claude-auto-mode-patcher.mjs

# 检查补丁状态
node claude-auto-mode-patcher.mjs --check

# 恢复原始文件
node claude-auto-mode-patcher.mjs --restore

# 手动指定路径
CLAUDE_BIN=/path/to/claude node claude-auto-mode-patcher.mjs   # macOS/Linux
set CLAUDE_BIN=C:\path\to\cli.js && node claude-auto-mode-patcher.mjs  # Windows
```

### 使用

```bash
claude --permission-mode auto    # 启动时启用
# 或在会话中按 Shift+Tab 切换
```

### 别名配置（推荐）

补丁后每次启动都需要加 `--permission-mode auto` 参数。可以通过别名简化操作：

#### Windows（npm 全局安装）

在 PowerShell 中创建持久别名：

```powershell
# 添加到 $PROFILE 文件，每次启动 PowerShell 自动生效
Add-Content $PROFILE 'function claude-auto { claude --permission-mode auto @args }'
# 重新加载配置
. $PROFILE

# 使用
claude-auto          # 等同于 claude --permission-mode auto
claude-auto chat     # 等同于 claude --permission-mode auto chat
```

或者使用 CMD 的 `doskey`（仅当前会话有效）：

```cmd
doskey claude-auto=claude --permission-mode auto $*
```

#### Windows（Volta 管理安装）

Volta 安装的 `claude` 命令路径不同，需要确保 shim 正常工作：

```powershell
# 确认 volta 能找到 claude
volta which claude

# 同样添加 PowerShell 函数到 $PROFILE
Add-Content $PROFILE 'function claude-auto { claude --permission-mode auto @args }'
. $PROFILE

# 使用
claude-auto
```

> 如果 Volta shim 丢失，重新链接：`volta pin claude` 或 `npm install -g @anthropic-ai/claude-code`

#### Linux / macOS（Bash）

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'alias claude-auto="claude --permission-mode auto"' >> ~/.bashrc
source ~/.bashrc

# 使用
claude-auto
claude-auto --model claude-sonnet-4-6-20250514
```

#### 跨平台通用（npm script）

在项目 `package.json` 中添加：

```json
{
  "scripts": {
    "claude": "claude --permission-mode auto"
  }
}
```

```bash
npm run claude
# 带参数
npm run claude -- chat
```

### 原理

Claude Code 使用 [Bun](https://bun.sh/) 编译为独立二进制文件（Windows 为 npm 安装的 `cli.js`），JavaScript 源码以明文嵌入。本脚本通过**等长字节替换**修改 7 个权限检查函数：

| # | 目标 | 效果 |
|---|------|------|
| 1 | `modelSupportsAutoMode` — provider 检查 | 绕过 firstParty/anthropicAws 限制 |
| 2 | `modelSupportsAutoMode` — model 正则（外层返回值） | 修改函数尾部 `return!1` → `return!0` |
| 3 | `modelSupportsAutoMode` — model 正则（内层返回值） | `return regex.test(K)` → `return!0`，确保非 Claude 模型通过 |
| 4 | `isAutoModeGateEnabled` | 始终返回 `true` |
| 5 | `isAutoModeCircuitBroken` | 始终返回 `false` |
| 6 | `verifyAutoModeGateAccess` | 强制走 happy path |
| 7 | `carouselAvailable` | 始终为 `true`（Shift+Tab 可切换） |

> **v2.1.105 新增 `model-return` 补丁**：早期版本仅修改了 `modelSupportsAutoMode` 函数外层的 `return!1`，但内层的 `return/^claude-(opus|sonnet)-4-6/.test(K)` 会先执行并直接返回结果，导致外层修改永远不会生效。非 Claude 模型（如 glm-5.1）因此被误拒。新增的 `model-return` 补丁直接将内层正则返回替换为 `return!0`，从根源解决了此问题。

### 版本差异示例

每个版本的 7 个补丁点结构相同，仅混淆变量名不同。以 gate-enabled 补丁为例：

```javascript
// v2.1.92
function ty(){if(cv?.isAutoModeCircuitBroken()??!1)return!1;...}
// v2.1.96
function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!1;...}
// v2.1.104
function qL(){if(IV?.isAutoModeCircuitBroken()??!1)return!1;...}
// v2.1.105
function DL(){if(Lf?.isAutoModeCircuitBroken()??!1)return!1;...}
```

> **注意**：v2.1.105 的 `circuit-broken` 补丁结构有变化，从 `return <variable>` 改为 `return <object>.circuitBroken`，补丁已适配。

---

## Buddy 补丁

解锁 buddy companion 互动功能。小伙伴会用你配置的 haiku 模型（`ANTHROPIC_DEFAULT_HAIKU_MODEL`）发表评论。

### 用法

```bash
node claude-buddy-patcher.mjs           # 应用
node claude-buddy-patcher.mjs --check   # 检查状态
node claude-buddy-patcher.mjs --analyze # 诊断分析（不改文件）
node claude-buddy-patcher.mjs --restore # 恢复
CLAUDE_BIN=/path/to/claude node claude-buddy-patcher.mjs  # 指定路径
```

### 使用

在 Claude Code 中输入 `/buddy` 孵化小伙伴：

| 命令 | 作用 |
|------|------|
| `/buddy` | 孵化一个小伙伴 |
| `/buddy pet` | 摸摸它，触发反应 |
| `/buddy off` | 关闭小伙伴评论 |
| `/buddy on` | 重新开启 |

### 原理

基于源码分析的 5 阶段 patching：

1. **LOCATE** — 通过函数签名锚点定位 `Fa_`（buddyReact）函数
2. **VALIDATE** — 用 3 个源码派生的结构验证器确认目标正确
3. **BOUNDARY** — 花括号平衡扫描确定函数边界（支持正则字面量、模板字面量）
4. **REPLACE** — 动态生成等长本地 LLM 替换（含 JS 语法验证）
5. **VERIFY** — 补丁后完整性验证

原始 `Fa_` 有 4 层门控（auth provider、rate limit、org UUID、OAuth token），最终调用远程 API。补丁替换整个函数体，使用与 `wE7`（companion 生成）相同的 `Y0`/`ZP()` 本地 LLM 调用模式，直接用配置的 haiku 模型生成 reaction。

---

## 项目文件

| 文件 | 说明 |
|------|------|
| `claude-auto-mode-patcher.mjs` | Auto mode 补丁脚本 |
| `claude-buddy-patcher.mjs` | Buddy 补丁脚本 |
| `buddy-source-extracted.js` | 从二进制提取并标注的 buddy 系统源码 |
| `GUIDE.md` | 详细使用说明 |
| `METHODOLOGY.md` | 源码驱动的二进制 Patch 方法论文档 |

## 恢复原版

```bash
node claude-buddy-patcher.mjs --restore
node claude-auto-mode-patcher.mjs --restore
```

## 安全性

- 补丁前自动创建带版本号的备份文件（`.auto-mode-backup` / `.buddy-backup`）
- 所有替换严格等长，不破坏文件结构
- macOS 上自动执行 `codesign --force --sign -` 重新签名
- Windows 无需签名
- 可通过 `--restore` 完全恢复原始文件

## 添加新版本支持

当 Claude Code 更新到未支持的新版本时，脚本会报错并提示不支持的版本。需要手动添加：

### 步骤

1. 安装新版本 Claude Code
2. 在目标文件中搜索 7 个补丁点的混淆变量名
3. 在 `VERSION_PATCHES` 中添加新版本条目

### 搜索命令

```bash
# 设置目标文件路径
CLI="node_modules/@anthropic-ai/claude-code/cli.js"  # Windows npm
# CLI="$(readlink -f ~/.local/bin/claude)"            # macOS

# 1. provider 检查
grep -oP 'if\([A-Za-z0-9_]+!=="firstParty"&&[A-Za-z0-9_]+!=="anthropicAws"\)return!1' "$CLI"

# 2. model 正则（外层返回值）
grep -oP 'claude-\(opus\|sonnet\)-4-6/\.test\([A-Za-z0-9_]+\)\}return!1\}' "$CLI"

# 2.5 model 正则（内层返回值）— v2.1.105+ 新增
grep -oP 'return/\^claude-\(opus\|sonnet\)-4-6/\.test\([A-Za-z0-9_]+\)' "$CLI"

# 3. gate 函数
grep -oP 'function [a-zA-Z0-9_]+\(\)\{if\([a-zA-Z0-9_]+\?\.isAutoModeCircuitBroken\(\)\?\?!1\)return!1;if\([a-zA-Z0-9_]+\(\)\)return!1;if\(![a-zA-Z0-9_]+\([a-zA-Z0-9_]+\(\)\)\)return!1;return!0\}' "$CLI"

# 4. circuit-broken 函数
grep -oP 'isAutoModeCircuitBroken:\(\)=>[a-zA-Z0-9_]+' "$CLI"
# 然后用输出的函数名搜索完整定义
# grep -oP 'function FUNCNAME\(\)\{return [a-zA-Z0-9_]+\}' "$CLI"

# 5. can-enter
grep -oP 'if\([a-zA-Z0-9_]+\)return\{updateContext:\([^)]+\)=>[^}]+\};let [a-zA-Z0-9_]+;' "$CLI"

# 6. carousel
grep -oP '[A-Za-z0-9_]+=!1;if\([A-Za-z0-9_]+!=="disabled"&&[^;]+' "$CLI" | grep enabled
```

## 注意事项

- **版本必须精确匹配**：每个版本的混淆变量名不同，不支持跨版本回退
- **升级后需重新打补丁**：Claude Code 更新会替换文件，需重新运行脚本
- **auto 模式安全分类器仍生效**：仅解除入口限制，`classifyYoloAction` 仍会评估安全性

## 常见问题

<details>
<summary>提示 "vX.Y.Z is not supported"</summary>

当前安装的 Claude Code 版本尚未添加补丁支持。参考上方「添加新版本支持」章节手动添加。
</details>

<details>
<summary>脚本显示 "SKIP" 或 "No patches applied"</summary>

二进制可能已被补丁（运行 `--check` 查看），或版本不在支持列表中。
</details>

<details>
<summary>补丁后 claude 命令无法启动</summary>

```bash
node claude-auto-mode-patcher.mjs --restore
# 或
node claude-buddy-patcher.mjs --restore
```
</details>

<details>
<summary>Windows 上找不到目标文件</summary>

设置环境变量手动指定：
```cmd
set CLAUDE_BIN=C:\Users\你的用户名\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js
node claude-auto-mode-patcher.mjs
```
</details>

<details>
<summary>macOS 上 codesign 失败</summary>

```bash
codesign --force --sign - "$(node -e 'console.log(require("fs").realpathSync(process.argv[1]))' ~/.local/bin/claude)"
```
</details>

<details>
<summary>Buddy 不说话？</summary>

反应有 30 秒冷却，需要足够对话上下文。叫它名字或 `/buddy pet` 可触发。
</details>

## License

MIT
