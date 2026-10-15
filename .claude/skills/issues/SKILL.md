---
name: issues 
description: Create git issues and melestones frop file plan. Use, when we have a prepared plan with phases, and need create back log on github

---

# Plan Generator

Read file from: $ARGUMENTS

For each phases create milestones and issues in GitHub, use gh CLI.

## Order of Actions

1. Read the plan file
2. For each phase, create a milestone:
   `gh api repos/:owner/:repo/milestones -f title="Phase N: name"`

3. For each task in a phase, create an Issue:
   `gh issue create --title "..." --body "..." --label "..." --milestone "..."`

## Format Issue

**Title**: task text from plan (without[])
**Body**: Task Description