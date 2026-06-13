'use client';

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
import {
  FileText,
  Network,
  Share2,
  Upload,
  RefreshCw,
  Layout,
  Plus,
  Trash2,
  AlertTriangle,
  Search,
  BookOpen,
  X,
  Wrench,
  Sliders,
  ChevronDown
} from "lucide-react";
import { toPng } from "html-to-image";
import { validateFIXMessage } from "@/lib/fixParser";

/* ----------------------
   Predefined Industry Scenario Logs
   Complete with realistic tag structures and sequence numbers.
---------------------- */
const INDUSTRY_SCENARIOS = {
  logon: [
    "8=FIX.4.2|9=68|35=A|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1|52=20260613-10:00:00.000|98=0|108=30|10=112|",
    "8=FIX.4.2|9=68|35=A|49=BROKER_GATEWAY|56=CLIENT_DESK|34=1|52=20260613-10:00:00.045|98=0|108=30|10=112|"
  ],
  orderExecution: [
    "8=FIX.4.2|9=68|35=A|49=CLIENT_DESK|56=BROKER_GATEWAY|34=1|52=20260613-10:00:00.000|98=0|108=30|10=112|",
    "8=FIX.4.2|9=125|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=2|52=20260613-10:00:05.120|11=CLORD_77312|21=1|55=MSFT|54=1|60=20260613-10:00:05|38=100|40=2|44=150.00|10=092|",
    "8=FIX.4.2|9=151|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=2|52=20260613-10:00:05.160|37=ORD_30922|11=CLORD_77312|17=EXEC_001A|20=0|150=0|39=0|55=MSFT|54=1|38=100|151=100|14=0|32=0|31=0|10=191|",
    "8=FIX.4.2|9=162|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=3|52=20260613-10:00:05.280|37=ORD_30922|11=CLORD_77312|17=EXEC_001B|20=0|150=2|39=2|55=MSFT|54=1|38=100|151=0|14=100|32=100|31=150.00|6=150.00|10=210|"
  ],
  cancelReplace: [
    "8=FIX.4.2|9=125|35=D|49=CLIENT_DESK|56=BROKER_GATEWAY|34=10|52=20260613-10:15:00.000|11=CL_ORIG_100|21=1|55=AAPL|54=1|60=20260613-10:15:00|38=200|40=2|44=180.00|10=104|",
    "8=FIX.4.2|9=151|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=10|52=20260613-10:15:00.040|37=ORD_5051|11=CL_ORIG_100|17=EX_100A|20=0|150=0|39=0|55=AAPL|54=1|38=200|151=200|14=0|32=0|31=0|10=198|",
    "8=FIX.4.2|9=142|35=G|49=CLIENT_DESK|56=BROKER_GATEWAY|34=11|52=20260613-10:15:15.000|41=CL_ORIG_100|11=CL_MOD_101|21=1|55=AAPL|54=1|60=20260613-10:15:15|38=300|40=2|44=181.50|10=111|",
    "8=FIX.4.2|9=168|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=11|52=20260613-10:15:15.045|37=ORD_5051|11=CL_MOD_101|41=CL_ORIG_100|17=EX_100B|20=0|150=5|39=5|55=AAPL|54=1|38=300|151=300|14=0|32=0|31=0|10=218|",
    "8=FIX.4.2|9=112|35=F|49=CLIENT_DESK|56=BROKER_GATEWAY|34=12|52=20260613-10:15:30.000|41=CL_MOD_101|11=CL_CNL_102|55=AAPL|54=1|60=20260613-10:15:30|10=097|",
    "8=FIX.4.2|9=168|35=8|49=BROKER_GATEWAY|56=CLIENT_DESK|34=12|52=20260613-10:15:30.035|37=ORD_5051|11=CL_CNL_102|41=CL_MOD_101|17=EX_100C|20=0|150=4|39=4|55=AAPL|54=1|38=300|151=0|14=0|32=0|31=0|10=213|"
  ],
  allocations: [
    "8=FIX.4.2|9=162|35=8|49=BROKER_GATEWAY|56=INST_DESK|34=105|52=20260613-11:00:00.000|37=BLKORD_882|11=BLKCL_882|17=EXEC_882|20=0|150=2|39=2|55=GOOGL|54=1|38=5000|151=0|14=5000|32=5000|31=175.25|6=175.25|10=010|",
    "8=FIX.4.2|9=188|35=J|49=INST_DESK|56=BROKER_GATEWAY|34=106|52=20260613-11:05:00.000|70=ALLOC_00122|71=1|62=20260613|78=2|79=ACC_FUND_ALPHA|80=3000|79=ACC_FUND_BETA|80=2000|55=GOOGL|54=1|38=5000|10=044|",
    "8=FIX.4.2|9=112|35=AS|49=BROKER_GATEWAY|56=INST_DESK|34=107|52=20260613-11:05:00.850|70=ALLOC_00122|71=1|87=0|88=0|10=052|"
  ],
  marketData: [
    "8=FIX.4.2|9=128|35=V|49=CLIENT_DESK|56=MARKET_FEED|34=200|52=20260613-12:00:00.000|262=MDREQ_001A|263=1|264=1|267=2|269=0|269=1|146=1|55=NVDA|10=121|",
    "8=FIX.4.2|9=178|35=W|49=MARKET_FEED|56=CLIENT_DESK|34=201|52=20260613-12:00:00.025|262=MDREQ_001A|55=NVDA|268=2|269=0|270=120.50|271=500|269=1|270=120.60|271=400|10=081|",
    "8=FIX.4.2|9=158|35=X|49=MARKET_FEED|56=CLIENT_DESK|34=202|52=20260613-12:00:00.500|262=MDREQ_001A|268=1|279=0|269=0|55=NVDA|270=120.55|271=600|10=092|"
  ]
};

