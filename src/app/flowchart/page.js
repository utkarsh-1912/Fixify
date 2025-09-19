"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  Handle,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

/* ----------------------
   Node components
---------------------- */
function InlineLabel({ node, updateLabel }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.data.label || "");
  useEffect(() => setValue(node.data.label || ""), [node.data.label]);

  return editing ? (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        updateLabel(node.id, value.trim() === "" ? "Untitled" : value);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          updateLabel(node.id, value.trim() === "" ? "Untitled" : value);
          setEditing(false);
        }
        if (e.key === "Escape") {
          setValue(node.data.label || "");
          setEditing(false);
        }
      }}
      className="w-full px-1 py-0.5 text-sm text-gray-800 border border-gray-200 rounded"
      style={{ background: "white" }}
    />
  ) : (
    <div
      onDoubleClick={() => setEditing(true)}
      onClick={() => setEditing(true)}
      className="text-sm text-gray-800 select-none"
    >
      {node.data.label}
    </div>
  );
}

const StartNode = ({ id, data }) => (
  <div className="px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-800 text-sm font-medium shadow-sm">
    <Handle type="source" position={Position.Right} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
    <Handle type="target" position={Position.Left} />
  </div>
);

const ProcessNode = ({ id, data }) => (
  <div className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-800 text-sm font-medium shadow-sm">
    <Handle type="target" position={Position.Left} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
    <Handle type="source" position={Position.Right} />
  </div>
);

const DecisionNode = ({ id, data }) => (
  <div style={{ width: 110, height: 110 }} className="flex items-center justify-center">
    <div
      style={{ transform: "rotate(45deg)" }}
      className="w-24 h-24 flex items-center justify-center border border-gray-300 bg-white shadow-sm"
    >
      <div style={{ transform: "rotate(-45deg)" }}>
        <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
      </div>
    </div>
    <Handle type="target" position={Position.Left} style={{ left: -10 }} />
    <Handle type="source" position={Position.Right} style={{ right: -10 }} />
    <Handle type="source" position={Position.Bottom} style={{ bottom: -10 }} />
  </div>
);

