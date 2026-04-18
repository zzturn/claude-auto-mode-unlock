#!/usr/bin/env node
/**
 * Claude Code Auto Mode Patcher
 *
 * Cross-platform patcher with version-aware patch selection.
 * Supports Windows, macOS, and Linux.
 *
 * Usage:
 *   node claude-auto-mode-patcher.mjs           # Apply patches
 *   node claude-auto-mode-patcher.mjs --check   # Check patch status
 *   node claude-auto-mode-patcher.mjs --restore # Restore original
 *
 * How it works:
 *   Claude Code embeds minified JavaScript in a single file (Bun-compiled
 *   binary on macOS/Linux, or cli.js via npm on Windows). This script finds
 *   specific permission-check functions and applies same-length byte
 *   replacements (changing !1 to !0) to bypass the auto mode gate checks.
 *
 * Patches applied:
 *   1. modelSupportsAutoMode: Bypass provider check (firstParty/anthropicAws)
 *   2. modelSupportsAutoMode: Bypass model regex check (claude-opus/sonnet-4-6)
 *   3. isAutoModeGateEnabled: Always return true
 *   4. isAutoModeCircuitBroken: Always return false
 *   5. verifyAutoModeGateAccess: Force canEnterAuto happy path
 *   6. carouselAvailable: Always true (enables Shift+Tab cycling)
 */

import {
  readFileSync, writeFileSync, copyFileSync,
  existsSync, unlinkSync, realpathSync, lstatSync,
  readdirSync,
} from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { execSync } from 'node:child_process'

const IS_WINDOWS = process.platform === 'win32'

// ---------------------------------------------------------------------------
// Version-specific patch definitions
// ---------------------------------------------------------------------------
// Each Claude Code version has different obfuscated variable names.
// Patches are organized by version. search.length MUST equal replace.length.

