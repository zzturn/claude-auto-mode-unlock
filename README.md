# Claude Code Auto Mode Unlocker

解除 Claude Code CLI 的 auto 模式限制，使**所有 API 代理和模型**都能使用 auto 模式，不再局限于 Anthropic 官方 API。

支持 OpenRouter、bigmodel.cn、AWS Bedrock、自建 Anthropic 兼容 API 等第三方代理。

## 快速开始

```bash
# 1. 下载脚本
curl -O https://raw.githubusercontent.com/zzturn/claude-auto-mode-unlock/main/claude-auto-mode-patcher.mjs

# 2. 应用补丁
node claude-auto-mode-patcher.mjs

# 3. 使用 auto 模式
claude --permission-mode auto
# 或者启动 claude 后按 Shift+Tab 切换模式
```

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

**版本匹配策略**：精确匹配，不支持回退。每个版本的混淆变量名不同，补丁无法跨版本复用。不支持的版本会直接报错。

## 用法

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

## 原理

Claude Code 将 JavaScript 源码嵌入在单个文件中（macOS/Linux 为 Bun 编译的二进制，Windows 为 npm 安装的 `cli.js`）。本脚本通过**等长字节替换**修改特定的权限检查函数，绕过 auto 模式的所有限制条件。

### 补丁列表

每个版本的 6 个补丁点结构相同，仅混淆变量名不同：

| # | 目标 | 效果 |
|---|------|------|
| 1 | `modelSupportsAutoMode` — provider 检查 | 绕过 firstParty/anthropicAws 限制 |
| 2 | `modelSupportsAutoMode` — model 正则 | 绕过 claude-opus/sonnet-4-6 模型名限制 |
| 3 | `isAutoModeGateEnabled` | 始终返回 `true` |
| 4 | `isAutoModeCircuitBroken` | 始终返回 `false` |
| 5 | `verifyAutoModeGateAccess` | 强制走 happy path（绕过异步 GrowthBook 检查） |
| 6 | `carouselAvailable` | 始终为 `true`（使 Shift+Tab 可切换到 auto） |

### 版本差异示例

以 gate-enabled 补丁为例，每个版本仅混淆名不同：

```javascript
// v2.1.92
function ty(){if(cv?.isAutoModeCircuitBroken()??!1)return!1;...}
// v2.1.96
function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!1;...}
// v2.1.104
function qL(){if(IV?.isAutoModeCircuitBroken()??!1)return!1;...}
```

### 安全性

- 补丁前自动创建带版本号的备份文件（`cli.js.v2.1.104.auto-mode-backup`）
- 所有替换严格等长，不会破坏文件结构
- macOS 上自动执行 `codesign --force --sign -` 重新签名
- Windows 无需签名
- 可通过 `--restore` 完全恢复原始文件

## 添加新版本支持

当 Claude Code 更新到未支持的新版本时，脚本会报错并提示不支持的版本。需要手动添加：

### 步骤

1. 安装新版本 Claude Code
2. 在目标文件中搜索 6 个补丁点的混淆变量名
3. 在 `VERSION_PATCHES` 中添加新版本条目

### 搜索命令

```bash
# 设置目标文件路径
CLI="node_modules/@anthropic-ai/claude-code/cli.js"  # Windows npm
# CLI="$(readlink -f ~/.local/bin/claude)"            # macOS

# 1. provider 检查
grep -oP 'if\([A-Za-z0-9_]+!=="firstParty"&&[A-Za-z0-9_]+!=="anthropicAws"\)return!1' "$CLI"

# 2. model 正则
grep -oP 'claude-\(opus\|sonnet\)-4-6/\.test\([A-Za-z0-9_]+\)\}return!1\}' "$CLI"

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

- **升级后需重新打补丁**：Claude Code 更新会替换文件，需重新运行脚本
- **版本必须精确匹配**：每个版本的混淆变量名不同，不支持跨版本回退
- **auto 模式行为不变**：本脚本仅解除入口限制，auto 模式的安全分类器仍然会对工具调用进行安全评估

## 常见问题

<details>
<summary>提示 "vX.Y.Z is not supported"</summary>

当前安装的 Claude Code 版本尚未添加补丁支持。参考上方「添加新版本支持」章节手动添加。
</details>

<details>
<summary>补丁后 claude 命令无法启动</summary>

```bash
node claude-auto-mode-patcher.mjs --restore
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

手动签名：
```bash
codesign --force --sign - "$(readlink -f ~/.local/bin/claude)"
```
</details>

## License

MIT
