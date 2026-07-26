'use client';

import { useState, useEffect } from "react";
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, DragOverlay } from "@dnd-kit/core";
import {
  Plus,
  Trash2,
  Edit2,
  User,
  Clock,
  CheckCircle,
  Search,
  MessageSquare,
  ListTodo,
  Activity,
  Flag,
  X,
  ArrowUpRight,
  Settings,
  Layers
} from "lucide-react";

// Seed data with realistic FIX conformance milestones, subtasks, priorities, and history
const initialTasks = [
  {
    id: "TASK-101",
    title: "Implement Heartbeat (35=0) Verification",
    description: "Verify that heartbeat messages are sent at the defined HeartBtInt interval and handle test requests.",
    status: "todo",
    row: "default",
    assignee: "Alex",
    priority: "high",
    subtasks: [
      { text: "Heartbeat response logic", completed: true },
      { text: "Missed heartbeat timeout", completed: false }
    ],
    comments: [],
    history: [{ text: "Task created", timestamp: new Date().toISOString() }]
  },
  {
    id: "TASK-102",
    title: "Implement Test Request (35=1) Logic",
    description: "Send test requests if heartbeat has not been received and verify the response contains matching TestReqID.",
    status: "doing",
    row: "default",
    assignee: "Emma",
    priority: "medium",
    subtasks: [],
    comments: [],
    history: [{ text: "Task created", timestamp: new Date().toISOString() }]
  },
  {
    id: "TASK-103",
    title: "Verify Logon (35=A) Sequence Reset",
    description: "Ensure ResetSeqNumFlag (141=Y) behavior is correct when establishing new session connection.",
    status: "done",
    row: "default",
    assignee: "Sofia",
    priority: "low",
    subtasks: [],
    comments: [],
    history: [{ text: "Task created", timestamp: new Date().toISOString() }]
  }
];

const DEFAULT_COLUMN_CONFIG = {
  todo:  { label: 'To Do',       color: '#3b82f6', bg: 'rgba(59,130,246,0.06)'  },
  doing: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
  done:  { label: 'Completed',   color: 'var(--primary)', bg: 'var(--primary-faint)' },
};

// Priority badge style helper
function getPriorityBadgeStyles(priority) {
  switch (priority) {
    case "high":
      return {
        bg: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        color: "#f87171",
        label: "High"
      };
    case "low":
      return {
        bg: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        color: "#60a5fa",
        label: "Low"
      };
    case "medium":
    default:
      return {
        bg: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.2)",
        color: "#fbbf24",
        label: "Medium"
      };
  }
}

