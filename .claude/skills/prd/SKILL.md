---

name: prd
disription:I create a PRD document for a feature according to the standard project structure; I use it when it is necessary to describe the requirements for a new feature before implementation.

---

# PRD generator

Create PRD(Product Requirements Document) for next feature:
$ARGUMENTS

Save result in file 'docs/prd-$ARGUMENTS.md' (use translate on a Engl and kebab-case)

If not folder /docs - create it

## Document structure

# PRD: {feature : name}

**Date**: {current data}
**Status**: Draft

## Goal
One-two suggestion, what and why this need for user

## User scenarios
- User {action} -> {Result}


## In scope
What is included in the feature – a specific list

## Out of scope
What we explicitly do not do in this iteration

## Criterion of readiness

- [ ] Criterion 1
- [ ] Criterion 2

## Rules

- Write concretely – no fluff
- Acceptance criteria must be verifiable
- Do not describe how to implement – only what and why
- If the description is short – ask clarifying questions until full understanding before creating the file
