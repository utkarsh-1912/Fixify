import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLUMNS, DEFAULT_ROWS, nextTaskId, normalizeBoard, createTask, updateTask, moveTask, deleteTask,
  deleteColumn, deleteRow, wouldCreateCycle, activeBlockers, filterTasks, boardStats, doneColumnId,
} from '@/lib/kanbanBoard';

const base = { status: 'todo', row: 'default', priority: 'medium' };
const NOW = new Date('2026-07-16T00:00:00Z');

describe('ids', () => {
  it('never collides, even after deletions', () => {
    let tasks = [];
    for (let i = 0; i < 1200; i++) tasks = createTask(tasks, { ...base, title: `t${i}` }, NOW);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(1200);
    expect(nextTaskId(deleteTask(tasks, 'T-001'))).toBe('T-1201');
  });
});

describe('normalizeBoard', () => {
  it('migrates the legacy nested format and repairs orphaned status/row', () => {
    const b = normalizeBoard({ tasks: { todo: [{ id: 'A', title: 'a' }], gone: [{ id: 'B', title: 'b', row: 'zzz' }] } });
    expect(b.tasks.map((t) => [t.id, t.status, t.row])).toEqual([['A', 'todo', 'default'], ['B', 'todo', 'default']]);
  });
  it('fixes duplicate ids, dangling blockers and cycles', () => {
    const b = normalizeBoard({
      tasks: [
        { id: 'T-001', title: 'a', status: 'todo', blockedBy: ['T-002', 'nope', 'T-001'] },
        { id: 'T-002', title: 'b', status: 'todo', blockedBy: ['T-001'] },
        { id: 'T-001', title: 'dup', status: 'todo' },
      ],
    });
    expect(new Set(b.tasks.map((t) => t.id)).size).toBe(3);
    const [a, c] = b.tasks;
    // exactly one edge of the A<->B cycle is dropped, the self edge and dangling id are gone
    expect(a.blockedBy.length + c.blockedBy.length).toBe(1);
  });
  it('survives garbage input', () => {
    expect(normalizeBoard({ tasks: 'x', columns: [], rows: 5 })).toMatchObject({ tasks: [], columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS });
    expect(normalizeBoard().tasks).toEqual([]);
  });
});

describe('dependencies', () => {
  it('detects and refuses cycles on update', () => {
    let tasks = createTask([], { ...base, title: 'a' }, NOW);
    tasks = createTask(tasks, { ...base, title: 'b', blockedBy: ['T-001'] }, NOW);
    expect(wouldCreateCycle(tasks, 'T-001', 'T-002')).toBe(true);
    expect(wouldCreateCycle(tasks, 'T-001', 'T-001')).toBe(true);
    const out = updateTask(tasks, { ...tasks[0], blockedBy: ['T-002'] }, NOW);
    expect(out[0].blockedBy).toEqual([]);
  });
  it('deleting a task unblocks its dependents', () => {
    let tasks = createTask([], { ...base, title: 'a' }, NOW);
    tasks = createTask(tasks, { ...base, title: 'b', blockedBy: ['T-001'] }, NOW);
    expect(deleteTask(tasks, 'T-001')[0].blockedBy).toEqual([]);
  });
  it('a blocker only blocks until it reaches the done column (even if renamed/removed)', () => {
    let tasks = createTask([], { ...base, title: 'a' }, NOW);
    tasks = createTask(tasks, { ...base, title: 'b', blockedBy: ['T-001'] }, NOW);
    expect(activeBlockers(tasks[1], tasks, DEFAULT_COLUMNS)).toEqual(['T-001']);
    tasks = moveTask(tasks, 'T-001', 'default', 'done', NOW);
    expect(activeBlockers(tasks[1], tasks, DEFAULT_COLUMNS)).toEqual([]);
    const cols = { a: { label: 'A' }, z: { label: 'Z' } };
    expect(doneColumnId(cols)).toBe('z');
  });
});

describe('moves and structure edits', () => {
  it('records history only when something changed', () => {
    let tasks = createTask([], { ...base, title: 'a' }, NOW);
    const same = moveTask(tasks, 'T-001', 'default', 'todo', NOW);
    expect(same[0].history).toHaveLength(1);
    const moved = moveTask(tasks, 'T-001', 'default', 'doing', NOW);
    expect(moved[0].history[1].text).toMatch(/todo\/default → doing\/default/);
  });
  it('deleting a column or row relocates tasks and keeps at least one of each', () => {
    const tasks = createTask([], { ...base, title: 'a', status: 'doing' }, NOW);
    const r = deleteColumn({ tasks, columns: DEFAULT_COLUMNS }, 'doing');
    expect(r.tasks[0].status).toBe('todo');
    expect(Object.keys(r.columns)).toEqual(['todo', 'done']);
    expect(() => deleteColumn({ tasks, columns: { only: {} } }, 'only')).toThrow();
    const rows = [{ id: 'default' }, { id: 'x' }];
    const t2 = createTask([], { ...base, title: 'a', row: 'x' }, NOW);
    expect(deleteRow({ tasks: t2, rows }, 'x').tasks[0].row).toBe('default');
    expect(() => deleteRow({ tasks: t2, rows: [{ id: 'x' }] }, 'x')).toThrow();
  });
});

describe('filter + stats', () => {
  it('searches id/title/assignee and computes completion', () => {
    let tasks = createTask([], { ...base, title: 'Fix parser', assignee: 'Sam', priority: 'high' }, NOW);
    tasks = createTask(tasks, { ...base, title: 'Docs', status: 'done' }, NOW);
    expect(filterTasks(tasks, { query: 'sam' })).toHaveLength(1);
    expect(filterTasks(tasks, { query: 't-002' })).toHaveLength(1);
    expect(filterTasks(tasks, { priority: 'high' })).toHaveLength(1);
    expect(boardStats(tasks, DEFAULT_COLUMNS)).toMatchObject({ total: 2, completionPct: 50, byColumn: { todo: 1, doing: 0, done: 1 } });
  });
});
