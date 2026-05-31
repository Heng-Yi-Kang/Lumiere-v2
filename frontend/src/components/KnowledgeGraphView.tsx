import React, { useState } from 'react';
import { ConceptNode, ConceptLink, Course } from '../types';
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
  courses: Course[];
  onAskInChat: (question: string) => void;
  onOpenNotebookByCode: (code: string) => void;
}

export default function KnowledgeGraphView({ nodes, links, courses, onAskInChat, onOpenNotebookByCode }: KnowledgeGraphViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  // Geometrical positions for the SVG Node-Link rendering
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
          <span className="flex items-center gap-1 rounded-lg bg-success-subtle px-2.5 py-1 text-[10px] font-extrabold text-success">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Fully Mastered
          </span>
        );
      case 'weak':
        return (
          <span className="flex items-center gap-1 rounded-lg bg-cta-subtle px-2.5 py-1 text-[10px] font-extrabold text-cta">
            <AlertTriangle className="h-3.5 w-3.5 text-cta" />
            Needs Review (Weak)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-lg bg-accent-subtle px-2.5 py-1 text-[10px] font-extrabold text-accent-hover">
            <HelpCircle className="h-3.5 w-3.5 text-accent-hover" />
            Unexplored
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-left relative z-10">
      {/* Visual map introduction banner */}
      <div className="border-b border-border-default pb-4">
        <h1 className="text-xl font-extrabold text-text-primary flex items-center gap-2 font-display">
          <Network className="h-5 w-5 text-accent-hover" />
          Semantic Knowledge Graph & Prerequisites
        </h1>
        <p className="text-xs text-text-secondary mt-1 font-serif">
          Lumiere maps overlapping concepts across your active course set so prerequisite gaps stay visible while you study.
        </p>
      </div>

      {/* Filter and control systems row */}
      <div className="flex flex-wrap items-center justify-between gap-4 surface-soft p-4 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Module Filter selector */}
          <div>
            <label htmlFor="course-filter" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 font-mono">
              Filter by Academic Module:
            </label>
            <select
              id="course-filter"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="rounded-lg border border-border-default bg-bg-elevated/70 py-1.5 pl-2.5 pr-6 text-xs font-semibold text-text-primary focus:border-accent outline-none cursor-pointer transition-colors"
            >
              <option value="all" className="bg-bg-overlay text-text-primary">All Courses</option>
              {courses.map(c => (
                <option key={c.code} value={c.code} className="bg-bg-overlay text-text-primary">({c.code}) {c.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label htmlFor="status-filter" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 font-mono">
              Filter by Mastery Level:
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border-default bg-bg-elevated/70 py-1.5 pl-2.5 pr-6 text-xs font-semibold text-text-primary focus:border-accent outline-none cursor-pointer transition-colors"
            >
              <option value="all" className="bg-bg-overlay text-text-primary">All Statuses</option>
              <option value="mastered" className="bg-bg-overlay text-text-primary">Mastered</option>
              <option value="weak" className="bg-bg-overlay text-text-primary">Weaker Nodes</option>
              <option value="unexplored" className="bg-bg-overlay text-text-primary">Unexplored</option>
            </select>
          </div>
        </div>

        {/* Graph Legends */}
        <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted font-mono">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-success"></span> Mastered
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-cta"></span> Weaker Spot
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-hover"></span> Unexplored
          </span>
        </div>
      </div>

      {/* Main split: SVG constellation canvas + Concept metadata panel */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* SVG Constellation interactive web canvas wrapper */}
        <div className="lg:col-span-2 rounded-3xl border border-border-default bg-bg-elevated/40 p-4 relative h-[380px] overflow-hidden flex flex-col justify-between shadow-xl backdrop-blur-xl">
          {/* Watermark indicators */}
          <div className="absolute top-4 left-4 text-[9.5px] font-bold text-text-secondary tracking-wider flex items-center gap-1.5 p-1.5 rounded-lg bg-bg-elevated/60 border border-border-default uppercase font-mono shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
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

              const isPrereq = link.type === 'prerequisite';
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
              
              const statusColorMap = {
                mastered: 'fill-success stroke-success/50',
                weak: 'fill-cta stroke-cta/50',
                unexplored: 'fill-accent-hover stroke-accent/50'
              };
              const nodeColors = statusColorMap[node.status] || 'fill-text-muted stroke-text-muted/50';
              const isVisible = filteredNodes.some(n => n.id === node.id);

              return (
                <g 
                  key={node.id} 
                  className={`cursor-pointer transition-all ${isVisible ? 'opacity-100 scale-100' : 'opacity-10 scale-90'}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  {/* Outer glow indicator if selected */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={24}
                      className="fill-none stroke-accent stroke-1 opacity-40"
                      style={{ strokeDasharray: '4,4' }}
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
                    className="fill-text-primary text-[10.5px] font-extrabold select-none pointer-events-none drop-shadow-md font-display"
                  >
                    {node.label}
                  </text>

                  {/* Small Course code annotation underneath node */}
                  <text
                    x={pos.x}
                    y={pos.y + 24}
                    textAnchor="middle"
                    className="fill-text-muted text-[8px] font-black select-none pointer-events-none font-mono"
                  >
                    {node.courseCode}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Bottom helper tip */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] text-text-muted font-mono">
            <span className="inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              Click nodes to inspect syllabus linkage
            </span>
            <span>Solid Line: Prerequisite | Dashed Line: Course Cross-Link</span>
          </div>
        </div>

        {/* Side panel displaying specific Concept Metadata */}
        {selectedNode ? (
          <div className="surface-card rounded-3xl p-6 flex flex-col justify-between text-text-primary">
            <div className="space-y-4">
              <div className="border-b border-border-subtle pb-3">
                <span className="rounded-md bg-bg-elevated/60 border border-border-default px-2 py-0.5 text-[9px] font-black text-text-muted uppercase font-mono">
                  {selectedNode.courseCode}
                </span>
                <h2 className="text-base font-extrabold text-text-primary mt-2 leading-tight font-display">
                  {selectedNode.label}
                </h2>
                <div className="mt-2.5">{getStatusBadge(selectedNode.status)}</div>
              </div>

              {/* Node description */}
              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <h4 className="font-extrabold text-text-muted uppercase text-[9px] tracking-wider font-mono">Concept Summary:</h4>
                  <p className="text-text-secondary mt-1.5 font-medium leading-relaxed font-serif">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Tags list */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tags.map((tg, i) => (
                    <span key={i} className="rounded-md bg-bg-elevated/60 px-2 py-0.5 text-[10px] font-bold text-text-muted border border-border-subtle font-mono">
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* Suggested remedial references link */}
                <div className="rounded-2xl bg-accent-subtle border border-accent-border p-4 text-left">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-accent-hover uppercase font-mono">
                    <BookOpen className="h-4 w-4 text-accent-hover" />
                    Recommended Revision Order
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[11px] font-medium text-text-secondary">
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
                          className="flex items-center gap-1.5 hover:text-accent-hover hover:underline cursor-pointer transition-colors"
                        >
                          <PlayCircle className="h-4 w-4 text-accent-hover shrink-0" />
                          <span className="truncate">{res.name} ({res.type.toUpperCase()})</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[10px] text-text-muted font-mono">Review slide details inside class notebook.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick action buttons row in card footer */}
            <div className="border-t border-border-subtle pt-4 mt-4 space-y-2">
              <button
                onClick={() => onAskInChat(`Ask AI: please explain the concept of "${selectedNode.label}" inside the course "${selectedNode.courseCode}" simply. Explain its prerequisites and how it connects to other courses.`)}
                className="w-full rounded-xl bg-accent py-2.5 text-xs font-bold text-white hover:bg-accent-hover transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20 border border-accent-border"
              >
                <Sparkles className="h-4 w-4 text-white" />
                <span>Explain Concept inside AI Chat</span>
              </button>
              
              <button
                onClick={() => onOpenNotebookByCode(selectedNode.courseCode)}
                className="w-full rounded-xl border border-border-default bg-bg-elevated/60 py-2.5 text-xs font-bold text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors flex items-center justify-center gap-1 font-mono"
              >
                <span>Open ({selectedNode.courseCode}) Notebook</span>
                <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
              </button>
            </div>
          </div>
        ) : (
          <div className="surface-card rounded-3xl p-6 text-xs text-text-muted text-center">
            Click on any concept node to explore prerequisites and syllabus references.
          </div>
        )}
      </div>
    </div>
  );
}
