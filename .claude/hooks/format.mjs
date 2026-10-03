// PostToolUse hook: run Prettier on the file Claude just edited or wrote.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;

if (!file) process.exit(0);

// Only format files inside this repo. Prettier respects .prettierignore.
const rel = relative(root, file);
if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(file))
  process.exit(0);

const prettier = join(root, 'node_modules', '.bin', 'prettier');
if (!existsSync(prettier)) process.exit(0);

try {
  execFileSync(
    prettier,
    ['--write', '--ignore-unknown', '--log-level', 'warn', rel],
    {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
} catch (err) {
  // Syntax errors etc.: report to Claude but don't block the edit.
  process.stderr.write(
    `prettier failed on ${rel}: ${err.stderr ?? err.message}`,
  );
}
