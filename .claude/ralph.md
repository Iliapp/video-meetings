# Ralph Loop - Autonomous Work Rule

Each session implements exactly one issue, named in the prompt. `.claude/ralph-start.js` has already switched to the phase branch.

## How to take an issue

- `gh issue view <N> --json title,body`: the body has the task, its done criteria and the plan section to read
- Read only that plan section (`grep -n` the heading, then `offset`/`limit`), not the whole plan or PRD
- Work only in the current branch; do not create or switch branches

## Commits

- By the rule in the `git-commit` skill, with `Closes #N` in the commit message (links the issue to the PR)
- `Closes #N` closes the issue only once it reaches `main`, so after a successful commit run `gh issue close <N>`
- Commit all your changes: `ralph-start.js` stops the run if the tree is dirty, no commit was made or the issue is open

## Execution plan

- Tests first, then the implementation (TDD)
- Run only the tests for this issue: the affected spec file
  (`pnpm --filter web test:e2e e2e/<name>.spec.ts --reporter=line`, `pnpm --filter api test:e2e -- <name>`)
  and unit tests of the changed app. Trim output: `2>&1 | tail -40`
- If tests are red after 5 tries, stop and write an issue comment that describes the problem

## Completion rules

- The prompt says whether this is the last open issue of the milestone:
  - not the last: before the commit, run the tests of this issue plus `lint` and `typecheck` of the changed app
  - the last: run the full suites once (`pnpm lint`, `pnpm typecheck`, `pnpm test`, api and web e2e), each trimmed with `| tail -40`. Everything must be green
- Tests written for later issues of this milestone may still be red
- Make sure all requirements of the issue are met
- No per-issue code review: `ralph-start.js` reviews the whole PR when the milestone is done
- Do not push or create a PR