function DroppableCell({ rowId, colId, columnConfig, tasks, onTaskClick, allTasksList }) {
  const cellId = `${rowId}::${colId}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-h-[160px] p-4 transition-colors duration-200 min-w-[280px] lg:min-w-0"
      style={{
        background: isOver ? `${columnConfig.color}0a` : 'transparent',
      }}
    >
      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="h-full min-h-[120px] flex items-center justify-center rounded-xl text-[10px] text-zinc-600 border border-dashed border-zinc-800/40 bg-zinc-900/5 select-none">
            Drop here
          </div>
        )}
        {tasks.map(task => (
          <DraggableTask key={task.id} id={task.id} task={task} onClick={() => onTaskClick(task)} allTasksList={allTasksList} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, onClick, allTasksList = [] }) {
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
  const prio = getPriorityBadgeStyles(task.priority);

  // Check blocker status
  const activeBlockers = (task.blockedBy || []).filter(blockerId => {
    const blockerTask = allTasksList.find(t => t.id === blockerId);
    return blockerTask && blockerTask.status !== "done";
  });
  const isBlocked = activeBlockers.length > 0;

  return (
    <div
      style={{
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="space-y-3">
        {isBlocked && (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold border font-mono animate-fade-in"
            style={{ 
              background: 'rgba(239, 68, 68, 0.04)', 
              borderColor: 'rgba(239, 68, 68, 0.15)', 
              color: '#f87171' 
            }}
          >
            <Flag className="h-3 w-3 shrink-0 animate-pulse text-red-400" />
            <span className="truncate">Blocked by: {activeBlockers.join(', ')}</span>
          </div>
        )}
        {/* Header Title & ID */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold leading-snug font-sans text-left" style={{ color: 'var(--foreground)' }}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-950/40 border border-zinc-800 text-zinc-400">
              {task.id}
            </span>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-[11px] leading-relaxed line-clamp-2 text-zinc-400 text-left" style={{ color: 'var(--text-muted)' }}>
            {task.description}
          </p>
        )}

        {/* Subtask progress bar */}
        {totalSubtasks > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
              <span className="flex items-center gap-1"><ListTodo className="h-3 w-3 text-zinc-400" /> Checklist</span>
              <span>{completedSubtasks}/{totalSubtasks} ({progressPercent}%)</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-zinc-850" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  background: 'var(--primary)'
                }}
              />
            </div>
          </div>
        )}

        {/* Bottom meta row */}
        <div
          className="flex items-center justify-between pt-2.5 text-[10px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          <div className="flex items-center gap-1.5">
            {/* Priority tag */}
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border font-mono"
              style={{ background: prio.bg, borderColor: prio.border, color: prio.color }}
            >
              {prio.label}
            </span>

            {/* Comments length count */}
            {task.comments?.length > 0 && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                <MessageSquare className="h-3 w-3 text-[var(--primary)]" />
                {task.comments.length}
              </span>
            )}
          </div>

          {task.assignee && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px]"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <User className="h-2.5 w-2.5" style={{ color: 'var(--primary)' }} />
              {task.assignee}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableTask({ id, task, onClick, allTasksList }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
        opacity: isDragging ? 0.35 : 1
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
    >
      <TaskCard task={task} allTasksList={allTasksList} />
    </div>
  );
}

function TaskModal({ isOpen, onClose, onSave, onDelete, task, allTasksList = [], columnsConfig = {}, rowsConfig = [] }) {
  const isEditing = !!task;
  const firstColKey = Object.keys(columnsConfig)[0] || "todo";
  const firstRowKey = rowsConfig[0]?.id || "default";

  // Form states
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [status, setStatus] = useState(task?.status || firstColKey);
  const [rowId, setRowId] = useState(task?.row || firstRowKey);
  const [assignee, setAssignee] = useState(task?.assignee || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [blockedBy, setBlockedBy] = useState(task?.blockedBy || []);

  // Checklist subtask states
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Comments states
  const [comments, setComments] = useState(task?.comments || []);
  const [newCommentText, setNewCommentText] = useState("");

  // Tab selector inside modal
  const [activeTab, setActiveTab] = useState("details"); // details | checklist | comments | history

  // Reset form state when task changes
  useEffect(() => {
    setTitle(task?.title || "");
    setDesc(task?.description || "");
    setStatus(task?.status || Object.keys(columnsConfig)[0] || "todo");
    setRowId(task?.row || rowsConfig[0]?.id || "default");
    setAssignee(task?.assignee || "");
    setPriority(task?.priority || "medium");
    setBlockedBy(task?.blockedBy || []);
    setSubtasks(task?.subtasks || []);
    setComments(task?.comments || []);
    setNewSubtaskText("");
    setNewCommentText("");
    setActiveTab("details");
  }, [task, columnsConfig, rowsConfig]);

  if (!isOpen) return null;

  // Add new subtask trigger
  const addSubtask = () => {
    if (!newSubtaskText.trim()) return;
    const item = {
      id: `s-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false
    };
    setSubtasks([...subtasks, item]);
    setNewSubtaskText("");
  };

  // Toggle subtask completion
  const toggleSubtask = (id) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  // Delete subtask
  const deleteSubtask = (id) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  // Add new comment trigger
  const addComment = () => {
    if (!newCommentText.trim()) return;
    const comm = {
      id: `c-${Date.now()}`,
      author: "Jammie", // default user
      text: newCommentText.trim(),
      timestamp: new Date().toISOString()
    };
    setComments([comm, ...comments]); // newest comments at top
    setNewCommentText("");
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Build timeline updates
    const updatedHistory = [...(task?.history || [])];
    const logEvent = (text) => {
      updatedHistory.push({ text, timestamp: new Date().toISOString() });
    };

    if (isEditing) {
      if (task.title !== title.trim()) logEvent("Title updated");
      if (task.priority !== priority) logEvent(`Priority changed: ${task.priority} → ${priority}`);
      if (task.status !== status) logEvent(`Status moved: ${task.status} → ${status}`);
      if (task.row !== rowId) logEvent(`Swimlane changed: ${task.row || 'default'} → ${rowId}`);
      if (task.assignee !== assignee.trim()) logEvent(`Assignee changed: ${task.assignee || 'Unassigned'} → ${assignee.trim() || 'Unassigned'}`);
    } else {
      updatedHistory.push({ text: "Task created", timestamp: new Date().toISOString() });
    }

    onSave({
      id: task?.id || `T-${Date.now().toString().slice(-3)}`,
      title: title.trim(),
      description: desc.trim(),
      assignee: assignee.trim(),
      status,
      row: rowId,
      priority,
      subtasks,
      comments,
      history: updatedHistory,
      blockedBy
    });
    onClose();
  };

  const inputCls = "w-full py-2 px-3 rounded-xl text-xs outline-none font-sans";
  const inputSty = { background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' };

  // Calculate stats for tabs
  const completedCount = subtasks.filter(s => s.completed).length;
  const progressPercent = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideInFromRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Drawer Container */}
      <div
        className="relative z-10 w-full max-w-full sm:max-w-lg md:max-w-xl h-full shadow-2xl flex flex-col animate-slide-in"
        style={{ 
          background: 'var(--card)', 
          borderLeft: '1px solid var(--border)'
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
              {isEditing ? <Edit2 className="h-4 w-4" style={{ color: 'var(--primary)' }} /> : <Plus className="h-4 w-4" style={{ color: 'var(--primary)' }} />}
              {isEditing ? `Edit Task ${task.id}` : 'Create New Conformance Task'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-zinc-800/10 dark:hover:bg-zinc-800/50"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs Bar inside Modal */}
        <div className="px-6 bg-zinc-950/40 border-b border-zinc-850 flex gap-4 text-xs font-mono shrink-0">
          {[
            { id: "details", label: "Details", icon: Edit2 },
            { id: "checklist", label: `Checklist (${subtasks.length})`, icon: ListTodo },
            { id: "comments", label: `Comments (${comments.length})`, icon: MessageSquare },
            { id: "history", label: `Activity (${task?.history?.length || 0})`, icon: Activity }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer font-semibold ${
                  isActive ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body with Tab Contents */}
        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4 min-h-0 text-xs">
          
          {/* 1. DETAILS TAB */}
          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="fx-section-label">Task Title</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Validate checksum on FIX Logon session"
                  className={inputCls} style={inputSty}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="fx-section-label">Description / Conformance Checklist</label>
                <textarea
                  value={desc} onChange={(e) => setDesc(e.target.value)}
                  placeholder="Explain message flow, expected tags, and testing scripts…"
                  className={`${inputCls} resize-none`} style={{ ...inputSty, height: '6rem' }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="fx-section-label">Assignee</label>
                  <input
                    type="text" value={assignee} onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Developer name"
                    className={inputCls} style={inputSty}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="fx-section-label">Status</label>
                  <select
                    value={status} onChange={(e) => setStatus(e.target.value)}
                    className={inputCls} style={{ ...inputSty, fontFamily: 'var(--font-mono)' }}
                  >
                    {Object.keys(columnsConfig).map(colId => (
                      <option key={colId} value={colId}>{columnsConfig[colId].label}</option>
                    ))}
                  </select>
                </div>
                {rowsConfig && rowsConfig.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="fx-section-label">Swimlane / Row</label>
                    <select
                      value={rowId} onChange={(e) => setRowId(e.target.value)}
                      className={inputCls} style={{ ...inputSty, fontFamily: 'var(--font-mono)' }}
                    >
                      {rowsConfig.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="fx-section-label">Priority</label>
                  <select
                    value={priority} onChange={(e) => setPriority(e.target.value)}
                    className={inputCls} style={{ ...inputSty, fontFamily: 'var(--font-mono)' }}
                  >
                    <option value="high">🔥 High</option>
                    <option value="medium">⚡ Medium</option>
                    <option value="low">💤 Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="fx-section-label">Prerequisite Tasks (Blocked By)</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 rounded-xl border border-zinc-850 bg-zinc-950/40">
                  {allTasksList.filter(t => t.id !== task?.id).length === 0 ? (
                    <span className="text-[10px] text-zinc-500 italic">No other tasks to select as blockers.</span>
                  ) : (
                    allTasksList.filter(t => t.id !== task?.id).map(ot => {
                      const isSelected = blockedBy.includes(ot.id);
                      return (
                        <button
                          key={ot.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setBlockedBy(blockedBy.filter(id => id !== ot.id));
                            } else {
                              setBlockedBy([...blockedBy, ot.id]);
                            }
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded-lg border flex items-center gap-1 transition-all ${
                            isSelected 
                              ? "bg-red-500/10 border-red-500/30 text-red-400 font-bold font-mono" 
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 font-mono"
                          }`}
                        >
                          {isSelected ? "⚠️" : ""} {ot.id}: {ot.title.slice(0, 20)}...
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. CHECKLIST TAB */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-zinc-300">Progress Checklist</span>
                  <span className="text-[var(--primary)] font-bold">{completedCount}/{subtasks.length} ({progressPercent}%)</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-850 border border-zinc-800">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Subtask list */}
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {subtasks.length === 0 ? (
                  <p className="text-zinc-500 italic font-mono py-4 text-center border border-dashed border-zinc-800 rounded-xl">
                    No subtasks defined. Add one below.
                  </p>
                ) : (
                  subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-850 gap-3"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubtask(sub.id)}
                          className="accent-[var(--primary)] h-4 w-4 shrink-0 rounded"
                        />
                        <span className={`truncate font-mono ${sub.completed ? "line-through text-zinc-500" : "text-zinc-300"}`}>
                          {sub.text}
                        </span>
                      </label>
                      <button
                        onClick={() => deleteSubtask(sub.id)}
                        className="text-red-400 hover:text-red-500 shrink-0 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add subtask */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Add a new checklist task..."
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                  className="flex-1 px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-xl outline-none text-xs text-zinc-300 focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  className="fx-btn-primary"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
          )}

          {/* 3. COMMENTS TAB */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {/* Comment Input */}
              <div className="flex gap-2 items-start">
                <textarea
                  placeholder="Write a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-xl outline-none text-xs text-zinc-300 focus:border-[var(--primary)] resize-none h-14"
                />
                <button
                  type="button"
                  onClick={addComment}
                  className="fx-btn-primary shrink-0 self-stretch flex items-center justify-center"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Post
                </button>
              </div>

              {/* Comments Feed */}
              <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-zinc-500 italic py-4 text-center font-mono border border-dashed border-zinc-800 rounded-xl">
                    No comments yet.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="font-bold text-[var(--primary)] flex items-center gap-1">
                          <User className="h-3 w-3" /> {c.author}
                        </span>
                        <span className="text-zinc-500">{new Date(c.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-mono pl-1">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. ACTIVITY TIMELINE TAB */}
          {activeTab === "history" && (
            <div className="space-y-4 pr-1">
              <div className="relative border-l border-zinc-800 ml-3.5 pl-6 space-y-4 max-h-[220px] overflow-y-auto">
                {(!task?.history || task.history.length === 0) ? (
                  <p className="text-zinc-500 italic font-mono">No activity logged.</p>
                ) : (
                  [...task.history].reverse().map((h, idx) => (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[30px] top-1 mt-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-[var(--primary)] ring-4 ring-zinc-950" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-zinc-300 font-mono">{h.text || h}</p>
                        <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {h.timestamp ? new Date(h.timestamp).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 mt-auto shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <div>
            {isEditing && (
              <button
                onClick={() => { onDelete(task.id, task.status); onClose(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="fx-btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={!title.trim()} className="fx-btn-primary">
              <CheckCircle className="h-3.5 w-3.5" /> Save Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [columns, setColumns] = useState(DEFAULT_COLUMN_CONFIG);
  const [rows, setRows] = useState([{ id: 'default', label: 'General' }]);
  const [tasks, setTasks] = useState(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeId, setActiveId] = useState(null);

  // Search & Filter state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoaded, setIsLoaded] = useState(false);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  // Load tasks, columns, rows from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTasks = localStorage.getItem('fixify-kanban-tasks');
    const savedColumns = localStorage.getItem('fixify-kanban-columns');
    const savedRows = localStorage.getItem('fixify-kanban-rows');
    
    if (savedColumns) {
      try {
        setColumns(JSON.parse(savedColumns));
      } catch (e) {}
    }
    if (savedRows) {
      try {
        setRows(JSON.parse(savedRows));
      } catch (e) {}
    }
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        if (parsed && !Array.isArray(parsed)) {
          // Migrate old nested format to flat array
          const flat = [];
          Object.keys(parsed).forEach(colId => {
            if (Array.isArray(parsed[colId])) {
              parsed[colId].forEach(t => {
                flat.push({ ...t, status: colId, row: t.row || 'default' });
              });
            }
          });
          setTasks(flat);
        } else if (Array.isArray(parsed)) {
          setTasks(parsed);
        }
      } catch (e) {
        setTasks(initialTasks);
      }
    } else {
      setTasks(initialTasks);
    }
    setIsLoaded(true);
  }, []);

  // Save tasks, columns, rows to localStorage on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem('fixify-kanban-tasks', JSON.stringify(tasks));
      localStorage.setItem('fixify-kanban-columns', JSON.stringify(columns));
      localStorage.setItem('fixify-kanban-rows', JSON.stringify(rows));
    } catch (e) {}
  }, [tasks, columns, rows, isLoaded]);

  // Configure pointer sensor to distinguish between clicks and drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    const { over, active } = event;
    if (!over) return;
    
    const [toRow, toCol] = over.id.split('::');
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;
    
    const fromCol = task.status;
    const fromRow = task.row || 'default';
    if (fromCol === toCol && fromRow === toRow) return;
    
    const updatedHistory = task.history
      ? [...task.history, { text: `Moved: ${fromCol}/${fromRow} → ${toCol}/${toRow}`, timestamp: new Date().toISOString() }]
      : [{ text: `Moved: ${fromCol}/${fromRow} → ${toCol}/${toRow}`, timestamp: new Date().toISOString() }];
      
    setTasks(prev => prev.map(t => t.id === active.id ? { ...t, status: toCol, row: toRow, history: updatedHistory } : t));
  };

  const saveTask = (task) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        return prev.map(t => t.id === task.id ? task : t);
      } else {
        return [...prev, task];
      }
    });
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const getCellTasks = (rowId, colId) => {
    return tasks.filter(task => {
      const isStatusMatch = task.status === colId;
      const isRowMatch = (task.row || 'default') === rowId;
      if (!isStatusMatch || !isRowMatch) return false;
      
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignee || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  };

  const hasActiveFilters = searchQuery !== "" || priorityFilter !== "all";
  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Kanban Tasks
          </h1>
          <p className="text-sm font-sans" style={{ color: 'var(--text-muted)' }}>
            Track implementation progress, conformance milestones, and team swimlanes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="fx-btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            title="Configure columns and swimlanes"
          >
            <Settings className="h-4 w-4" /> <span>Board Settings</span>
          </button>
          <button
            onClick={() => { setSelectedTask(null); setModalOpen(true); }}
            className="fx-btn-primary shrink-0"
            title="New Task"
          >
            <Plus className="h-4 w-4" /> <span className="inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="flex flex-col sm:flex-row gap-3 p-3.5 rounded-2xl items-stretch sm:items-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by title, description, assignee, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-zinc-950/50 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-xl text-xs font-mono text-zinc-300"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider hidden md:inline">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-850 rounded-xl text-xs font-mono outline-none cursor-pointer text-zinc-300 focus:border-[var(--primary)]"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Clear filter indicator */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] font-bold font-mono px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 flex items-center gap-1 transition-colors cursor-pointer"
            title="Clear Filters"
          >
            <Trash2 className="h-3 w-3" /> <span className="hidden sm:inline">Clear Filters</span>
          </button>
        )}
      </div>

      {/* Grid Canvas */}
      {/* Desktop Grid Board (hidden on mobile/tablet) */}
      <div className="hidden lg:block">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="w-full overflow-x-auto pb-4">
            <div 
              className="border rounded-2xl bg-zinc-950/20 overflow-hidden flex flex-col backdrop-blur-md min-w-[900px] lg:min-w-0 border-[var(--border)]"
            >
              {/* Top Header Row for Column Names */}
              <div className="flex border-b bg-zinc-900/40 select-none border-[var(--border)]">
                {Object.keys(columns).map(col => {
                  const cfg = columns[col];
                  return (
                    <div 
                      key={col} 
                      className="flex-1 px-5 py-4 flex items-center justify-between border-r last:border-r-0 border-[var(--border)] min-w-[280px] lg:min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                        <span className="text-xs font-bold font-mono uppercase tracking-wider truncate" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border text-zinc-400 border-[var(--border)]">
                        {tasks.filter(t => t.status === col).length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rows / Swimlanes */}
              <div className="divide-y divide-[var(--border)] border-[var(--border)]">
                {rows.map(row => {
                  const rowTasks = tasks.filter(t => (t.row || 'default') === row.id);
                  return (
                    <div key={row.id} className="flex flex-col">
                      {/* Swimlane Header (only if multiple rows exist) */}
                      {rows.length > 1 && (
                        <div 
                          className="px-5 py-2.5 bg-zinc-900/10 border-b flex items-center justify-between border-[var(--border)]"
                        >
                          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-[var(--primary)]" />
                            {row.label}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {rowTasks.length} {rowTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      )}

                      {/* Columns Cells row */}
                      <div className="flex divide-r divide-[var(--border)]">
                        {Object.keys(columns).map(col => {
                          const cellTasks = getCellTasks(row.id, col);
                          return (
                            <DroppableCell
                              key={col}
                              rowId={row.id}
                              colId={col}
                              columnConfig={columns[col]}
                              tasks={cellTasks}
                              onTaskClick={(task) => { setSelectedTask(task); setModalOpen(true); }}
                              allTasksList={tasks}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeId && activeTask ? (
              <div style={{ transform: 'rotate(2deg)', opacity: 0.95, cursor: 'grabbing' }}>
                <TaskCard task={activeTask} allTasksList={tasks} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile Stacked Board (vertical columns list, active on mobile) */}
      <div className="flex lg:hidden flex-col gap-6">
        {Object.keys(columns).map(col => {
          const colTasks = tasks.filter(t => t.status === col);
          const colConfig = columns[col];
          return (
            <div 
              key={col} 
              className="border rounded-2xl bg-zinc-950/20 overflow-hidden flex flex-col"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Column Header */}
              <div 
                className="px-5 py-3.5 flex items-center justify-between border-b bg-zinc-900/40"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colConfig.color }} />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: colConfig.color }}>
                    {colConfig.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border text-zinc-400 border-[var(--border)]">
                  {colTasks.length}
                </span>
              </div>

              {/* Column Body - Tasks grouped by Swimlanes */}
              <div className="p-4 space-y-4">
                {colTasks.length === 0 ? (
                  <div className="py-6 flex items-center justify-center rounded-xl text-[10px] text-zinc-500 border border-dashed border-zinc-800/40 bg-zinc-900/5 select-none font-mono">
                    No tasks in this column
                  </div>
                ) : (
                  rows.map(row => {
                    const cellTasks = colTasks.filter(t => {
                      const isRowMatch = (t.row || 'default') === row.id;
                      
                      // Also apply toolbar search/filters
                      const matchesSearch =
                        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.assignee || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.id.toLowerCase().includes(searchQuery.toLowerCase());

                      const matchesPriority =
                        priorityFilter === "all" || t.priority === priorityFilter;

                      return isRowMatch && matchesSearch && matchesPriority;
                    });
                    
                    if (cellTasks.length === 0 && rows.length <= 1) return null;
                    return (
                      <div key={row.id} className="space-y-2">
                        {rows.length > 1 && (
                          <div className="flex items-center gap-1.5 px-1 py-0.5">
                            <Layers className="h-3 w-3 text-[var(--primary)]" />
                            <span className="text-[10px] font-bold text-zinc-400 font-mono">{row.label}</span>
                          </div>
                        )}
                        <div className="space-y-3">
                          {cellTasks.map(task => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              onClick={() => { setSelectedTask(task); setModalOpen(true); }}
                              allTasksList={tasks} 
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Modal Editor */}
      {modalOpen && (
        <TaskModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={saveTask}
          onDelete={deleteTask}
          task={selectedTask}
          allTasksList={tasks}
          columnsConfig={columns}
          rowsConfig={rows}
        />
      )}

      {/* Board Settings Modal */}
      {settingsOpen && (
        <BoardSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          columns={columns}
          setColumns={setColumns}
          rows={rows}
          setRows={setRows}
          tasks={tasks}
          setTasks={setTasks}
        />
      )}
    </div>
  );
}

function BoardSettingsModal({ 
  isOpen, 
  onClose, 
  columns, 
  setColumns, 
  rows, 
  setRows, 
  tasks, 
  setTasks 
}) {
  const [activeTab, setActiveTab] = useState('columns'); // 'columns' | 'rows'
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState('#3b82f6');
  const [newRowName, setNewRowName] = useState('');

  if (!isOpen) return null;

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const colId = `col-${Date.now()}`;
    setColumns(prev => ({
      ...prev,
      [colId]: {
        label: newColName.trim(),
        color: newColColor,
        bg: `${newColColor}0a`
      }
    }));
    setNewColName('');
  };

  const handleRenameColumn = (colId, label) => {
    if (!label.trim()) return;
    setColumns(prev => ({
      ...prev,
      [colId]: {
        ...prev[colId],
        label: label.trim()
      }
    }));
  };

  const handleColorChange = (colId, color) => {
    setColumns(prev => ({
      ...prev,
      [colId]: {
        ...prev[colId],
        color,
        bg: `${color}0a`
      }
    }));
  };

  const handleDeleteColumn = (colId) => {
    const colKeys = Object.keys(columns);
    if (colKeys.length <= 1) {
      alert("You must keep at least one column.");
      return;
    }
    const targetCol = colKeys.find(k => k !== colId);
    
    // Move tasks in this column to targetCol
    setTasks(prev => prev.map(t => t.status === colId ? { ...t, status: targetCol } : t));
    
    setColumns(prev => {
      const copy = { ...prev };
      delete copy[colId];
      return copy;
    });
  };

  const handleAddRow = () => {
    if (!newRowName.trim()) return;
    const rowId = `row-${Date.now()}`;
    setRows(prev => [...prev, { id: rowId, label: newRowName.trim() }]);
    setNewRowName('');
  };

  const handleRenameRow = (rowId, label) => {
    if (!label.trim()) return;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, label: label.trim() } : r));
  };

  const handleDeleteRow = (rowId) => {
    if (rows.length <= 1) {
      alert("You must keep at least one swimlane row.");
      return;
    }
    const targetRow = rows.find(r => r.id !== rowId).id;
    
    // Move tasks in this row to targetRow
    setTasks(prev => prev.map(t => (t.row || 'default') === rowId ? { ...t, row: targetRow } : t));
    
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-lg rounded-2xl border flex flex-col max-h-[90vh] overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground)] font-mono flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--primary)]" />
            Board Settings
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex-1 py-3 text-center text-xs font-mono font-bold uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'columns' ? 'border-[var(--primary)] text-[var(--primary)] bg-zinc-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Columns
          </button>
          <button
            onClick={() => setActiveTab('rows')}
            className={`flex-1 py-3 text-center text-xs font-mono font-bold uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'rows' ? 'border-[var(--primary)] text-[var(--primary)] bg-zinc-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Swimlane Rows
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'columns' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Current Columns</span>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {Object.keys(columns).map(colId => {
                    const col = columns[colId];
                    return (
                      <div key={colId} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800">
                        <input
                          type="color"
                          value={col.color.startsWith('var') ? '#00e676' : col.color}
                          onChange={(e) => handleColorChange(colId, e.target.value)}
                          className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                        />
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => handleRenameColumn(colId, e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-zinc-950/60 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-lg text-xs font-semibold text-zinc-200"
                        />
                        <button
                          onClick={() => handleDeleteColumn(colId)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Column"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-zinc-850" />

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Add New Column</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newColColor}
                    onChange={(e) => setNewColColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent self-center"
                  />
                  <input
                    type="text"
                    placeholder="Column Label (e.g. Code Review)"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-lg text-xs font-semibold text-zinc-200"
                  />
                  <button
                    onClick={handleAddColumn}
                    className="fx-btn-primary px-3 py-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Current Swimlanes</span>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {rows.map(row => (
                    <div key={row.id} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center bg-zinc-950 text-zinc-400">
                        <Layers className="h-3.5 w-3.5 text-zinc-500" />
                      </div>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => handleRenameRow(row.id, e.target.value)}
                        className="flex-1 px-2.5 py-1 bg-zinc-950/60 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-lg text-xs font-semibold text-zinc-200"
                      />
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Delete Swimlane"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-zinc-850" />

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Add New Swimlane</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Swimlane Name (e.g. Sprint 2 / Critical Fixes)"
                    value={newRowName}
                    onChange={(e) => setNewRowName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-[var(--primary)] outline-none rounded-lg text-xs font-semibold text-zinc-200"
                  />
                  <button
                    onClick={handleAddRow}
                    className="fx-btn-primary px-3 py-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="fx-btn-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