const VERSION_PATCHES = {
  '2.1.92': [
    {
      id: 'provider-check',
      desc: 'modelSupportsAutoMode — bypass provider check',
      search:  'if(Y!=="firstParty"&&Y!=="anthropicAws")return!1',
      replace: 'if(Y!=="firstParty"&&Y!=="anthropicAws")return!0',
    },
    {
      id: 'model-regex',
      desc: 'modelSupportsAutoMode — bypass model regex check',
      search:  '/^claude-(opus|sonnet)-4-6/.test(K)}return!1}',
      replace: '/^claude-(opus|sonnet)-4-6/.test(K)}return!0}',
    },
    {
      id: 'gate-enabled',
      desc: 'isAutoModeGateEnabled — always return true',
      search:  'function ty(){if(cv?.isAutoModeCircuitBroken()??!1)return!1;if(gK7())return!1;if(!Nv6(D5()))return!1;return!0}',
      replace: 'function ty(){if(cv?.isAutoModeCircuitBroken()??!1)return!0;if(gK7())return!0;if(!Nv6(D5()))return!0;return!0}',
    },
    {
      id: 'circuit-broken',
      desc: 'isAutoModeCircuitBroken — always return false',
      search:  'function w9Y(){return Q17}',
      replace: 'function w9Y(){return !1;}',
    },
    {
      id: 'can-enter',
      desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
      search:  'if(j)return{updateContext:(G)=>J(G,w)};let M;',
      replace: 'if(1)return{updateContext:(G)=>J(G,w)};let M;',
    },
    {
      id: 'carousel',
      desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
      search:  'w=!1;if(z!=="disabled"&&!Y&&$)w=z==="enabled"||mU8()',
      replace: 'w=!0;if(z!=="disabled"&&!Y&&$)w=z==="enabled"||mU8()',
    },
  ],
  '2.1.104': [
    {
      id: 'provider-check',
      desc: 'modelSupportsAutoMode — bypass provider check',
      search:  'if(Y!=="firstParty"&&Y!=="anthropicAws")return!1',
      replace: 'if(Y!=="firstParty"&&Y!=="anthropicAws")return!0',
    },
    {
      id: 'model-regex',
      desc: 'modelSupportsAutoMode — bypass model regex check',
      search:  '/^claude-(opus|sonnet)-4-6/.test(K)}return!1}',
      replace: '/^claude-(opus|sonnet)-4-6/.test(K)}return!0}',
    },
    {
      id: 'gate-enabled',
      desc: 'isAutoModeGateEnabled — always return true',
      search:  'function qL(){if(IV?.isAutoModeCircuitBroken()??!1)return!1;if(s_7())return!1;if(!yv6(uK()))return!1;return!0}',
      replace: 'function qL(){if(IV?.isAutoModeCircuitBroken()??!1)return!0;if(s_7())return!0;if(!yv6(uK()))return!0;return!0}',
    },
    {
      id: 'circuit-broken',
      desc: 'isAutoModeCircuitBroken — always return false',
      search:  'function _MY(){return b57}',
      replace: 'function _MY(){return !1;}',
    },
    {
      id: 'can-enter',
      desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
      search:  'if(j)return{updateContext:(f)=>J(f,$)};let X;',
      replace: 'if(1)return{updateContext:(f)=>J(f,$)};let X;',
    },
    {
      id: 'carousel',
      desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
      search:  '$=!1;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||ql8()',
      replace: '$=!0;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||ql8()',
    },
  ],
  '2.1.105': [
    {
      id: 'provider-check',
      desc: 'modelSupportsAutoMode — bypass provider check',
      search:  'if(Y!=="firstParty"&&Y!=="anthropicAws")return!1',
      replace: 'if(Y!=="firstParty"&&Y!=="anthropicAws")return!0',
    },
    {
      id: 'model-regex',
      desc: 'modelSupportsAutoMode — bypass model regex check',
      search:  '/^claude-(opus|sonnet)-4-6/.test(K)}return!1}',
      replace: '/^claude-(opus|sonnet)-4-6/.test(K)}return!0}',
    },
    {
      id: 'model-return',
      desc: 'modelSupportsAutoMode — regex return always true',
      search:  'return/^claude-(opus|sonnet)-4-6/.test(K)',
      replace: 'return!0                                 ',
    },
    {
      id: 'gate-enabled',
      desc: 'isAutoModeGateEnabled — always return true',
      search:  'function DL(){if(Lf?.isAutoModeCircuitBroken()??!1)return!1;if(fY7())return!1;if(!Nk6(M5()))return!1;return!0}',
      replace: 'function DL(){if(Lf?.isAutoModeCircuitBroken()??!1)return!0;if(fY7())return!0;if(!Nk6(M5()))return!0;return!0}',
    },
    {
      id: 'circuit-broken',
      desc: 'isAutoModeCircuitBroken — always return false',
      search:  'function xHY(){return IM6.circuitBroken}',
      replace: 'function xHY(){return !1               }',
    },
    {
      id: 'can-enter',
      desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
      search:  'if(j)return{updateContext:(G)=>J(G,$)};let X;',
      replace: 'if(1)return{updateContext:(G)=>J(G,$)};let X;',
    },
    {
      id: 'carousel',
      desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
      search:  '$=!1;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||Zn8()',
      replace: '$=!0;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||Zn8()',
    },
  ],
  '2.1.109': [
    {
      id: 'provider-check',
      desc: 'modelSupportsAutoMode — bypass provider check',
      search:  'if(Y!=="firstParty"&&Y!=="anthropicAws")return!1',
      replace: 'if(Y!=="firstParty"&&Y!=="anthropicAws")return!0',
    },
    {
      id: 'model-regex',
      desc: 'modelSupportsAutoMode — bypass model regex check',
      search:  '/^claude-(opus|sonnet)-4-6/.test(K)}return!1}',
      replace: '/^claude-(opus|sonnet)-4-6/.test(K)}return!0}',
    },
    {
      id: 'model-return',
      desc: 'modelSupportsAutoMode — regex return always true',
      search:  'return/^claude-(opus|sonnet)-4-6/.test(K)',
      replace: 'return!0                                 ',
    },
    {
      id: 'gate-enabled',
      desc: 'isAutoModeGateEnabled — always return true',
      search:  'function KL(){if(MG?.isAutoModeCircuitBroken()??!1)return!1;if(Jz7())return!1;if(!zV6(D5()))return!1;return!0}',
      replace: 'function KL(){if(MG?.isAutoModeCircuitBroken()??!1)return!0;if(Jz7())return!0;if(!zV6(D5()))return!0;return!0}',
    },
    {
      id: 'circuit-broken',
      desc: 'isAutoModeCircuitBroken — always return false',
      search:  'function lAY(){return $M6.circuitBroken}',
      replace: 'function lAY(){return !1               }',
    },
    {
      id: 'can-enter',
      desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
      search:  'if(j)return{updateContext:(f)=>J(f,$)};let X;',
      replace: 'if(1)return{updateContext:(f)=>J(f,$)};let X;',
    },
    {
      id: 'carousel',
      desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
      search:  '$=!1;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||fl8()',
      replace: '$=!0;if(z!=="disabled"&&!Y&&w)$=z==="enabled"||fl8()',
    },
  ],
  '2.1.96': [
    {
      id: 'provider-check',
      desc: 'modelSupportsAutoMode — bypass provider check',
      search:  'if(O!=="firstParty"&&O!=="anthropicAws")return!1',
      replace: 'if(O!=="firstParty"&&O!=="anthropicAws")return!0',
    },
    {
      id: 'model-regex',
      desc: 'modelSupportsAutoMode — bypass model regex check',
      search:  '/^claude-(opus|sonnet)-4-6/.test(_)}return!1}',
      replace: '/^claude-(opus|sonnet)-4-6/.test(_)}return!0}',
    },
    {
      id: 'gate-enabled',
      desc: 'isAutoModeGateEnabled — always return true',
      search:  'function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!1;if(g98())return!1;if(!RZH(OK()))return!1;return!0}',
      replace: 'function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!0;if(g98())return!0;if(!RZH(OK()))return!0;return!0}',
    },
    {
      id: 'circuit-broken',
      desc: 'isAutoModeCircuitBroken — always return false',
      search:  'function pn1(){return r_8}',
      replace: 'function pn1(){return !1;}',
    },
    {
      id: 'can-enter',
      desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
      search:  'if(w)return{updateContext:(R)=>f(R,A)};let j;',
      replace: 'if(1)return{updateContext:(R)=>f(R,A)};let j;',
    },
    {
      id: 'carousel',
      desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
      search:  'A=!1;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()',
      replace: 'A=!0;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()',
    },
  ],
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const mode = process.argv[2] || '--patch'

if (mode === '--help' || mode === '-h') {
  const versions = Object.keys(VERSION_PATCHES).sort(compareVersions)
  console.log(`
Claude Code Auto Mode Patcher

Usage:
  node claude-auto-mode-patcher.mjs           Apply patches
  node claude-auto-mode-patcher.mjs --check   Check current patch status
  node claude-auto-mode-patcher.mjs --restore Restore original binary

Environment:
  CLAUDE_BIN=<path>   Path to claude binary or cli.js (auto-detected if not set)

Supported versions (exact match): ${versions.join(', ')}
`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Version utilities
// ---------------------------------------------------------------------------

function parseVersion(v) {
  return v.split('.').map(Number)
}

function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

/**
 * Get patches for an exact version match.
 * Each version has unique obfuscated variable names — no fallback.
 */
function getPatchesForVersion(version) {
  return VERSION_PATCHES[version] ?? null
}

// ---------------------------------------------------------------------------
// Target file detection
// ---------------------------------------------------------------------------

function findTargetFile() {
  if (process.env.CLAUDE_BIN) {
    let p = resolve(process.env.CLAUDE_BIN)
    // Resolve symlink if applicable
    try {
      if (lstatSync(p).isSymbolicLink()) p = realpathSync(p)
    } catch { /* ignore */ }
    return p
  }

  return IS_WINDOWS ? findTargetWindows() : findTargetUnix()
}

function findTargetWindows() {
  const candidates = []

  // 1. Parse `where claude` output to find cli.js
  try {
    const where = execSync('where claude 2>nul', { encoding: 'utf8' }).trim()
    for (const line of where.split(/\r?\n/)) {
      const cmdPath = line.trim()
      if (cmdPath.endsWith('.cmd')) {
        const jsPath = resolveCliJsFromCmd(cmdPath)
        if (jsPath && existsSync(jsPath)) candidates.unshift(jsPath)
      }
    }
  } catch { /* where failed */ }

  // 2. Common npm global paths
  const appData = process.env.APPDATA || ''
  const localAppData = process.env.LOCALAPPDATA || ''
  const home = process.env.USERPROFILE || process.env.HOME || ''

  if (appData) {
    candidates.push(
      join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    )
  }

  // 3. Volta
  if (localAppData) {
    const voltaDir = join(localAppData, 'Volta', 'tools', 'image', 'node')
    if (existsSync(voltaDir)) {
      try {
        for (const ver of readdirSync(voltaDir)) {
          candidates.push(
            join(voltaDir, ver, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
          )
        }
      } catch { /* ignore */ }
    }
  }

  // 4. Home-based paths
  candidates.push(join(home, '.claude', 'local', 'claude-code', 'cli.js'))

  for (const p of candidates) {
    if (existsSync(p)) return resolve(p)
  }

  console.error(
    'Could not auto-detect Claude Code on Windows.\n' +
    'Set CLAUDE_BIN=<path\\to\\cli.js> environment variable.',
  )
  process.exit(1)
}

function resolveCliJsFromCmd(cmdPath) {
  try {
    const content = readFileSync(cmdPath, 'utf8')
    if (content.includes('node_modules') && content.includes('claude-code') && content.includes('cli.js')) {
      const cmdDir = dirname(cmdPath)
      // Walk up from .cmd location to find node_modules
      // Pattern: "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js"
      let dir = cmdDir
      for (let i = 0; i < 5; i++) {
        const candidate = join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
        if (existsSync(candidate)) return candidate
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    }
  } catch { /* ignore */ }
  return null
}

function findTargetUnix() {
  const candidates = [
    '/usr/local/bin/claude',
    `${process.env.HOME}/.local/bin/claude`,
  ]

  // Try `which claude` (skip aliases)
  try {
    const which = execSync('command -v claude 2>/dev/null || true', {
      encoding: 'utf8',
      shell: '/bin/bash',
    }).trim()
    if (which && !which.includes('alias')) {
      candidates.unshift(which)
    }
  } catch {
    // ignore
  }

  for (let path of candidates) {
    path = resolve(path)
    if (!existsSync(path)) continue

    // Resolve symlink (claude -> ~/.local/share/claude/versions/X.Y.Z)
    try {
      if (lstatSync(path).isSymbolicLink()) {
        path = realpathSync(path)
      }
    } catch { /* ignore */ }

    if (existsSync(path)) return path
  }

  console.error(
    'Could not auto-detect claude binary. Set CLAUDE_BIN=/path/to/claude',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------

function detectVersion(filePath) {
  // Method 1: Search for "// Version: X.Y.Z" in file content
  try {
    const content = readFileSync(filePath, 'utf8')
    const match = content.match(/\/\/ Version: (\d+\.\d+\.\d+)/)
    if (match) return match[1]
  } catch { /* ignore */ }

  // Method 2: Read package.json next to the file (npm installs)
  const pkgPath = join(dirname(filePath), 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.version) return pkg.version
    } catch { /* ignore */ }
  }

  return null
}

// ---------------------------------------------------------------------------
// Patch operations
// ---------------------------------------------------------------------------

function applyPatches(patches, backupPath) {
  // Create backup
  if (!existsSync(backupPath)) {
    console.log('Creating backup...')
    copyFileSync(TARGET_FILE, backupPath)
    console.log(`  Backup: ${backupPath}`)
  } else {
    console.log('Backup already exists, skipping.')
  }

  // Read file
  let data = readFileSync(TARGET_FILE)
  let patchCount = 0

  for (const patch of patches) {
    // Validate lengths
    if (patch.search.length !== patch.replace.length) {
      console.error(
        `FATAL: Length mismatch for ${patch.id}: ` +
        `search=${patch.search.length} replace=${patch.replace.length}`,
      )
      process.exit(1)
    }

    const searchBuf = Buffer.from(patch.search, 'utf8')
    const replaceBuf = Buffer.from(patch.replace, 'utf8')

    // Find all occurrences
    const indices = findAllOccurrences(data, searchBuf)

    if (indices.length === 0) {
      console.log(`  SKIP [${patch.id}]: pattern not found (may already be patched or version changed)`)
      continue
    }

    if (indices.length > 1) {
      console.warn(
        `  WARN [${patch.id}]: found ${indices.length} occurrences, patching all`,
      )
    }

    // Apply replacement at each occurrence
    for (const idx of indices) {
      replaceBuf.copy(data, idx)
    }

    console.log(
      `  OK   [${patch.id}]: patched ${indices.length} occurrence(s) — ${patch.desc}`,
    )
    patchCount++
  }

  if (patchCount === 0) {
    console.log('\nNo patches applied. Binary may already be patched or version incompatible.')
    return
  }

  // Write patched file
  writeFileSync(TARGET_FILE, data)

  // Re-sign on macOS
  if (!IS_WINDOWS) {
    console.log('\nRe-signing binary (fixing macOS code signature)...')
    try {
      execSync(`codesign --force --sign - "${TARGET_FILE}"`, {
        stdio: 'pipe',
      })
      console.log('  Code signature updated.')
    } catch {
      console.error('  WARNING: codesign failed. Binary may not launch on macOS.')
      console.error('  Try running: codesign --force --sign - "' + TARGET_FILE + '"')
    }
  }

  console.log(`\nPatched ${patchCount}/${patches.length} patterns successfully.`)
  console.log(`\nYou can now use: claude --permission-mode auto`)
  console.log(`Restore with:    node ${process.argv[1]} --restore`)
}

function checkPatches(patches, backupPath) {
  if (!existsSync(backupPath)) {
    console.log('Status: NOT PATCHED (no backup found)')
    return
  }

  const original = readFileSync(backupPath)
  const current = readFileSync(TARGET_FILE)

  let allPatched = true
  for (const patch of patches) {
    const searchBuf = Buffer.from(patch.search, 'utf8')
    const replaceBuf = Buffer.from(patch.replace, 'utf8')

    const inOriginal = findAllOccurrences(original, searchBuf).length > 0
    const inCurrent = findAllOccurrences(current, replaceBuf).length > 0
    const unpatchedInCurrent = findAllOccurrences(current, searchBuf).length > 0

    if (inCurrent && !unpatchedInCurrent) {
      console.log(`  OK   [${patch.id}]: patched`)
    } else if (unpatchedInCurrent) {
      console.log(`  TODO [${patch.id}]: not patched`)
      allPatched = false
    } else if (!inOriginal && !unpatchedInCurrent) {
      console.log(`  ???  [${patch.id}]: pattern not found in either version`)
    }
  }

  console.log(
    `\nStatus: ${allPatched ? 'ALL PATCHES APPLIED' : 'SOME PATCHES MISSING'}`,
  )
}

function restoreBinary(backupPath) {
  if (!existsSync(backupPath)) {
    console.log(`No backup found at ${backupPath}. Nothing to restore.`)
    return
  }

  console.log('Restoring original...')
  copyFileSync(backupPath, TARGET_FILE)
  unlinkSync(backupPath)

  // Re-sign on macOS after restore
  if (!IS_WINDOWS) {
    try {
      execSync(`codesign --force --sign - "${TARGET_FILE}"`, { stdio: 'pipe' })
      console.log('  Code signature updated.')
    } catch { /* ignore */ }
  }

  console.log('Restored successfully. Backup removed.')
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function findAllOccurrences(buf, search) {
  const indices = []
  let offset = 0
  while (offset < buf.length) {
    const idx = buf.indexOf(search, offset)
    if (idx === -1) break
    indices.push(idx)
    offset = idx + 1
  }
  return indices
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TARGET_FILE = findTargetFile()
// Backup includes version number: cli.js.v2.1.92.auto-mode-backup
function getBackupPath(version) {
  return TARGET_FILE + `.v${version}.auto-mode-backup`
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  console.log('Claude Code Auto Mode Patcher')
  console.log(`Platform: ${IS_WINDOWS ? 'Windows' : process.platform}`)
  console.log(`Target:  ${TARGET_FILE}`)
  console.log()

  if (!existsSync(TARGET_FILE)) {
    console.error(`Error: Target file not found at ${TARGET_FILE}`)
    console.error('Set CLAUDE_BIN environment variable to the correct path.')
    process.exit(1)
  }

  // Detect version
  const version = detectVersion(TARGET_FILE)
  if (!version) {
    console.error('Error: Could not detect Claude Code version.')
    console.error('Ensure the target file is a valid Claude Code binary or cli.js.')
    process.exit(1)
  }
  console.log(`Version: ${version}`)

  const BACKUP_PATH = getBackupPath(version)

  // Exact version match required
  const patches = getPatchesForVersion(version)
  if (!patches) {
    const supported = Object.keys(VERSION_PATCHES).sort(compareVersions)
    console.error(
      `\nError: v${version} is not supported.\n` +
      `Supported versions: ${supported.join(', ')}\n` +
      `Each version has unique obfuscated names — patches cannot be reused across versions.`,
    )
    process.exit(1)
  }

  console.log(`Patches: ${patches.length} patterns\n`)

  switch (mode) {
    case '--check':
      checkPatches(patches, BACKUP_PATH)
      break
    case '--restore':
      restoreBinary(BACKUP_PATH)
      break
    case '--patch':
    default:
      applyPatches(patches, BACKUP_PATH)
      break
  }
}

main()
