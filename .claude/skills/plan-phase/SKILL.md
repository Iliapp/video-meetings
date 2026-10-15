---

name: plan
disription:Breaks down the PRD into implementation phases. Used when a PRD is ready and a development plan with independent phases needs to be created.

---

# Plan Generator

Read the PRD from file: $ARGUMENTS

Create an implementation plan and save it to the file 'docs/plan-$ARGUMENTS.md' (use English translation and kebab-case)

## Plan structure

# Plan: {fetch name}

**PRD**: $ARGUMENTS
**Data:** {current data}

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

## Phase Breakdown Rules:
- Each phase must deliver a working result.
- Phases are independent; you can stop after any phase.
- The first phase acts as a minimal working path (Tracer Bullet).
- No more than five tasks per phase.
- Backend and frontend of the same feature belong to different phases.
- Each phase must include planned tests to cover the phase's functionality.

## Rules
- Read the PRD carefully; the plan must cover all definition-of-done criteria.
- Do not add tasks that are not in the PRD. If the PRD is incomplete, ask a question before creating the plan.





