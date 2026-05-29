import React, { useState } from 'react';
import { ConceptNode, ConceptLink, University } from '../types';
import { 
  Network, 
  Sparkles, 
  HelpCircle, 
  GraduationCap, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  PlayCircle,
  ExternalLink,
  Info
} from 'lucide-react';

interface KnowledgeGraphViewProps {
  nodes: ConceptNode[];
  links: ConceptLink[];
  university: University;
  onAskInChat: (question: string) => void;
  onOpenNotebookByCode: (code: string) => void;
}

export default function KnowledgeGraphView({ nodes, links, university, onAskInChat, onOpenNotebookByCode }: KnowledgeGraphViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  // Geometrical positions for the SVG Node-Link rendering
  // We distribute them beautifully in a circular/bento constellation layout
  const nodePositions: Record<string, { x: number; y: number }> = {
    // UM positions
    'node-prop-calc': { x: 150, y: 110 },
    'node-set-theory': { x: 380, y: 90 },
    'node-java-types': { x: 120, y: 280 },
    'node-logical-ops': { x: 280, y: 220 },
    'node-sql-join': { x: 500, y: 180 },
    'node-db-norm': { x: 360, y: 320 },
    'node-perlembagaan': { x: 550, y: 310 },
    // APU positions
    'node-grad-desc': { x: 180, y: 120 },
    'node-neural-net': { x: 380, y: 200 },
    'node-big-o': { x: 150, y: 280 },
    'node-binary-trees': { x: 420, y: 310 },
    'node-cloud-models': { x: 550, y: 110 },
    // Taylors positions
    'node-contracts-act': { x: 200, y: 150 },
    'node-law-coercion': { x: 450, y: 200 },
    'node-fin-nv': { x: 300, y: 320 },
    // UiTM positions
    'node-cpp-pointers': { x: 300, y: 200 }
  };

  // Safe fallback position generator
  const getNodePos = (id: string, index: number) => {
    if (nodePositions[id]) return nodePositions[id];
    // Spread circularly if position vector missing
    const angle = (index / nodes.length) * 2 * Math.PI;
    return {
      x: 300 + Math.cos(angle) * 160,
      y: 200 + Math.sin(angle) * 120
    };
  };

  // Filter conditions
  const filteredNodes = nodes.filter(node => {
    const courseMatch = filterCourse === 'all' || node.courseCode === filterCourse;
    const statusMatch = filterStatus === 'all' || node.status === filterStatus;
    return courseMatch && statusMatch;
  });

  const getStatusBadge = (status: 'mastered' | 'weak' | 'unexplored') => {
    switch (status) {
      case 'mastered':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 animate-pulse">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Fully Mastered
          </span>
        );
      case 'weak':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Needs Review (Weak)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
            <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
            Unexplored
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-left relative z-10">
      {/* Visual map introduction banner */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2 font-display">
          <Network className="h-5.5 w-5.5 text-indigo-400" />
          Semantik Knowledge Graph & Prerequisites
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Lumiere automatically maps and links overlapping logic concepts across different courses in your {university.shortName} syllabus.
        </p>
      </div>

      {/* Filter and control systems row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Module Filter selector */}
          <div>
            <label htmlFor="course-filter" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Filter by Academic Module:
            </label>
            <select
              id="course-filter"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/50 py-1 pl-2 pr-6 text-xs font-semibold text-slate-200 focus:border-indigo-400 outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0f172a] text-slate-200">All Courses</option>
              {university.courses.map(c => (
                <option key={c.code} value={c.code} className="bg-[#0f172a] text-slate-200">({c.code}) {c.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label htmlFor="status-filter" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono font-mono">
              Filter by Mastery Level:
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/50 py-1 pl-2 pr-6 text-xs font-semibold text-slate-200 focus:border-indigo-400 outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0f172a] text-slate-200">All Statuses</option>
              <option value="mastered" className="bg-[#0f172a] text-slate-200">Mastered</option>
              <option value="weak" className="bg-[#0f172a] text-slate-200">Weaker Nodes</option>
              <option value="unexplored" className="bg-[#0f172a] text-slate-200">Unexplored</option>
            </select>
          </div>
        </div>

        {/* Graph Legends */}
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span> Mastered
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span> Weaker Spot
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse"></span> Unexplored
          </span>
        </div>
      </div>

      {/* Main split: SVG constellation canvas + Concept metadata panel */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* SVG Constellation interactive web canvas wrapper */}
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-950/60 p-4 relative h-[380px] overflow-hidden flex flex-col justify-between shadow-2xl backdrop-blur-xl">
          {/* Watermark indicators */}
          <div className="absolute top-4 left-4 text-[9.5px] font-bold text-slate-300 tracking-wider flex items-center gap-1 p-1.5 rounded-lg bg-white/5 border border-white/10 uppercase font-mono shadow-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse text-glow-indigo" />
            Interactive Concept Nebula
          </div>

          {/* Core SVG Canvas */}
          <svg className="w-full h-full min-h-[300px]">
            {/* Draw Relation Connections vectors */}
            {links.map((link, i) => {
              const srcNode = nodes.find(n => n.id === link.source);
              const tgtNode = nodes.find(n => n.id === link.target);
              
              const srcIdx = nodes.findIndex(n => n.id === link.source);
              const tgtIdx = nodes.findIndex(n => n.id === link.target);

              if (!srcNode || !tgtNode) return null;

              const startPos = getNodePos(link.source, srcIdx);
              const endPos = getNodePos(link.target, tgtIdx);

              // Differentiate line colors
              const isPrereq = link.type === 'prerequisite';
              // Check filter states
              const isVisible = filteredNodes.some(n => n.id === link.source) && filteredNodes.some(n => n.id === link.target);

              return (
                <line
                  key={i}
                  x1={startPos.x}
                  y1={startPos.y}
                  x2={endPos.x}
                  y2={endPos.y}
                  className={`stroke-2 transition-all ${
                    isPrereq ? 'stroke-indigo-500/40' : 'stroke-emerald-400/40'
                  } ${isVisible ? 'opacity-100' : 'opacity-5'}`}
                  style={{ strokeDasharray: isPrereq ? '0' : '4,4' }}
                />
              );
            })}

            {/* Draw Interactive node dots and circles */}
            {nodes.map((node, index) => {
              const pos = getNodePos(node.id, index);
              const isSelected = selectedNodeId === node.id;
              
              // Colors for statuses
              const statusColorMap = {
                mastered: 'fill-emerald-400 stroke-emerald-500/50',
                weak: 'fill-amber-400 stroke-amber-500/50',
                unexplored: 'fill-blue-400 stroke-blue-500/50'
              };
              const nodeColors = statusColorMap[node.status] || 'fill-gray-450 stroke-gray-500/50';
              const isVisible = filteredNodes.some(n => n.id === node.id);

              return (
                <g 
                  key={node.id} 
                  className={`cursor-pointer transition-all ${isVisible ? 'opacity-100 scale-100' : 'opacity-10 scale-90'}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  {/* Outer pulsing glow indicator if selected */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={24}
                      className="fill-none stroke-indigo-400 stroke-1 stroke-dashed animate-ping opacity-60"
                    />
                  )}

                  {/* Core Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={11}
                    className={`${nodeColors} stroke-2`}
                  />

                  {/* Node label text */}
                  <text
                    x={pos.x}
                    y={pos.y - 18}
                    textAnchor="middle"
                    className="fill-white text-[10.5px] font-extrabold select-none pointer-events-none drop-shadow-md font-display"
                  >
                    {node.label}
                  </text>

                  {/* Small Course code annotation underneath node */}
                  <text
                    x={pos.x}
                    y={pos.y + 24}
                    textAnchor="middle"
                    className="fill-slate-500 text-[8px] font-black select-none pointer-events-none font-mono"
                  >
                    {node.courseCode}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Bottom helper tip */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] text-slate-500 font-mono">
            <span>💡 Click nodes to inspect syllabus linkage</span>
            <span>Solid Line: Prerequisite | Dashed Line: Course Cross-Link</span>
          </div>
        </div>

        {/* Side panel displaying specific Concept Metadata */}
        {selectedNode ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between text-slate-100">
            <div className="space-y-4">
              <div className="border-b border-white/5 pb-3">
                <span className="rounded-md bg-white/5 border border-white/5 px-2 py-0.5 text-[9px] font-black text-slate-400 uppercase font-mono">
                  {selectedNode.courseCode}
                </span>
                <h2 className="text-md font-extrabold text-white mt-2 leading-tight font-display">
                  {selectedNode.label}
                </h2>
                <div className="mt-2.5">{getStatusBadge(selectedNode.status)}</div>
              </div>

              {/* Node description */}
              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <h4 className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider font-mono">Concept Summary:</h4>
                  <p className="text-slate-300 mt-1 font-semibold leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Tags list */}
                <div className="flex flex-wrap gap-1">
                  {selectedNode.tags.map((tg, i) => (
                    <span key={i} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-white/5 font-mono">
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* Suggested remedial references link */}
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-left">
                  <div className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-300 uppercase font-mono">
                    <BookOpen className="h-4 w-4 text-indigo-400" />
                    Recommended Revision Order
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[11px] font-medium text-indigo-200">
                    {selectedNode.resources.length > 0 ? (
                      selectedNode.resources.map((res, i) => (
                        <li 
                          key={i} 
                          onClick={() => {
                            if (res.source === 'Class Recording' || res.source === 'Internal Playback') {
                              onOpenNotebookByCode(selectedNode.courseCode);
                            } else {
                              onAskInChat(`Explain the resource named "${res.name}" which links to concept "${selectedNode.label}"`);
                            }
                          }}
                          className="flex items-center gap-1 hover:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <PlayCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="truncate">{res.name} ({res.type.toUpperCase()})</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[10px] text-slate-500 font-mono">Review slide details inside class notebook.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick action buttons row in card footer */}
            <div className="border-t border-white/5 pt-4 mt-4 space-y-2">
              <button
                onClick={() => onAskInChat(`Ask AI: please explain the concept of "${selectedNode.label}" inside the course "${selectedNode.courseCode}" simply. Explain its prerequisites and how it connects to other courses.`)}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 border border-indigo-400/20"
              >
                <Sparkles className="h-4 w-4 text-indigo-200 text-glow-indigo" />
                <span>Explain Concept inside AI Chat</span>
              </button>
              
              <button
                onClick={() => onOpenNotebookByCode(selectedNode.courseCode)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors flex items-center justify-center gap-1 cursor-pointer font-mono"
              >
                <span>Open ({selectedNode.courseCode}) Notebook</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl text-xs text-slate-500 text-center">
            Click on any concept node to explore prerequisites and syllabus references.
          </div>
        )}
      </div>
    </div>
  );
}
