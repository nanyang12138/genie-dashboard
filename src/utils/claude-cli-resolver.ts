/**
 * @fileoverview Shared CLI binary resolution for Genie (AMD's Claude Code wrapper).
 *
 * Finds the `genie` binary across common installation paths and provides
 * an augmented PATH string. Used by session.ts and tmux-manager.ts
 * to locate the Genie CLI.
 *
 * @module utils/claude-cli-resolver
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { EXEC_TIMEOUT_MS } from '../config/exec-timeout.js';

const GENIE_RELEASE_DIR = '/proj/verif_release_ro/genie/current/bin';

const CLAUDE_SEARCH_DIRS = [
  GENIE_RELEASE_DIR,
  join(homedir(), '.local', 'bin'),
  join(homedir(), '.claude', 'local'),
  '/usr/local/bin',
  join(homedir(), '.npm-global', 'bin'),
  join(homedir(), 'bin'),
];

let _claudeDir: string | null = null;

/**
 * Finds the directory containing the `genie` binary.
 * Checks the standard release path first, then `which genie`, then fallback locations.
 */
export function findClaudeDir(): string | null {
  if (_claudeDir !== null) return _claudeDir || null;

  if (existsSync(join(GENIE_RELEASE_DIR, 'genie'))) {
    _claudeDir = GENIE_RELEASE_DIR;
    return _claudeDir;
  }

  try {
    const result = execSync('which genie', { encoding: 'utf-8', timeout: EXEC_TIMEOUT_MS }).trim();
    if (result && existsSync(result)) {
      _claudeDir = dirname(result);
      return _claudeDir;
    }
  } catch {
    // genie not in PATH, will check common locations
  }

  for (const dir of CLAUDE_SEARCH_DIRS) {
    if (existsSync(join(dir, 'genie'))) {
      _claudeDir = dir;
      return _claudeDir;
    }
  }

  _claudeDir = '';
  return null;
}

/** Cached augmented PATH string */
let _augmentedPath: string | null = null;

/**
 * Returns a PATH string that includes the directory containing `claude`.
 *
 * Finds the claude binary (via `which` or common install locations), then
 * prepends its directory to the current PATH if not already present.
 * Result is cached for subsequent calls.
 */
export function getAugmentedPath(): string {
  if (_augmentedPath) return _augmentedPath;

  const currentPath = process.env.PATH || '';
  const claudeDir = findClaudeDir();

  if (claudeDir && !currentPath.split(delimiter).includes(claudeDir)) {
    _augmentedPath = `${claudeDir}${delimiter}${currentPath}`;
    return _augmentedPath;
  }

  _augmentedPath = currentPath;
  return _augmentedPath;
}