/* ----------------------
   Node components
   Enhanced to support dark mode & properties
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
      className="px-1 py-0.5 text-xs text-zinc-150 border border-zinc-700 rounded bg-zinc-950 outline-none w-full"
    />
  ) : (
    <div
      onDoubleClick={() => setEditing(true)}
      className="text-xs text-zinc-200 select-none cursor-pointer text-center font-mono py-1 break-all"
    >
      {node.data.label}
    </div>
  );
}

const StartNode = ({ id, data }) => (
  <div className="px-4 py-2 bg-zinc-900 border-2 border-emerald-500 rounded-full text-zinc-200 text-xs shadow-md min-w-[140px] text-center">
    <Handle type="source" position={Position.Right} style={{ background: '#10b981' }} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
    <Handle type="target" position={Position.Left} style={{ background: '#10b981' }} />
  </div>
);

const ProcessNode = ({ id, data }) => {
  const isCorrupted = data.meta?.errors?.length > 0;
  return (
    <div className={`px-4 py-2.5 bg-zinc-900 border rounded-lg text-zinc-200 text-xs shadow-md min-w-[150px] text-center ${
      isCorrupted ? 'border-red-500/80 shadow-red-500/10' : 'border-zinc-750'
    }`}>
      <Handle type="target" position={Position.Left} style={{ background: '#71717a' }} />
      <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
      {data.meta?.clOrdID && (
        <div className="text-[9px] text-zinc-500 border-t border-zinc-800 mt-1 pt-1 truncate font-mono">
          ID: {data.meta.clOrdID}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#71717a' }} />
    </div>
  );
};

const DecisionNode = ({ id, data }) => (
  <div style={{ width: 110, height: 110 }} className="flex items-center justify-center relative">
    <div
      style={{ transform: "rotate(45deg)" }}
      className="w-20 h-20 flex items-center justify-center border border-zinc-750 bg-zinc-900 shadow-md rounded-md"
    >
      <div style={{ transform: "rotate(-45deg)" }} className="w-16">
        <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
      </div>
    </div>
    <Handle type="target" position={Position.Left} style={{ left: -3, background: '#71717a' }} />
    <Handle type="source" position={Position.Right} style={{ right: -3, background: '#71717a' }} />
    <Handle type="source" position={Position.Bottom} style={{ bottom: -3, background: '#71717a' }} />
  </div>
);

const MilestoneNode = ({ id, data }) => (
  <div className="px-4 py-2.5 bg-zinc-900 border-t-4 border-cyan-500 border-x border-b border-zinc-750 rounded text-zinc-250 text-xs shadow-md min-w-[150px] text-center">
    <Handle type="target" position={Position.Top} style={{ background: '#06b6d4' }} />
    <InlineLabel node={{ id, data }} updateLabel={data.updateLabel} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#06b6d4' }} />
  </div>
);

const EndNode = ({ id, data }) => (
  <div className="px-4 py-2 bg-zinc-900 border-2 border-red-500 rounded-full text-zinc-250 text-xs shadow-md min-w-[140px] text-center">
    <Handle type="target" position={Position.Left} style={{ background: '#ef4444' }} />
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

const StartIcon = () => (
  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <rect x={2} y={7} width={20} height={10} rx={5} />
  </svg>
);
const ProcessIcon = () => (
  <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <rect x={2} y={4} width={20} height={16} rx={1} />
  </svg>
);
const DecisionIcon = () => (
  <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path d="M12 2L22 12L12 22L2 12Z" />
  </svg>
);
const MilestoneIcon = () => (
  <svg className="w-4 h-4 text-cyan-405 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M4 6C4 3.8 7.6 2 12 2C16.4 2 20 3.8 20 6M4 6V18C4 20.2 7.6 22 12 22C16.4 22 20 20.2 20 18V6M4 6C4 8.2 7.6 10 12 10C16.4 10 20 8.2 20 6" />
  </svg>
);
const EndIcon = () => (
  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <rect x={2} y={7} width={20} height={10} rx={5} />
  </svg>
);

/* ----------------------
   Dagre layout helper
---------------------- */
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

