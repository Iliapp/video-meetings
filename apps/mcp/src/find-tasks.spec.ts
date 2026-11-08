import { findTasks, type Task } from './find-tasks.js';

const task = (title: string, date: string): Task => ({
  id: title,
  title,
  date,
  participants: [],
  ownerId: 'owner',
});

const tasks = [
  task('Sprint planning', '2026-11-01T10:00:00.000Z'),
  task('Design review', '2026-11-05T10:00:00.000Z'),
  task('Retro', '2026-11-10T10:00:00.000Z'),
];

describe('findTasks', () => {
  it('returns everything without filters', () => {
    expect(findTasks(tasks, {})).toEqual(tasks);
  });

  it('matches the title case-insensitively', () => {
    expect(findTasks(tasks, { query: 'REVIEW' })).toEqual([tasks[1]]);
  });

  it('filters by an inclusive date range', () => {
    expect(
      findTasks(tasks, {
        from: '2026-11-05T10:00:00Z',
        to: '2026-11-10T10:00:00Z',
      }),
    ).toEqual([tasks[1], tasks[2]]);
  });

  it('combines filters', () => {
    expect(
      findTasks(tasks, { query: 're', from: '2026-11-06T00:00:00Z' }),
    ).toEqual([tasks[2]]);
  });
});
