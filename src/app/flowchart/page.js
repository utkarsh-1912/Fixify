'use client'
import React, { useCallback } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  { id: '1', data: { label: 'Start' }, position: { x: 50, y: 50 } },
  { id: '2', data: { label: 'Process' }, position: { x: 300, y: 50 } },
  { id: '3', data: { label: 'End' }, position: { x: 550, y: 50 } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }, { id: 'e2-3', source: '2', target: '3' }];

export default function FlowchartPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const exportJSON = () => {
    const json = JSON.stringify({ nodes, edges }, null, 2);
    // download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'flow.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[72vh] border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-lg font-medium text-gray-800">Flowchart Editor</h2>
        <div className="space-x-2">
          <button onClick={exportJSON} className="px-3 py-1 rounded bg-red-500 text-white hover:opacity-90">Export JSON</button>
        </div>
      </div>

      <div className="h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          style={{ width: '100%', height: '100%' }}
        >
          <Background gap={12} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