function getDagreLayout(nodes, edges, direction = "LR") {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((n) => {
    let width = 160;
    let height = 48;
    if (n.type === "decision") {
      width = 110;
      height = 110;
    }
    dagreGraph.setNode(n.id, { width, height });
  });

  edges.forEach((e) => {
    dagreGraph.setEdge(e.source, e.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((n) => {
    const nodeWithPos = dagreGraph.node(n.id);
    let width = 160;
    let height = 48;
    if (n.type === "decision") {
      width = 110;
      height = 110;
    }
    return {
      ...n,
      position: {
        x: (nodeWithPos.x || n.position.x) - width / 2,
        y: (nodeWithPos.y || n.position.y) - height / 2,
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

  const [activeScenario, setActiveScenario] = useState("");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const [isDesktop, setIsDesktop] = useState(true);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkSize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) {
        setIsLeftDrawerOpen(false);
        setIsRightDrawerOpen(false);
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Search filter inside node property panel
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [tagPage, setTagPage] = useState(0);
  const TAG_PAGE_SIZE = 10;

  // Frequently accessed FIX tags for quick-filter chips
  const FREQUENT_TAGS = [
    { tag: '35', label: 'MsgType' },
    { tag: '49', label: 'Sender' },
    { tag: '56', label: 'Target' },
    { tag: '34', label: 'SeqNum' },
    { tag: '11', label: 'ClOrdID' },
    { tag: '55', label: 'Symbol' },
    { tag: '54', label: 'Side' },
    { tag: '44', label: 'Price' },
    { tag: '39', label: 'OrdStatus' },
    { tag: '10', label: 'Checksum' },
  ];
  const [userTemplates, setUserTemplates] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  /* Node Label Update */
  const updateNodeLabel = useCallback((id, label) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
    setActiveScenario("");
  }, [setActiveScenario]);

  const stampUpdateLabel = useCallback(
    (nodeList) =>
      nodeList.map((n) => ({
        ...n,
        data: { ...(n.data || {}), updateLabel: (id, label) => updateNodeLabel(id, label), ...n.data },
      })),
    [updateNodeLabel]
  );

  // Load initial states from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedNodes = localStorage.getItem('fixify-flowchart-nodes');
      const savedEdges = localStorage.getItem('fixify-flowchart-edges');
      if (savedNodes) {
        const parsedNodes = JSON.parse(savedNodes);
        const stamped = parsedNodes.map((n) => ({
          ...n,
          data: { ...(n.data || {}), updateLabel: updateNodeLabel }
        }));
        setNodes(stamped);
      }
      if (savedEdges) {
        setEdges(JSON.parse(savedEdges));
      }
      const savedTemplates = localStorage.getItem('fixify-flowchart-user-templates');
      if (savedTemplates) {
        setUserTemplates(JSON.parse(savedTemplates));
      }
      const savedScenario = localStorage.getItem('fixify-flowchart-activeScenario');
      if (savedScenario) {
        setActiveScenario(savedScenario);
      }
    } catch (e) {
      console.error("Failed to load flowchart state", e);
    }
    setIsLoaded(true);
  }, [updateNodeLabel]);

  // Save states to localStorage on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    if (nodes.length > 0) {
      try {
        const serializedNodes = nodes.map(({ data, ...rest }) => {
          const { updateLabel, ...restData } = data || {};
          return { ...rest, data: restData };
        });
        localStorage.setItem('fixify-flowchart-nodes', JSON.stringify(serializedNodes));
      } catch (e) {
        console.warn("Failed to save flowchart nodes", e);
      }
    } else {
      localStorage.removeItem('fixify-flowchart-nodes');
    }
  }, [nodes, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    if (edges.length > 0) {
      try {
        localStorage.setItem('fixify-flowchart-edges', JSON.stringify(edges));
      } catch (e) {
        console.warn("Failed to save flowchart edges", e);
      }
    } else {
      localStorage.removeItem('fixify-flowchart-edges');
    }
  }, [edges, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    if (activeScenario) {
      localStorage.setItem('fixify-flowchart-activeScenario', activeScenario);
    } else {
      localStorage.removeItem('fixify-flowchart-activeScenario');
    }
  }, [activeScenario, isLoaded]);

  /* Node Creation */
  const createNodeOfType = useCallback(
    (type, position) => {
      const id = `${Date.now()}`;
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const node = { id, type, position, data: { label, updateLabel: updateNodeLabel, meta: {} } };
      setNodes((nds) => nds.concat(node));
      setActiveScenario("");
      return node;
    },
    [updateNodeLabel, setActiveScenario]
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

  /* Connect / Edges */
  const onConnect = useCallback((params) => {
    const edge = {
      ...params,
      animated: true,
      style: { stroke: '#10b981' }
    };
    setEdges((eds) => addEdge(edge, eds));
    setActiveScenario("");
  }, [setActiveScenario]);

  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
    setSelectedNode(null);
    setActiveScenario("");
  }, [setActiveScenario]);

  const deleteSelectedEdge = useCallback(() => {
    setEdges((eds) => eds.filter((e) => !e.selected));
    setActiveScenario("");
  }, [setActiveScenario]);

  const updateEdgeLabel = useCallback((id, label) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label } : e)));
    setActiveScenario("");
  }, [setActiveScenario]);

  /* Selection Changes */
  const handleSelectionChange = useCallback((sel) => {
    const selNodes = sel?.nodes || [];
    const selEdges = sel?.edges || [];
    if (selNodes.length) {
      setSelectedNode(selNodes[0]);
      setTagSearchQuery(""); // Reset search query on node change
      setTagPage(0);         // Reset pagination on node change
      if (window.innerWidth < 1024) {
        setIsRightDrawerOpen(true);
      }
    } else {
      setSelectedNode(null);
      if (selEdges.length && window.innerWidth < 1024) {
        setIsRightDrawerOpen(true);
      }
    }
  }, [setIsRightDrawerOpen]);

  /* Auto Arrange using Dagre */
  const autoArrange = useCallback(
    (dir = "LR") => {
      if (!nodes.length) return;
      const positioned = getDagreLayout(nodes, edges, dir);
      setNodes(positioned);
      setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.15 }), 120);
    },
    [nodes, edges, rfInstance]
  );

  const saveCurrentAsTemplate = () => {
    const name = prompt("Enter a name for your custom template:");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    // Serialize nodes and edges (omit functions like updateLabel)
    const serializedNodes = nodes.map(({ data, ...rest }) => {
      const { updateLabel, ...restData } = data || {};
      return { ...rest, data: restData };
    });

    const updated = {
      ...userTemplates,
      [trimmed]: {
        nodes: serializedNodes,
        edges: edges
      }
    };

    setUserTemplates(updated);
    localStorage.setItem('fixify-flowchart-user-templates', JSON.stringify(updated));
    alert(`Template "${trimmed}" saved successfully!`);
  };

  const loadUserTemplate = (name) => {
    const template = userTemplates[name];
    if (!template) return;
    setActiveScenario(`user-${name}`);

    try {
      const stampedNodes = (template.nodes || []).map((n) => ({
        ...n,
        data: { ...(n.data || {}), updateLabel: updateNodeLabel }
      }));
      setNodes(stampedNodes);
      setEdges(template.edges || []);
      setSelectedNode(null);
    } catch (e) {
      console.error("Failed to load custom template", e);
    }
  };

  const onInit = useCallback((instance) => setRfInstance(instance), []);

  /* Load Scenario Template */
  const loadScenarioTemplate = (scenarioKey) => {
    if (!scenarioKey || !INDUSTRY_SCENARIOS[scenarioKey]) return;
    setActiveScenario(scenarioKey);
    const lines = INDUSTRY_SCENARIOS[scenarioKey];
    
    const newNodes = [];
    const newEdges = [];
    let prevNodeId = null;

    lines.forEach((line, idx) => {
      const val = validateFIXMessage(line);
      if (!val) return;

      const nodeId = `fix-seq-node-${idx}-${Date.now()}`;
      const label = `${val.msgSeqNum ? 'Seq ' + val.msgSeqNum + ': ' : ''}${val.msgTypeName}`;
      const position = { x: idx * 220, y: 150 };

      const node = {
        id: nodeId,
        type: idx === 0 ? "start" : idx === lines.length - 1 ? "end" : "process",
        position,
        data: {
          label,
          updateLabel: updateNodeLabel,
          meta: {
            msgType: val.msgType,
            msgTypeName: val.msgTypeName,
            clOrdID: val.clOrdID,
            sender: val.senderCompID,
            target: val.targetCompID,
            sendingTime: val.sendingTime || val.customTimestamp,
            errors: val.errors,
            tagList: val.tagList
          }
        }
      };

      newNodes.push(node);

      if (prevNodeId) {
        newEdges.push({
          id: `edge-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          label: val.clOrdID ? `ClOrdID: ${val.clOrdID}` : (val.msgType ? `Msg: ${val.msgType}` : ""),
          animated: true,
          style: { stroke: val.errors?.length > 0 ? '#ef4444' : '#10b981' },
          labelStyle: { fill: '#a1a1aa', fontSize: '9px', fontFamily: 'monospace' }
        });
      }

      prevNodeId = nodeId;
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNode(null);

    // Apply auto-arrange
    setTimeout(() => {
      const positioned = getDagreLayout(newNodes, newEdges, "LR");
      setNodes(positioned);
      setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.15 }), 80);
    }, 120);
  };

  /* Import / Export JSON */
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading-flow.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const exportImage = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    toPng(reactFlowWrapper.current, {
      backgroundColor: "#09090b",
      filter: (node) => {
        if (
          node?.classList?.contains("react-flow__controls") ||
          node?.classList?.contains("react-flow__panel")
        ) {
          return false;
        }
        return true;
      },
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `flowchart-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("Export PNG failed", err);
        alert("Failed to export diagram as PNG: " + err.message);
      });
  }, [reactFlowWrapper]);

  const exportToMermaid = useCallback(() => {
    let code = "graph LR\n";
    nodes.forEach(n => {
      const label = (n.data?.label || "Node").replace(/"/g, '\\"');
      if (n.type === "start" || n.type === "end") {
        code += `  ${n.id}(["${label}"])\n`;
      } else if (n.type === "decision") {
        code += `  ${n.id}{"${label}"}\n`;
      } else if (n.type === "milestone") {
        code += `  ${n.id}[("${label}")]\n`;
      } else {
        code += `  ${n.id}["${label}"]\n`;
      }
    });

    edges.forEach(e => {
      const label = e.label ? `|"${e.label.replace(/"/g, '\\"')}"|` : "";
      code += `  ${e.source} -->${label} ${e.target}\n`;
    });

    navigator.clipboard.writeText(code)
      .then(() => {
        alert("Mermaid.js flowchart code copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy Mermaid code", err);
        alert("Failed to copy: " + err.message);
      });
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
            alert("Format mismatch: JSON should contain { nodes: [], edges: [] }");
            return;
          }
          const stamped = parsed.nodes.map((n) => ({ ...n, data: { ...(n.data || {}), updateLabel } }));
          setNodes(stamped);
          setEdges(parsed.edges);
          setActiveScenario("");
          setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.15 }), 120);
        } catch {
          alert("Invalid flowchart config JSON.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [updateNodeLabel, rfInstance, setActiveScenario]
  );

  /* AUTO-SEQUENCE DIAGRAM GENERATOR FROM FIX LOGS */
  const handleFIXLogImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 18);
        
        const newNodes = [];
        const newEdges = [];
        let prevNodeId = null;

        lines.forEach((line, idx) => {
          const val = validateFIXMessage(line);
          if (!val) return;

          const nodeId = `fix-seq-node-${idx}-${Date.now()}`;
          const label = `${val.msgSeqNum ? 'Seq ' + val.msgSeqNum + ': ' : ''}${val.msgTypeName}`;
          
          const position = { x: idx * 220, y: 150 };

          const node = {
            id: nodeId,
            type: idx === 0 ? "start" : idx === lines.length - 1 ? "end" : "process",
            position,
            data: {
              label,
              updateLabel,
              meta: {
                msgType: val.msgType,
                msgTypeName: val.msgTypeName,
                clOrdID: val.clOrdID,
                sender: val.senderCompID,
                target: val.targetCompID,
                sendingTime: val.sendingTime || val.customTimestamp,
                errors: val.errors,
                tagList: val.tagList
              }
            }
          };

          newNodes.push(node);

          if (prevNodeId) {
            newEdges.push({
              id: `edge-${prevNodeId}-${nodeId}`,
              source: prevNodeId,
              target: nodeId,
              label: val.clOrdID ? `ClOrdID: ${val.clOrdID}` : (val.msgType ? `Type: ${val.msgType}` : ""),
              animated: true,
              style: { stroke: val.errors?.length > 0 ? '#ef4444' : '#10b981' },
              labelStyle: { fill: '#a1a1aa', fontSize: '9px', fontFamily: 'monospace' }
            });
          }

          prevNodeId = nodeId;
        });

        if (newNodes.length === 0) {
          alert("No standard FIX message layouts identified in file.");
          return;
        }

        setNodes(newNodes);
        setEdges(newEdges);
        setActiveScenario("");
        
        setTimeout(() => {
          const positioned = getDagreLayout(newNodes, newEdges, "LR");
          setNodes(positioned);
          setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.15 }), 80);
        }, 120);

      } catch (err) {
        alert("Failed to auto-arrange sequence flow: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetChart = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setActiveScenario("");
  }, [setActiveScenario]);

  /* Properties Panel drawer content */
  const renderMetaPane = () => {
    if (selectedNode) {
      const node = selectedNode;
      const meta = node.data.meta;
      const isFIXNode = !!meta?.msgType;

      // Filtered tags inside the properties view
      const allTagList = meta?.tagList || [];
      const filteredTags = allTagList.filter((t) => {
        const query = tagSearchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          t.tag.toString().includes(query) ||
          (t.name || "").toLowerCase().includes(query) ||
          (t.val || "").toLowerCase().includes(query) ||
          (t.meaning || "").toLowerCase().includes(query)
        );
      });
      const totalPages = Math.ceil(filteredTags.length / TAG_PAGE_SIZE);
      const safePage = Math.min(tagPage, Math.max(0, totalPages - 1));
      const pagedTags = filteredTags.slice(safePage * TAG_PAGE_SIZE, (safePage + 1) * TAG_PAGE_SIZE);

      // Header tag styling config helper
      const getTagBadgeColor = (tagNum) => {
        const primaryTags = ["8", "9", "35", "10", "49", "56", "34", "52"];
        if (primaryTags.includes(tagNum.toString())) {
          return "bg-[var(--primary-faint)] text-[var(--primary)] border-[var(--primary-border)]";
        }
        return "bg-zinc-900 text-zinc-400 border-zinc-800";
      };

      return (
        <div className="space-y-4 flex flex-col flex-1 overflow-y-auto pr-1.5 scrollbar-thin">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-mono block">Node Type</span>
            <span className="text-xs uppercase font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">
              {node.type || "default"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-mono block">Label / Title</span>
            <input
              value={node.data.label || ""}
              onChange={(e) => updateNodeLabel(node.id, e.target.value)}
              className="w-full px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 rounded-xl text-xs text-zinc-300 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Render parsed metadata if generated from FIX logs */}
          {isFIXNode && (
            <div className="flex flex-col space-y-3 shrink-0">
              <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2.5 font-mono text-xs text-zinc-400">
                <div className="font-semibold text-zinc-300 border-b border-zinc-900 pb-1 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-emerald-400" /> FIX Message Info
                </div>
                
                {meta.errors?.length > 0 && (
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px]">
                    <div className="font-bold flex items-center gap-1 mb-0.5"><AlertTriangle className="h-3 w-3" /> Corrupted Packet</div>
                    {meta.errors[0]}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] text-zinc-650 block">Message Type</span>
                    <span className="text-zinc-300 truncate block">{meta.msgTypeName} ({meta.msgType})</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-650 block">Seq Num (34)</span>
                    <span className="text-zinc-300 block">#{meta.tagList?.find(t=>t.tag==='34')?.val || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] text-zinc-650 block">Sender ➔ Target</span>
                    <span className="text-zinc-300 truncate block">{meta.sender || '—'} ➔ {meta.target || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Tag Search and Detailed Grid */}
              <div className="flex flex-col border border-zinc-850 bg-zinc-950/20 rounded-xl overflow-hidden shrink-0">
                {/* Search input */}
                <div className="p-2 border-b border-zinc-850 bg-zinc-900/30 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search tags (e.g. 55, Symbol, Buy)..."
                    value={tagSearchQuery}
                    onChange={(e) => { setTagSearchQuery(e.target.value); setTagPage(0); }}
                    className="w-full pl-7 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-300 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Frequently used quick-filter chips */}
                {!tagSearchQuery && (
                  <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1 border-b border-zinc-850">
                    {FREQUENT_TAGS.map((ft) => (
                      <button
                        key={ft.tag}
                        onClick={() => { setTagSearchQuery(ft.tag); setTagPage(0); }}
                        className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors"
                        style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}
                      >
                        {ft.tag} · {ft.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tag list with pagination */}
                <div className="p-1.5 space-y-1.5 min-h-[120px]">
                  {filteredTags.length === 0 ? (
                    <div className="text-center py-8 text-[10px] text-zinc-500 italic font-mono">
                      No matching tags found
                    </div>
                  ) : (
                    pagedTags.map((t, idx) => (
                      <div
                        key={`${t.tag}-${safePage * TAG_PAGE_SIZE + idx}`}
                        className="flex items-start justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-850/50 hover:border-zinc-750 transition-colors text-[10px] font-mono"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1 rounded border text-[8px] font-bold shrink-0 ${getTagBadgeColor(t.tag)}`}>
                              {t.tag}
                            </span>
                            <span className="text-zinc-300 truncate font-semibold">{t.name}</span>
                          </div>
                          <p className="text-[9px] text-zinc-500 truncate pl-1 mt-0.5">
                            Val: <span className="text-zinc-400 font-bold">{t.val}</span>
                          </p>
                        </div>
                        {t.meaning && t.meaning !== t.val && (
                          <span className="text-[9px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded font-medium truncate max-w-[90px] self-center">
                            {t.meaning}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-1.5 border-t border-zinc-850 bg-zinc-900/30 shrink-0">
                    <button
                      onClick={() => setTagPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="text-[9px] font-mono px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {safePage + 1} / {totalPages} · {filteredTags.length} tags
                    </span>
                    <button
                      onClick={() => setTagPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="text-[9px] font-mono px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                    >
                      Next ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      );
    }

    const selectedEdge = edges.find((e) => e.selected);
    if (selectedEdge) {
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-mono block">Connector Label</span>
            <input
              value={selectedEdge.label || ""}
              onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
              placeholder="Add flow description..."
              className="w-full px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 rounded-xl text-xs text-zinc-300 outline-none focus:border-emerald-500 font-sans"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 text-xs text-zinc-500 font-mono italic text-center border border-dashed border-zinc-800 rounded-lg">
        Select a diagram element on the grid to inspect properties.
      </div>
    );
  };

  const renderLeftPanelContent = () => (
    <>
      {/* Predefined Scenarios */}
      <div>
        <p className="fx-section-label mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3 text-[var(--primary)]" /> Templates</span>
          <button 
            onClick={saveCurrentAsTemplate}
            className="text-[9px] font-mono text-[var(--primary)] hover:underline"
            title="Save current canvas as custom template"
          >
            + Save New
          </button>
        </p>
        <select
          value={activeScenario || ""}
          onChange={(e) => {
            const val = e.target.value;
            setActiveScenario(val);
            if (val.startsWith("user-")) {
              const tName = val.substring(5);
              loadUserTemplate(tName);
            } else if (val) {
              loadScenarioTemplate(val);
            }
            if (!isDesktop) setIsLeftDrawerOpen(false);
          }}
          className="w-full px-2 py-1.5 border border-zinc-800 bg-zinc-950 rounded-lg text-[10px] font-mono text-zinc-300 outline-none focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="" disabled>Load scenario...</option>
          <optgroup label="Industry Templates" className="bg-zinc-950 text-zinc-300">
            <option value="logon">Logon & Session Establish</option>
            <option value="orderExecution">Single Order Execution (NOS)</option>
            <option value="cancelReplace">Modify & Cancel Flow (NOS/ER/Cxl)</option>
            <option value="allocations">Trade Allocation (Block ➔ Sub)</option>
            <option value="marketData">Market Data Subscription (MD)</option>
          </optgroup>
          {Object.keys(userTemplates).length > 0 && (
            <optgroup label="Custom Templates" className="bg-zinc-950 text-zinc-300">
              {Object.keys(userTemplates).map((name) => (
                <option key={name} value={`user-${name}`}>{name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Palette */}
      <div>
        <p className="fx-section-label mb-3">Palette</p>
        <div className="space-y-1.5">
          {[
            { key: "start", name: "Start (Pill)", icon: StartIcon },
            { key: "process", name: "Process (Box)", icon: ProcessIcon },
            { key: "decision", name: "Decision (Diamond)", icon: DecisionIcon },
            { key: "milestone", name: "Milestone (DB)", icon: MilestoneIcon },
            { key: "end", name: "End (Pill)", icon: EndIcon }
          ].map((s) => (
            <div
              key={s.key}
              draggable
              onDragStart={(e) => {
                onDragStart(e, s.key);
                if (!isDesktop) setIsLeftDrawerOpen(false);
              }}
              onClick={() => {
                if (!isDesktop) {
                  const pos = rfInstance 
                    ? rfInstance.project({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 200 })
                    : { x: 250, y: 150 };
                  createNodeOfType(s.key, pos);
                  setIsLeftDrawerOpen(false);
                  setTimeout(() => rfInstance && rfInstance.fitView({ padding: 0.15 }), 120);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--foreground)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <s.icon />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Quick FIX Auto generation */}
      <div>
        <p className="fx-section-label mb-3">FIX Sequence</p>
        <input
          type="file"
          id="fixLogSeqInput"
          accept=".txt,.fix,.log"
          onChange={(e) => {
            handleFIXLogImport(e);
            if (!isDesktop) setIsLeftDrawerOpen(false);
          }}
          className="hidden"
        />
        <button
          onClick={() => document.getElementById("fixLogSeqInput")?.click()}
          className="w-full fx-btn-primary justify-center"
          style={{ width: '100%' }}
        >
          <Upload className="h-3.5 w-3.5" /> <span className="inline">Log to Sequence</span>
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Save & Load commands */}
      <div className="space-y-2 mt-auto">
        <div className="space-y-1 relative">
          <p className="text-[10px] text-zinc-500 font-mono block mb-1">Export Diagram</p>
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-full fx-btn-secondary justify-between text-[11px] py-1.5 px-3 flex items-center gap-1.5"
              title="Export options"
            >
              <span className="flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> <span>Export Diagram</span>
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isExportDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isExportDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsExportDropdownOpen(false)} />
                <div
                  className="absolute bottom-full mb-1.5 left-0 right-0 rounded-xl border p-1 z-40 shadow-xl space-y-0.5"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <button
                    onClick={() => {
                      exportJSON();
                      setIsExportDropdownOpen(false);
                      if (!isDesktop) setIsLeftDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-mono hover:bg-[var(--primary-faint)] hover:text-[var(--primary)] text-zinc-300 transition-colors flex items-center gap-2"
                  >
                    <Share2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Export as JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      exportImage();
                      setIsExportDropdownOpen(false);
                      if (!isDesktop) setIsLeftDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-mono hover:bg-[var(--primary-faint)] hover:text-[var(--primary)] text-zinc-300 transition-colors flex items-center gap-2"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>Export as PNG</span>
                  </button>
                  <button
                    onClick={() => {
                      exportToMermaid();
                      setIsExportDropdownOpen(false);
                      if (!isDesktop) setIsLeftDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-mono hover:bg-[var(--primary-faint)] hover:text-[var(--primary)] text-zinc-300 transition-colors flex items-center gap-2"
                  >
                    <Network className="h-3.5 w-3.5 shrink-0" />
                    <span>Copy Mermaid.js</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <input
          type="file"
          id="jsonFlowInput"
          accept="application/json"
          onChange={(e) => {
            importJSON(e);
            if (!isDesktop) setIsLeftDrawerOpen(false);
          }}
          className="hidden"
        />
        <button
          onClick={() => document.getElementById("jsonFlowInput")?.click()}
          className="w-full fx-btn-secondary justify-center"
          style={{ width: '100%' }}
        >
          <Upload className="h-3.5 w-3.5" /> <span className="inline">Import</span>
        </button>
        <button
          onClick={() => {
            resetChart();
            if (!isDesktop) setIsLeftDrawerOpen(false);
          }}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#f87171' }}
        >
          <Trash2 className="h-3.5 w-3.5" /> <span className="inline">Clear</span>
        </button>
      </div>
    </>
  );

  const renderRightPanelContent = () => {
    const selectedEdge = edges.find((e) => e.selected);
    return (
      <>
        <p className="fx-section-label mb-3">Properties</p>
        {renderMetaPane()}

        <div className="mt-auto pt-4 space-y-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {selectedNode && (
            <button
              onClick={deleteSelected}
              className="w-full py-2 bg-red-600 hover:bg-red-500 font-bold rounded-xl text-white text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <Trash2 className="h-4 w-4" /> <span className="inline">Delete Component</span>
            </button>
          )}
          {selectedEdge && (
            <button
              onClick={deleteSelectedEdge}
              className="w-full py-2 bg-red-600 hover:bg-red-550 font-bold rounded-xl text-white text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <Trash2 className="h-4 w-4" /> <span className="inline">Delete Connection</span>
            </button>
          )}

          <div>
            <p className="fx-section-label mb-2">Auto-layout</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  autoArrange("LR");
                  if (!isDesktop) setIsRightDrawerOpen(false);
                }}
                className="flex-1 fx-btn-secondary justify-center text-[11px]"
              >
                <Layout className="h-3 w-3 rotate-90" /> <span className="inline">L→R</span>
              </button>
              <button
                onClick={() => {
                  autoArrange("TB");
                  if (!isDesktop) setIsRightDrawerOpen(false);
                }}
                className="flex-1 fx-btn-secondary justify-center text-[11px]"
              >
                <Layout className="h-3 w-3" /> <span className="inline">T→B</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fx-page-header">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Flowchart Sequence Maker
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Create transaction diagrams manually, load pre-defined templates, or auto-generate visual chronological layouts directly from FIX logs.
          </p>
        </div>
      </div>

      {/* Mobile Toolbar */}
      {!isDesktop && (
        <div className="flex justify-between items-center gap-3 p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setIsLeftDrawerOpen(true)}
            className="fx-btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
          >
            <Wrench className="h-4 w-4 text-[var(--primary)]" />
            <span>Tools</span>
          </button>
          
          <button
            onClick={() => setIsRightDrawerOpen(true)}
            className={`fx-btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 relative ${
              selectedNode || edges.some(e => e.selected)
                ? 'border-[var(--primary-border)] bg-[var(--primary-faint)] text-[var(--primary)]'
                : ''
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Properties</span>
            {(selectedNode || edges.some(e => e.selected)) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Control Panel (Width 2/12) */}
        {isDesktop ? (
          <aside
            className="lg:col-span-2 flex flex-col p-4 rounded-xl space-y-4 select-none lg:max-h-[75vh] lg:overflow-y-auto scrollbar-thin"
            style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
          >
            {renderLeftPanelContent()}
          </aside>
        ) : (
          <>
            {isLeftDrawerOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsLeftDrawerOpen(false)}
                />
                {/* Slide-over */}
                <aside
                  className="fixed inset-y-0 left-0 z-50 w-[290px] max-w-[80vw] bg-zinc-950 border-r border-zinc-850 p-4 flex flex-col space-y-4 overflow-y-auto"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-900 shrink-0">
                    <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Tools & Palette</span>
                    <button 
                      onClick={() => setIsLeftDrawerOpen(false)}
                      className="p-1 hover:text-[var(--primary)] text-zinc-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {renderLeftPanelContent()}
                </aside>
              </>
            )}
          </>
        )}
 
        {/* Center Drawing Canvas (Width 7/12) */}
        <section
          className="col-span-1 lg:col-span-7 h-[75vh] rounded-xl overflow-hidden relative shadow-inner"
          style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
          ref={reactFlowWrapper}
        >
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
            <Background gap={18} color="var(--border)" />
            <Controls />
          </ReactFlow>
        </section>

        {/* Right Properties Drawer (Width 3/12) */}
        {isDesktop ? (
          <aside
            className="lg:col-span-3 p-4 rounded-xl flex flex-col justify-start max-h-[75vh] overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
          >
            {renderRightPanelContent()}
          </aside>
        ) : (
          <>
            {isRightDrawerOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsRightDrawerOpen(false)}
                />
                {/* Slide-over */}
                <aside
                  className="fixed inset-y-0 right-0 z-50 w-[310px] max-w-[85vw] bg-zinc-950 border-l border-zinc-850 p-4 flex flex-col justify-start h-full overflow-hidden"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-900 mb-3 shrink-0">
                    <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Properties & Layout</span>
                    <button 
                      onClick={() => setIsRightDrawerOpen(false)}
                      className="p-1 hover:text-[var(--primary)] text-zinc-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {renderRightPanelContent()}
                </aside>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FlowchartPageWrapper() {
  return (
    <ReactFlowProvider>
      <FlowchartPage />
    </ReactFlowProvider>
  );
}