const MilestoneNode = ({ id, data }) => (
  <div className="px-3 py-2 bg-white border-t-2 border-gray-300 rounded text-gray-800 text-sm font-medium shadow-sm">
    <Handle type="target" position={Position.Top} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const EndNode = ({ id, data }) => (
  <div className="px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-800 text-sm font-medium shadow-sm">
    <Handle type="target" position={Position.Left} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
  </div>
);

const nodeTypes = {
  start: StartNode,
  process: ProcessNode,
  decision: DecisionNode,
  milestone: MilestoneNode,
  end: EndNode,
};

/* ----------------------
   Dagre layout
---------------------- */
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

function getDagreLayout(nodes, edges, direction = "LR") {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((n) => {
    dagreGraph.setNode(n.id, { width: n.data._width || 160, height: n.data._height || 48 });
  });

  edges.forEach((e) => {
    dagreGraph.setEdge(e.source, e.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((n) => {
    const nodeWithPos = dagreGraph.node(n.id);
    return {
      ...n,
      position: {
        x: (nodeWithPos.x || n.position.x) - (n.data._width || 160) / 2,
        y: (nodeWithPos.y || n.position.y) - (n.data._height || 48) / 2,
      },
    };
  });
}

/* ----------------------
   Main Flowchart Component
---------------------- */
function FlowchartPage() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const updateNodeLabel = useCallback((id, label) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
  }, []);

  const stampUpdateLabel = useCallback(
    (nodeList) =>
      nodeList.map((n) => ({
        ...n,
        data: { ...(n.data || {}), updateLabel: (id, label) => updateNodeLabel(id, label), ...n.data },
      })),
    [updateNodeLabel]
  );

  useEffect(() => {
    setNodes((nds) => stampUpdateLabel(nds));
  }, [stampUpdateLabel]);

  const createNodeOfType = useCallback(
    (type, position) => {
      const id = `${Date.now()}`;
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const node = { id, type, position, data: { label, updateLabel: updateNodeLabel, meta: {} } };
      setNodes((nds) => nds.concat(node));
      return node;
    },
    [updateNodeLabel]
  );

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !rfInstance) return;
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = rfInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      createNodeOfType(type, position);
      setTimeout(() => rfInstance.fitView({ padding: 0.1 }), 80);
    },
    [rfInstance, createNodeOfType]
  );

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
    setSelectedNode(null);
  }, []);

  const updateSelectedMeta = useCallback(
    (patch) => {
      if (!selectedNode) return;
      setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [selectedNode]
  );

  const autoArrange = useCallback(
    (dir = "LR") => {
      if (!nodes.length) return;
      const positioned = getDagreLayout(nodes, edges, dir);
      setNodes(positioned);
      setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.1 }), 80);
    },
    [nodes, edges, rfInstance]
  );

  const onInit = useCallback((instance) => setRfInstance(instance), []);

  const handleSelectionChange = useCallback((sel) => {
    const selNodes = sel && sel.nodes ? sel.nodes : [];
    if (selNodes && selNodes.length) setSelectedNode(selNodes[0]);
    else setSelectedNode(null);
  }, []);

  /* JSON export/import */
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchart.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const importJSON = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            alert("Invalid format: expected { nodes: [], edges: [] }");
            return;
          }
          const stamped = parsed.nodes.map((n) => ({ ...n, data: { ...(n.data || {}), updateLabel } }));
          setNodes(stamped);
          setEdges(parsed.edges);
          setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.1 }), 80);
        } catch {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [rfInstance]
  );

  const resetChart = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  }, []);

  /* metadata pane */
  const MetaPane = () => {
    if (!selectedNode) return <div className="p-3 text-sm text-gray-600">No node selected.</div>;
    const node = selectedNode;
    const meta = node.data.meta || {};
    return (
      <div className="p-3 space-y-2 border border-gray-200 rounded bg-gray-50">
        <div className="text-xs text-gray-700 font-medium">Label</div>
        <input
          value={node.data.label || ""}
          onChange={(e) => updateSelectedMeta({ label: e.target.value })}
          className="w-full px-2 py-1 border border-gray-200 bg-white rounded text-sm"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={deleteSelected} className="px-2 py-1 text-sm bg-red-600 text-white rounded">
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold mb-4 text-center text-gray-800">Flowchart Maker</h1>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-y-4 sm:gap-x-4">
        <aside className="col-span-1 p-3 border rounded bg-white shadow-sm">
          <div className="text-sm font-medium text-gray-800">Palette</div>
          <div className="text-xs font-medium text-gray-400 mb-2">(Drag and drop in panel)</div>
          {[{ key: "start" }, { key: "process" }, { key: "decision" }, { key: "milestone" }, { key: "end" }].map((s) => (
            <div
              key={s.key}
              draggable
              onDragStart={(e) => onDragStart(e, s.key)}
              className="px-3 py-1 my-1 border border-gray-300 rounded text-gray-800 text-sm bg-white cursor-grab select-none"
            >
              {s.key}
            </div>
          ))}
          <hr className="my-3 border-gray-200" />
          <div className="space-y-2 mt-4">
            {/* Export Button */}
            <button
              onClick={exportJSON}
              className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-400"
            >
              Export
            </button>
          
            {/* Import Button + Hidden Input */}
            <input
              type="file"
              id="jsonFileInput"
              accept="application/json"
              onChange={importJSON}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById("jsonFileInput")?.click()}
              className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
            >
              Import
            </button>
          
            {/* Reset Button */}
            <button
              onClick={resetChart}
              className="w-full px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
        </aside>

        <section className="col-span-3 md:col-span-4 h-[72vh] border rounded shadow-sm bg-white" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onSelectionChange={handleSelectionChange}
            fitView
            style={{ width: "100%", height: "100%" }}
          >
            <Background gap={16} color="#f3f4f6" />
            <Controls />
          </ReactFlow>
        </section>

        <aside className="col-span-1 p-3 border rounded bg-white shadow-sm">
          <div className="text-sm font-medium text-gray-800 mb-2">Properties</div>
          <MetaPane />
          <div className="mt-2 text-xs text-gray-600">Auto arrange</div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => autoArrange("LR")} className="px-2 py-1 border border-gray-300 rounded text-sm">
              Left→Right
            </button>
            <button onClick={() => autoArrange("TB")} className="px-2 py-1 border border-gray-300 rounded text-sm">
              Top→Bottom
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ----------------------
   Wrap in ReactFlowProvider
---------------------- */
export default function FlowchartPageWrapper() {
  return (
    <ReactFlowProvider>
      <FlowchartPage />
    </ReactFlowProvider>
  );
}
