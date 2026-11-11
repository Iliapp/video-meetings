---
globals: '**/*.prisma'
---


# Prisma Rules

- UUID for all id: @id @deafualt(uuid())
- always add createdAt and updatedAt
- Enum values un UPPER_CASE
- Relation with @relation with name
- Index on foreign keys by @@index