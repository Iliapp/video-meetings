const { execFileSync } = require('child_process');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.claude/ralph.config.json', 'utf8'));

// Resume from the phase the Stop hook reached; only the iteration count restarts
const counterFile = '.claude/ralph.iterations.json';
const phaseIndex = fs.existsSync(counterFile)
  ? JSON.parse(fs.readFileSync(counterFile, 'utf8')).phaseIndex
  : 0;
fs.writeFileSync(counterFile, JSON.stringify({ count: 0, phaseIndex }));

const phase = config.phase[phaseIndex];
if (!phase) {
  console.log('🎉 All phases completed!');
  process.exit(0);
}

// Branch names reach git as arguments; reject anything that could pass as an option
const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;
if (!BRANCH_NAME.test(phase.branch) || phase.branch.startsWith('-')) {
  console.error(`❌ Invalid branch name: ${phase.branch}`);
  process.exit(1);
}

// Existing branch: switch to it; otherwise create it from origin/main
// execFileSync passes arguments without a shell, so names and the prompt are never parsed as commands
execFileSync('git', ['fetch', 'origin'], { stdio: 'inherit' });
try {
  execFileSync('git', ['switch', phase.branch], { stdio: 'inherit' });
} catch {
  execFileSync('git', ['switch', '-c', phase.branch, 'origin/main'], {
    stdio: 'inherit',
  });
}

const prompt = config.prompt
  .replace('{milestone}', phase.milestone)
  .replace('{branch}', phase.branch);
console.log(`🚀 Запускаем Ralph для milestone: ${phase.milestone}`);

// stream-json prints every step as it happens (plain -p prints only the final result).
// RALPH_LOOP marks this session for .claude/hooks/stop.js
execFileSync(
  'claude',
  [
    '-p',
    prompt,
    '--max-turns',
    String(config.maxTurns),
    '--permission-mode',
    'acceptEdits',
    '--verbose',
    '--output-format',
    'stream-json',
  ],
  { stdio: 'inherit', env: { ...process.env, RALPH_LOOP: '1' } },
);
