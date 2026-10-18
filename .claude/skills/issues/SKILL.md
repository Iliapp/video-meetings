---
name: issues
description: Creates GitHub milestones and issues from a plan file. Use when a plan with phases is ready and a backlog needs to be created on GitHub.
---

# Issues Generator

Read the plan file: $ARGUMENTS

For each phase, create a milestone and issues on GitHub with the `gh` CLI.

## Order of Actions

1. Read the plan file.
2. For each phase, create a milestone:
   `gh api repos/:owner/:repo/milestones -f title="Phase N: name"`
3. For each task in a phase, create an issue:
   `gh issue create --title "..." --body "..." --label "..." --milestone "..."`

## Issue format

**Title**: the task text from the plan (without `[ ]`)
**Body**: the task description, the phase's goal and done criteria, and a link to the plan file
