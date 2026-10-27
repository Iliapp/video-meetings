# Ralph Loop - Autonomous Work Rule

### How ta take issues

- Read title, and body definition of done
- check branch config.branch is exists (if not must create it)
- work only in this branch - not create new

## Commits name

- By rule in skill commit

## Execution Plan

- Firstly tests - than realisation(Tdd)
- While working, run only the tests for this issue: the affected spec file
  (`pnpm --filter web test:e2e e2e/<name>.spec.ts`, `pnpm --filter api test:e2e -- <name>`)
  and unit tests of the changed app. Do not run the full suites after every change.
- If tests are red after 5 tries, just stop and write on issues comment(which describe a problem)

## Completion Rules

- Run the full suites once, right before the commit (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  api and web e2e). Tests written for later issues of this milestone may still be red; everything else must be green
- Make sure all requirements are met
- No per-issue code review: the Stop Hook reviews the whole PR when the milestone is done
- Close the Issue
- Do not create a PR, Stop Hook will do this
