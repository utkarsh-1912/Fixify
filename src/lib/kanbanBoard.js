// Pure board logic for the Kanban page: persistence migration, ids, moves,
// dependency graph (no cycles) and filtering. No React, no localStorage.

export const DEFAULT_COLUMNS = {
  todo: { label: 'To Do', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
  doing: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  done: { label: 'Completed', color: 'var(--primary)', bg: 'var(--primary-faint)' },
};
export const DEFAULT_ROWS = [{ id: 'default', label: 'General' }];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const ID_RE = /^T-(\d+)$/;
const stamp = (now) => (now instanceof Date ? now : new Date(now ?? Date.now())).toISOString();

/** Column that counts as "complete": the one with id `done`, otherwise the last column. */
export function doneColumnId(columns) {
  const keys = Object.keys(columns);
  return keys.includes('done') ? 'done' : keys[keys.length - 1];
}

/** Next sequential id (T-001, T-002, ...) that can never collide with an existing one. */
export function nextTaskId(tasks) {
  const max = tasks.reduce((m, t) => {
    const match = ID_RE.exec(t.id);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `T-${String(max + 1).padStart(3, '0')}`;
}

function hasPath(tasks, from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  const t = tasks.find((x) => x.id === from);
  return (t?.blockedBy || []).some((b) => hasPath(tasks, b, to, seen));
}

/** True when making `taskId` blocked by `blockerId` would create a dependency cycle. */
export function wouldCreateCycle(tasks, taskId, blockerId) {
  return taskId === blockerId || hasPath(tasks, blockerId, taskId);
}

/**
 * Repairs whatever was persisted (older nested format, missing columns/rows,
 * duplicate ids, dangling or cyclic dependencies) into a consistent board.
 */
export function normalizeBoard({ tasks, columns, rows } = {}) {
  const cols = columns && typeof columns === 'object' && !Array.isArray(columns) && Object.keys(columns).length
    ? columns
    : DEFAULT_COLUMNS;
  const rws = Array.isArray(rows) && rows.length && rows.every((r) => r && r.id) ? rows : DEFAULT_ROWS;

  let list = [];
  if (Array.isArray(tasks)) list = tasks;
  else if (tasks && typeof tasks === 'object') {
    Object.entries(tasks).forEach(([colId, arr]) => {
      if (Array.isArray(arr)) arr.forEach((t) => list.push({ ...t, status: colId }));
    });
  }

  const colKeys = Object.keys(cols);
  const rowIds = new Set(rws.map((r) => r.id));
  const seen = new Set();
  const out = [];
  list.filter((t) => t && typeof t === 'object').forEach((t) => {
    let id = typeof t.id === 'string' && t.id ? t.id : null;
    if (!id || seen.has(id)) id = nextTaskId([...out, ...list.filter((x) => x.id && !seen.has(x.id))]);
    seen.add(id);
    out.push({
      ...t,
      id,
      title: String(t.title ?? 'Untitled'),
      status: colKeys.includes(t.status) ? t.status : colKeys[0],
      row: rowIds.has(t.row) ? t.row : rws[0].id,
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      blockedBy: Array.isArray(t.blockedBy) ? [...new Set(t.blockedBy)] : [],
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
      history: Array.isArray(t.history) ? t.history : [],
    });
  });

  // Drop dangling blockers, then break any cycles by removing the offending edge.
  const ids = new Set(out.map((t) => t.id));
  out.forEach((t) => { t.blockedBy = t.blockedBy.filter((b) => ids.has(b) && b !== t.id); });
  out.forEach((t) => {
    t.blockedBy = t.blockedBy.filter((b) => {
      const without = out.map((x) => (x.id === t.id ? { ...x, blockedBy: [] } : x));
      return !hasPath(without, b, t.id);
    });
  });
  return { tasks: out, columns: cols, rows: rws };
}

export function createTask(tasks, input, now) {
  const task = {
    id: nextTaskId(tasks),
    title: input.title.trim(),
    description: (input.description || '').trim(),
    assignee: (input.assignee || '').trim(),
    status: input.status,
    row: input.row,
    priority: input.priority || 'medium',
    subtasks: input.subtasks || [],
    comments: input.comments || [],
    blockedBy: input.blockedBy || [],
    history: [{ text: 'Task created', timestamp: stamp(now) }],
  };
  return [...tasks, task];
}

/** Replaces a task, logging what changed and refusing dependency cycles. */
export function updateTask(tasks, updated, now) {
  const prev = tasks.find((t) => t.id === updated.id);
  if (!prev) return createTask(tasks, updated, now);
  const history = [...(prev.history || [])];
  const log = (text) => history.push({ text, timestamp: stamp(now) });
  if (prev.title !== updated.title) log('Title updated');
  if (prev.priority !== updated.priority) log(`Priority changed: ${prev.priority} → ${updated.priority}`);
  if (prev.status !== updated.status) log(`Status moved: ${prev.status} → ${updated.status}`);
  if (prev.row !== updated.row) log(`Swimlane changed: ${prev.row} → ${updated.row}`);
  if ((prev.assignee || '') !== (updated.assignee || '')) {
    log(`Assignee changed: ${prev.assignee || 'Unassigned'} → ${updated.assignee || 'Unassigned'}`);
  }
  const others = tasks.filter((t) => t.id !== updated.id);
  const blockedBy = (updated.blockedBy || []).filter(
    (b) => others.some((t) => t.id === b) && !wouldCreateCycle(others, updated.id, b)
  );
  return tasks.map((t) => (t.id === updated.id ? { ...updated, blockedBy, history } : t));
}

export function moveTask(tasks, id, toRow, toCol, now) {
  return tasks.map((t) => {
    if (t.id !== id || (t.status === toCol && t.row === toRow)) return t;
    return {
      ...t,
      status: toCol,
      row: toRow,
      history: [...(t.history || []), { text: `Moved: ${t.status}/${t.row} → ${toCol}/${toRow}`, timestamp: stamp(now) }],
    };
  });
}

/** Deletes a task and removes it from every other task's blockers. */
export function deleteTask(tasks, id) {
  return tasks.filter((t) => t.id !== id).map((t) => (t.blockedBy?.includes(id) ? { ...t, blockedBy: t.blockedBy.filter((b) => b !== id) } : t));
}

export function deleteColumn({ tasks, columns }, colId) {
  const keys = Object.keys(columns);
  if (!keys.includes(colId)) return { tasks, columns };
  if (keys.length <= 1) throw new Error('A board needs at least one column.');
  const fallback = keys.find((k) => k !== colId);
  const rest = { ...columns };
  delete rest[colId];
  return { columns: rest, tasks: tasks.map((t) => (t.status === colId ? { ...t, status: fallback } : t)) };
}

export function deleteRow({ tasks, rows }, rowId) {
  if (!rows.some((r) => r.id === rowId)) return { tasks, rows };
  if (rows.length <= 1) throw new Error('A board needs at least one swimlane.');
  const fallback = rows.find((r) => r.id !== rowId).id;
  return { rows: rows.filter((r) => r.id !== rowId), tasks: tasks.map((t) => (t.row === rowId ? { ...t, row: fallback } : t)) };
}

/** Blockers that are still open (exist and are not in the done column). */
export function activeBlockers(task, tasks, columns) {
  const done = doneColumnId(columns);
  return (task.blockedBy || []).filter((id) => {
    const b = tasks.find((t) => t.id === id);
    return b && b.status !== done;
  });
}

export function filterTasks(tasks, { query = '', priority = 'all' } = {}) {
  const q = query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (priority !== 'all' && t.priority !== priority) return false;
    if (!q) return true;
    return [t.title, t.description, t.assignee, t.id].some((f) => (f || '').toLowerCase().includes(q));
  });
}

export function boardStats(tasks, columns) {
  const done = doneColumnId(columns);
  const byColumn = Object.fromEntries(Object.keys(columns).map((c) => [c, 0]));
  tasks.forEach((t) => { byColumn[t.status] = (byColumn[t.status] || 0) + 1; });
  const total = tasks.length;
  return {
    total,
    byColumn,
    blocked: tasks.filter((t) => t.status !== done && activeBlockers(t, tasks, columns).length > 0).length,
    completionPct: total ? Math.round(((byColumn[done] || 0) / total) * 100) : 0,
  };
}
