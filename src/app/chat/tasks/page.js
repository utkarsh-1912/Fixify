"use client";
import { useState } from "react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

const initialTasks = {
  todo: ["Set up project", "Design UI"],
  doing: ["Integrate API"],
  done: ["Create repo"],
};

function DroppableColumn({ id, title, tasks, onDrop }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-1 bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      {tasks.map((task, i) => (
        <DraggableTask key={id + i} id={id + "-" + i} text={task} columnId={id} onDrop={onDrop} />
      ))}
    </div>
  );
}

function DraggableTask({ id, text }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className="bg-white border rounded-md p-2 mb-2 shadow hover:shadow-md cursor-grab"
    >
      {text}
    </div>
  );
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState(initialTasks);

  const handleDragEnd = (event) => {
    const { over, active } = event;
    if (!over) return;

    const [fromCol] = active.id.split("-");
    const toCol = over.id;
    if (fromCol === toCol) return;

    // Move task
    const taskText = tasks[fromCol].find((t, i) => `${fromCol}-${i}` === active.id);
    const newFrom = tasks[fromCol].filter((t, i) => `${fromCol}-${i}` !== active.id);
    const newTo = [...tasks[toCol], taskText];

    setTasks({ ...tasks, [fromCol]: newFrom, [toCol]: newTo });
  };

  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 Kanban Board</h1>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DroppableColumn id="todo" title="📝 To Do" tasks={tasks.todo} />
          <DroppableColumn id="doing" title="🚧 Doing" tasks={tasks.doing} />
          <DroppableColumn id="done" title="✅ Done" tasks={tasks.done} />
        </div>
      </DndContext>
    </main>
  );
}
