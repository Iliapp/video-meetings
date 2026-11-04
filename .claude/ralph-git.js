const { execFileSync } = require('child_process');

// Process and git helpers for .claude/ralph-start.js

// Branch names reach git and gh as arguments; reject anything that could pass as an option
const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;
function assertBranchName(branch) {
  if (!BRANCH_NAME.test(branch) || branch.startsWith('-')) {
    console.error(`❌ Invalid branch name: ${branch}`);
    process.exit(1);
  }
}

// execFileSync passes arguments without a shell, so names and prompts are never parsed as commands
function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function read(command, args) {
  return execFileSync(command, args).toString().trim();
}

function branchExists(branch) {
  try {
    execFileSync('git', [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ]);
    return true;
  } catch {
    return false;
  }
}

function currentHead() {
  return read('git', ['rev-parse', 'HEAD']);
}

function assertCleanTree(reason) {
  if (read('git', ['status', '--porcelain']) !== '') {
    console.error(
      `🛑 Uncommitted changes ${reason}. Commit or stash them, then run Ralph again.`,
    );
    process.exit(1);
  }
}

// First phase branches off origin/main, later ones off the previous phase
// (origin/main when the previous branch is gone, e.g. after its PR was merged)
function switchToPhaseBranch(phase, previousPhase) {
  const previousBranch =
    previousPhase && branchExists(previousPhase.branch)
      ? previousPhase.branch
      : null;
  if (!branchExists(phase.branch)) {
    run('git', ['switch', '-c', phase.branch, previousBranch || 'origin/main']);
    return;
  }
  run('git', ['switch', phase.branch]);
  if (!previousBranch) return;
  try {
    run('git', ['merge', '--no-edit', previousBranch]);
  } catch {
    console.error(
      `🛑 Merging ${previousBranch} failed. Resolve the merge, commit, then run Ralph again.`,
    );
    process.exit(1);
  }
}

module.exports = {
  assertBranchName,
  run,
  read,
  currentHead,
  assertCleanTree,
  switchToPhaseBranch,
};
