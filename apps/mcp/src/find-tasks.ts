import { z } from 'zod';

// Input of the `find_tasks` tool. A "task" is a meeting the token's user owns
// or is invited to; the api decides visibility (`GET /meetings`).
export const findTasksInput = {
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Case-insensitive text to look for in the title'),
  from: z.iso
    .datetime({ offset: true })
    .optional()
    .describe('Only tasks on or after this ISO 8601 date-time'),
  to: z.iso
    .datetime({ offset: true })
    .optional()
    .describe('Only tasks on or before this ISO 8601 date-time'),
};

export type FindTasksInput = z.infer<z.ZodObject<typeof findTasksInput>>;

// The part of the api's `Meeting` JSON the tool relies on.
export interface Task {
  id: string;
  title: string;
  date: string;
  participants: string[];
  ownerId: string;
}

export function findTasks(tasks: Task[], { query, from, to }: FindTasksInput) {
  const needle = query?.toLowerCase();
  const fromMs = from === undefined ? undefined : Date.parse(from);
  const toMs = to === undefined ? undefined : Date.parse(to);

  return tasks.filter((task) => {
    const date = Date.parse(task.date);
    return (
      (needle === undefined || task.title.toLowerCase().includes(needle)) &&
      (fromMs === undefined || date >= fromMs) &&
      (toMs === undefined || date <= toMs)
    );
  });
}
