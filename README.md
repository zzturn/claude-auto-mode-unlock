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

- **Claude Code CLI v2.1.96**（补丁基于特定版本，其他版本可能不兼容）
- Node.js 18+
- macOS 或 Linux

## 用法

```bash
# 应用补丁
node claude-auto-mode-patcher.mjs

# 检查补丁状态
node claude-auto-mode-patcher.mjs --check

# 恢复原始二进制
node claude-auto-mode-patcher.mjs --restore

# 手动指定二进制路径
CLAUDE_BIN=/path/to/claude node claude-auto-mode-patcher.mjs
```

## 原理

Claude Code 使用 [Bun](https://bun.sh/) 编译为独立二进制文件，JavaScript 源码以明文形式嵌入在二进制的 `__TEXT` 段中。本脚本通过**等长字节替换**修改特定的权限检查函数，绕过 auto 模式的所有限制条件。

### 补丁列表

| # | 目标 | 效果 |
|---|------|------|
| 1 | `modelSupportsAutoMode` — provider 检查 | 绕过 firstParty/anthropicAws 限制 |
| 2 | `modelSupportsAutoMode` — model 正则 | 绕过 claude-opus/sonnet-4-6 模型名限制 |
| 3 | `isAutoModeGateEnabled` | 始终返回 `true` |
| 4 | `isAutoModeCircuitBroken` | 始终返回 `false` |
| 5 | `verifyAutoModeGateAccess` | 强制走 happy path（绕过异步 GrowthBook 检查） |
| 6 | `carouselAvailable` | 始终为 `true`（使 Shift+Tab 可切换到 auto） |

### 安全性

- 补丁前自动创建 `.auto-mode-backup` 备份文件
- 所有替换严格等长，不会破坏二进制结构
- macOS 上自动执行 `codesign --force --sign -` 重新签名
- 可通过 `--restore` 完全恢复原始二进制

## 注意事项

- **版本绑定**：补丁模式基于 v2.1.96 的混淆后变量名，其他版本可能不兼容
- **升级后需重新打补丁**：Claude Code 更新会替换二进制文件，需重新运行脚本
- **auto 模式行为不变**：本脚本仅解除入口限制，auto 模式的安全分类器（`classifyYoloAction`）仍然会对工具调用进行安全评估

## 常见问题

<details>
<summary>脚本显示 "SKIP" 或 "No patches applied"</summary>

二进制可能已被补丁（运行 `--check` 查看），或者 Claude Code 版本不是 v2.1.96。
</details>

<details>
<summary>补丁后 claude 命令无法启动</summary>

```bash
node claude-auto-mode-patcher.mjs --restore
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
