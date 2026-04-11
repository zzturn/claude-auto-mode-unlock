#!/usr/bin/env node
/**
 * Claude Code Auto Mode Patcher
 *
 * Patches the compiled Claude Code binary to enable auto mode for ALL
 * providers and models (not just firstParty Anthropic API).
 *
 * Usage:
 *   node claude-auto-mode-patcher.mjs           # Apply patches
 *   node claude-auto-mode-patcher.mjs --check   # Check patch status
 *   node claude-auto-mode-patcher.mjs --restore # Restore original binary
 *
 * How it works:
 *   The Bun-compiled binary embeds JavaScript source as plaintext.
 *   This script finds specific permission-check functions and applies
 *   same-length byte replacements (changing !1 to !0) to bypass the
 *   auto mode gate checks.
 *
 * Patches applied:
 *   1. modelSupportsAutoMode: Bypass provider check (firstParty/anthropicAws)
 *   2. modelSupportsAutoMode: Bypass model regex check (claude-opus/sonnet-4-6)
 *   3. isAutoModeGateEnabled: Always return true
 *   4. isAutoModeCircuitBroken: Always return false
 *   5. verifyAutoModeGateAccess: Force canEnterAuto happy path
 *   6. carouselAvailable: Always true (enables Shift+Tab cycling)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync, realpathSync, lstatSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { execSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Resolve symlink to actual binary (claude is often a symlink to ~/.local/share/claude/versions/X.Y.Z)
const rawBin = process.env.CLAUDE_BIN || findClaudeBinary()
const CLAUDE_BIN = lstatSync(rawBin).isSymbolicLink() ? realpathSync(rawBin) : rawBin
const BACKUP_PATH = CLAUDE_BIN + '.auto-mode-backup'

// Patches: each must have search.length === replace.length (same byte count)
// This is critical for binary patching — different lengths corrupt the file.
const PATCHES = [
  {
    id: 'RZH-provider',
    desc: 'modelSupportsAutoMode — bypass provider check',
    search:  'if(O!=="firstParty"&&O!=="anthropicAws")return!1',
    replace: 'if(O!=="firstParty"&&O!=="anthropicAws")return!0',
  },
  {
    id: 'RZH-model',
    desc: 'modelSupportsAutoMode — bypass model regex check',
    search:  '/^claude-(opus|sonnet)-4-6/.test(_)}return!1}',
    replace: '/^claude-(opus|sonnet)-4-6/.test(_)}return!0}',
  },
  {
    id: 'oN-gate',
    desc: 'isAutoModeGateEnabled — always return true',
    search:  'function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!1;if(g98())return!1;if(!RZH(OK()))return!1;return!0}',
    replace: 'function oN(){if(C0?.isAutoModeCircuitBroken()??!1)return!0;if(g98())return!0;if(!RZH(OK()))return!0;return!0}',
  },
  {
    id: 'pn1-circuit',
    desc: 'isAutoModeCircuitBroken — always return false',
    // Original: function pn1(){return r_8}   (26 bytes)
    // Replace:  function pn1(){return !1;}   (26 bytes) — space before !1 is valid JS
    search:  'function pn1(){return r_8}',
    replace: 'function pn1(){return !1;}',
  },
  {
    id: 'W6-canEnter',
    desc: 'verifyAutoModeGateAccess — force canEnterAuto happy path',
    // Original: if(w)return{updateContext:(R)=>f(R,A)};let j;   (47 bytes)
    // Replace:  if(1)return{updateContext:(R)=>f(R,A)};let j;   (47 bytes)
    // This bypasses the async GrowthBook canEnterAuto check that can still
    // kick users out of auto mode even after sync checks pass.
    search:  'if(w)return{updateContext:(R)=>f(R,A)};let j;',
    replace: 'if(1)return{updateContext:(R)=>f(R,A)};let j;',
  },
  {
    id: 'carousel-always',
    desc: 'carouselAvailable — always true (enables Shift+Tab cycling)',
    // Original: A=!1;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()   (52 bytes)
    // Replace:  A=!0;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()   (52 bytes)
    // Without this, carouselAvailable stays false when GrowthBook returns
    // opt-in (not enabled) or when hasAutoModeOptInAnySource() returns false,
    // causing isAutoModeAvailable to be set to false in the async check.
    search:  'A=!1;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()',
    replace: 'A=!0;if(K!=="disabled"&&!O&&z)A=K==="enabled"||on_()',
  },
]

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const mode = process.argv[2] || '--patch'

if (mode === '--help' || mode === '-h') {
  console.log(`
Claude Code Auto Mode Patcher

Usage:
  node claude-auto-mode-patcher.mjs           Apply patches
  node claude-auto-mode-patcher.mjs --check   Check current patch status
  node claude-auto-mode-patcher.mjs --restore Restore original binary

Environment:
  CLAUDE_BIN=<path>   Path to claude binary (auto-detected if not set)
`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log(`Claude Code Auto Mode Patcher`)
  console.log(`Binary: ${CLAUDE_BIN}`)
  console.log()

  if (!existsSync(CLAUDE_BIN)) {
    console.error(`Error: Binary not found at ${CLAUDE_BIN}`)
    console.error('Set CLAUDE_BIN environment variable to the correct path.')
    process.exit(1)
  }

  switch (mode) {
    case '--check':
      checkPatches()
      break
    case '--restore':
      restoreBinary()
      break
    case '--patch':
    default:
      applyPatches()
      break
  }
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

function findClaudeBinary() {
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

  for (const path of candidates) {
    if (existsSync(path)) return resolve(path)
  }

  console.error(
    'Could not auto-detect claude binary. Set CLAUDE_BIN=/path/to/claude',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Patch operations
// ---------------------------------------------------------------------------

function applyPatches() {
  // Create backup
  if (!existsSync(BACKUP_PATH)) {
    console.log('Creating backup...')
    copyFileSync(CLAUDE_BIN, BACKUP_PATH)
    console.log(`  Backup: ${BACKUP_PATH}`)
  } else {
    console.log('Backup already exists, skipping.')
  }

  // Read binary
  let data = readFileSync(CLAUDE_BIN)
  let patchCount = 0

  for (const patch of PATCHES) {
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

  // Write patched binary
  writeFileSync(CLAUDE_BIN, data)

  // Re-sign the binary (macOS adhoc signature has embedded hash tables
  // that break when bytes are modified; re-signing restores validity)
  console.log('\nRe-signing binary (fixing macOS code signature)...')
  try {
    execSync(`codesign --force --sign - "${CLAUDE_BIN}"`, {
      stdio: 'pipe',
    })
    console.log('  Code signature updated.')
  } catch (e) {
    console.error('  WARNING: codesign failed. Binary may not launch on macOS.')
    console.error('  Try running: codesign --force --sign - "' + CLAUDE_BIN + '"')
  }

  console.log(`\nPatched ${patchCount}/${PATCHES.length} patterns successfully.`)
  console.log(`\nYou can now use: claude --permission-mode auto`)
  console.log(`Restore with:    node ${process.argv[1]} --restore`)
}

function checkPatches() {
  if (!existsSync(BACKUP_PATH)) {
    console.log('Status: NOT PATCHED (no backup found)')
    return
  }

  const original = readFileSync(BACKUP_PATH)
  const current = readFileSync(CLAUDE_BIN)

  let allPatched = true
  for (const patch of PATCHES) {
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

function restoreBinary() {
  if (!existsSync(BACKUP_PATH)) {
    console.log('No backup found. Nothing to restore.')
    return
  }

  console.log('Restoring original binary...')
  copyFileSync(BACKUP_PATH, CLAUDE_BIN)
  unlinkSync(BACKUP_PATH)
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
// Run
// ---------------------------------------------------------------------------

main()
