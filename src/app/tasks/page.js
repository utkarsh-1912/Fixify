"use client";
import { useState } from "react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

const initialTasks = { todo: [], doing: [], done: [] };

// ---------- Droppable Column ----------
function DroppableColumn({ id, title, tasks, onTaskClick }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex-1 bg-white rounded-lg p-4 shadow border border-gray-200 min-h-[400px] flex flex-col"
    >
      <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
        {title}
      </h2>

      <div className="flex-1 space-y-3">
        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 italic">No tasks...</p>
        )}
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            id={task.id}
            task={task}
            onClick={() => onTaskClick(task, id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Draggable Task ----------
function DraggableTask({ id, task, onClick }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className="bg-gray-50 border border-gray-200 rounded-md p-3 shadow-sm hover:shadow cursor-pointer transition"
    >
      <p className="font-medium text-gray-700">{task.title}</p>
      {task.assignee && (
        <p className="text-xs text-gray-500 mt-1">👤 {task.assignee}</p>
      )}
    </div>
  );
}

// ---------- Task Modal (Add/Edit) ----------
function TaskModal({ isOpen, onClose, onSave, onDelete, task }) {
  const isEditing = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [status, setStatus] = useState(task?.status || "todo");
  const [assignee, setAssignee] = useState(task?.assignee || "");

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setAssignee("");
    setStatus("todo");
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const newTask = {
      id: task?.id || Date.now().toString(),
      title,
      description: desc,
      assignee,
      status,
      comments: task?.comments || [],
      history: task?.history
        ? [...task.history, isEditing ? "✏️ Edited task" : "🆕 Task created"]
        : ["🆕 Task created"],
    };
    onSave(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="bg-white rounded-lg w-full max-w-lg shadow-lg relative z-10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700">
            {isEditing ? "✏️ Edit Task" : "➕ New Task"}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                onDelete(task.id, task.status);
                onClose();
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm"
            >
              <TrashIcon className="w-4 h-4" /> Delete
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Assignee
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="todo">📝 To Do</option>
              <option value="doing">🚧 Doing</option>
              <option value="done">✅ Done</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={resetForm}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Kanban Page ----------
export default function KanbanPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleDragEnd = (event) => {
    const { over, active } = event;
    if (!over) return;

    const fromCol = Object.keys(tasks).find((col) =>
      tasks[col].some((t) => t.id === active.id)
    );
    const toCol = over.id;
    if (fromCol === toCol) return;

    const task = tasks[fromCol].find((t) => t.id === active.id);
    const newFrom = tasks[fromCol].filter((t) => t.id !== active.id);
    const updatedTask = {
      ...task,
      status: toCol,
      history: [...task.history, `Moved from ${fromCol} → ${toCol}`],
    };

    const newTo = [...tasks[toCol], updatedTask];
    setTasks({ ...tasks, [fromCol]: newFrom, [toCol]: newTo });
  };

  const saveTask = (task) => {
    setTasks((prev) => {
      let updated = { ...prev };

      // Remove from old column if exists
      Object.keys(updated).forEach(
        (col) => (updated[col] = updated[col].filter((t) => t.id !== task.id))
      );

      // Add to new column
      updated[task.status] = [...updated[task.status], task];
      return updated;
    });
  };

  const deleteTask = (id, columnId) => {
    setTasks((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== id),
    }));
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">📋 Kanban Board</h1>
        <button
          onClick={() => {
            setSelectedTask(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          <PlusIcon className="w-5 h-5" /> New Task
        </button>
      </div>

      {/* Board */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DroppableColumn
            id="todo"
            title="To Do"
            tasks={tasks.todo}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setModalOpen(true);
            }}
          />
          <DroppableColumn
            id="doing"
            title="In Progress"
            tasks={tasks.doing}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setModalOpen(true);
            }}
          />
          <DroppableColumn
            id="done"
            title="Done"
            tasks={tasks.done}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setModalOpen(true);
            }}
          />
        </div>
      </DndContext>

      {/* Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
        onDelete={deleteTask}
        task={selectedTask}
      />
    </main>
  );
}
