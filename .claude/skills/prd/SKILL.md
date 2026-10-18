---
name: prd
description: Creates a PRD document for a feature in the standard project structure. Use when the requirements for a new feature need to be described before implementation.
---

# PRD generator

Create a PRD (Product Requirements Document) for this feature:
$ARGUMENTS

Save the result to `docs/prd-<feature>.md`, where `<feature>` is the feature name translated into English and written in kebab-case.

If the `docs/` folder doesn't exist, create it.

## Document structure

# PRD: {feature name}

**Date**: {current date}
**Status**: Draft

## Goal

One or two sentences: what the feature is and why the user needs it.

## User scenarios

- User {action} → {result}

## In scope

What the feature includes, as a specific list.

## Out of scope

What we explicitly don't do in this iteration.

## Criterion of readiness

- [ ] Criterion 1
- [ ] Criterion 2

## Rules

- Write concretely, with no filler.
- Acceptance criteria must be verifiable.
- Don't describe how to implement it, only what and why.
- If the description is short, ask clarifying questions until the feature is fully understood, before creating the file.
