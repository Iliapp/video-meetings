---
name: review-all
description: Runs a full code review via three parallel subagents
---

Run three subagents in parallel via the Task tool:

1. security-reviewer — check the security of the changes
2. performance-reviewer — check performance
3. test-coverage-reviewer — check test coverage

Run all three at the same time. When all are finished — synthesize the results into a single report.