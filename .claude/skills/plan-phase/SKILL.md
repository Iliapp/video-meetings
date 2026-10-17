---
name: plan-phase
description: Breaks a PRD down into implementation phases. Use when a PRD is ready and a development plan with independent phases needs to be created.
---

# Plan Generator

Read the PRD from file: $ARGUMENTS

Create an implementation plan and save it to `docs/plan-<feature>.md`, where `<feature>` is the PRD file name without the `prd-` prefix and the extension (for example, `docs/prd-meeting-recording-upload.md` → `docs/plan-meeting-recording-upload.md`).

## Plan structure

# Plan: {feature name}

**PRD**: $ARGUMENTS
**Date:** {current date}

## Implementation Phases

### Phase 1: {name}

**Goal:** What this phase achieves
**Affects:** backend / frontend / database
**Tasks:**

- [ ] Task 1
- [ ] Task 2

**Done criteria:** Concrete criterion

### Phase 2: {name}

...

## Phase Breakdown Rules

- Each phase must deliver a working result.
- Phases are independent; you can stop after any phase.
- The first phase acts as a minimal working path (Tracer Bullet).
- No more than five tasks per phase.
- Backend and frontend of the same feature belong to different phases.
- Each phase must include planned tests that cover its functionality. The first task of every phase writes the e2e tests and confirms they fail (red). The done criteria require those same tests to pass (green), and no earlier phase's tests may break.

## Rules

- Read the PRD carefully; the plan must cover all definition-of-done criteria.
- Do not add tasks that are not in the PRD. If the PRD is incomplete, ask a question before creating the plan.
