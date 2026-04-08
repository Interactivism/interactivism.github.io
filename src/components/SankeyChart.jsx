import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { X, Table2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AttributionHeatmapTable from './AttributionHeatmapTable';
import LastTouchSourcesModal from './LastTouchSourcesModal';

// ── Layout helpers ────────────────────────────────────────────────────────────

function computeLayout({ nodes, links }, width, height, nodeWidth, nodePadding) {
  const ns = nodes.map((n, i) => ({ ...n, i, inLinks: [], outLinks: [], value: 0 }));
  const ls = links.map((l, i) => ({ ...l, i, sy0: 0, sy1: 0, ty0: 0, ty1: 0 }));

  ls.forEach(l => {
    ns[l.source].outLinks.push(l);
    ns[l.target].inLinks.push(l);
  });

  // depth 0 = source, 1 = middle, 2 = sink
  ns.forEach(n => {
    n.depth = n.inLinks.length === 0 ? 0 : n.outLinks.length === 0 ? 2 : 1;
  });

  // node value = max of total incoming / outgoing flow
  ns.forEach(n => {
    n.value = Math.max(
      n.outLinks.reduce((s, l) => s + l.value, 0),
      n.inLinks.reduce((s, l) => s + l.value, 0),
    ) || 1;
  });

  const cols = [[], [], []];
  ns.forEach(n => cols[n.depth].push(n));

  // scale so the tallest column fits within height
  let scale = Infinity;
  cols.forEach(col => {
    if (!col.length) return;
    const totalValue = col.reduce((s, n) => s + n.value, 0);
    const available = height - (col.length - 1) * nodePadding;
    if (available > 0) scale = Math.min(scale, available / totalValue);
  });
  if (!isFinite(scale) || scale <= 0) scale = 1;

  // x positions for the three columns
  const colX = [0, (width - nodeWidth) / 2, width - nodeWidth];

  // top-align: stack nodes from y = 0
  cols.forEach((col, depth) => {
    let y = 0;
    col.forEach(n => {
      n.x0 = colX[depth];
      n.x1 = colX[depth] + nodeWidth;
      n.height = n.value * scale;
      n.y0 = y;
      n.y1 = y + n.height;
      y += n.height + nodePadding;
    });
  });

  // link y-offsets at source nodes
  ns.forEach(n => {
    let y = n.y0;
    n.outLinks.forEach(l => { l.sy0 = y; y = l.sy1 = y + l.value * scale; });
  });

  // link y-offsets at target nodes
  ns.forEach(n => {
    let y = n.y0;
    n.inLinks.forEach(l => { l.ty0 = y; y = l.ty1 = y + l.value * scale; });
  });

  return { nodes: ns, links: ls };
}

function linkPath(l, ns) {
  const sx = ns[l.source].x1;
  const tx = ns[l.target].x0;
  const mx = (sx + tx) / 2;
  return [
    `M${sx},${l.sy0}`,
    `C${mx},${l.sy0} ${mx},${l.ty0} ${tx},${l.ty0}`,
    `L${tx},${l.ty1}`,
    `C${mx},${l.ty1} ${mx},${l.sy1} ${sx},${l.sy1}`,
    'Z',
  ].join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SankeyChart({ metrics, visits, title }) {
  const [showTable, setShowTable] = useState(false);
  const [showLastTouch, setShowLastTouch] = useState(false);
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setChartWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Data processing (unchanged) ───────────────────────────────────────────

  const visitsBySource = visits.reduce((acc, v) => {
    if (v.referral_source === 'direct') return acc;
    const source =
      v.referral_source === 'direct_tv'    ? 'TVScientific Direct' :
      v.referral_source === 'social'        ? 'Meta' :
      v.referral_source === 'paid_search'   ? 'Search' :
      v.referral_source === 'referral'      ? 'Email' :
      v.referral_source === 'organic'       ? 'Snap' :
                                              'Pinterest';
    if (!acc[source]) acc[source] = { visits: 0, conversions: 0 };
    acc[source].visits      += v.visit_count || 0;
    acc[source].conversions += v.outcomes    || 0;
    return acc;
  }, {});

  ['TVScientific Direct', 'Meta', 'Search', 'Email', 'Snap', 'Pinterest'].forEach(src => {
    if (!visitsBySource[src]) visitsBySource[src] = { visits: 120, conversions: 18 };
  });

  const colors = {
    'TVScientific Direct': '#6366f1',
    'Meta':      '#ec4899',
    'Search':    '#eab308',
    'Email':     '#8b5cf6',
    'Snap':      '#f97316',
    'Pinterest': '#10b981',
  };

  const sources = Object.keys(visitsBySource);

  const nodes = [
    { name: 'TV Impressions', nodeColor: '#6366f1' },
    ...sources.map(s => ({ name: `${s} Visits`, nodeColor: colors[s] || '#94a3b8' })),
    { name: 'Total Conversions', nodeColor: '#10b981' },
    { name: 'No Conversion',     nodeColor: '#94a3b8' },
  ];

  const getTimeData = src => ({
    impToVisit:  ({ 'TVScientific Direct': 12, Meta: 45, Search: 30, Email: 60, Snap: 38, Pinterest: 25 }[src]  || 30),
    visitToConv: ({ 'TVScientific Direct': 180, Meta: 240, Search: 120, Email: 360, Snap: 200, Pinterest: 150 }[src] || 180),
  });

  const links = [];
  const totalConvIdx = sources.length + 1;
  const noConvIdx    = sources.length + 2;

  sources.forEach((src, idx) => {
    const t = getTimeData(src);
    const { visits: v, conversions: c } = visitsBySource[src];
    links.push({ source: 0,       target: idx + 1,    value: v,     color: colors[src] || '#94a3b8', avgTime: t.impToVisit  });
    if (c > 0)     links.push({ source: idx + 1, target: totalConvIdx, value: c,     color: colors[src] || '#94a3b8', avgTime: t.visitToConv });
    if (v - c > 0) links.push({ source: idx + 1, target: noConvIdx,    value: v - c, color: colors[src] || '#94a3b8', avgTime: null });
  });

  // ── Layout ────────────────────────────────────────────────────────────────

  const margin      = { top: 20, right: 160, bottom: 20, left: 160 };
  const chartHeight = 500;
  const nodeWidth   = 12;
  const nodePadding = 20;
  const innerW = Math.max(1, chartWidth - margin.left - margin.right);
  const innerH = chartHeight - margin.top - margin.bottom;

  const layout = computeLayout({ nodes, links }, innerW, innerH, nodeWidth, nodePadding);

  const formatTime = m => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showLastTouch && <LastTouchSourcesModal onClose={() => setShowLastTouch(false)} />}
      {showTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Attribution by Referral Source &amp; Time Window</h2>
              <button onClick={() => setShowTable(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-6"><AttributionHeatmapTable /></div>
          </div>
        </div>
      )}

      <Card className="p-6 border-0 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowLastTouch(true)} className="gap-2">
              <Layers className="w-4 h-4" /> Last Touch Sources
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTable(true)} className="gap-2">
              <Table2 className="w-4 h-4" /> View Data Table
            </Button>
          </div>
        </div>

        <div ref={containerRef}>
          <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
            <g transform={`translate(${margin.left},${margin.top})`}>

              {/* Links */}
              {layout.links.map((l, i) => {
                const sn = layout.nodes[l.source];
                const tn = layout.nodes[l.target];
                const midX = (sn.x1 + tn.x0) / 2;
                const midY = (l.sy0 + l.sy1 + l.ty0 + l.ty1) / 4;
                return (
                  <g key={i}>
                    <path d={linkPath(l, layout.nodes)} fill={l.color || '#94a3b8'} fillOpacity={0.3} stroke="none" />
                    {l.avgTime && (
                      <text x={midX} y={midY} textAnchor="middle" fill="#374151" fontSize="11" fontWeight="600" style={{ pointerEvents: 'none' }}>
                        ⏱ {formatTime(l.avgTime)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {layout.nodes.map((n, i) => {
                const labelX      = n.depth === 2 ? n.x1 + 8 : n.x0 - 8;
                const labelAnchor = n.depth === 2 ? 'start'   : 'end';
                return (
                  <g key={i}>
                    <rect
                      x={n.x0} y={n.y0}
                      width={nodeWidth} height={n.height}
                      fill={n.nodeColor || '#6366f1'}
                      fillOpacity={0.8}
                      stroke="#fff" strokeWidth={2}
                    />
                    <text
                      x={labelX} y={n.y0 + n.height / 2}
                      textAnchor={labelAnchor}
                      dominantBaseline="middle"
                      fill="#1e293b" fontSize="12" fontWeight="700"
                    >
                      {n.name}
                    </text>
                  </g>
                );
              })}

            </g>
          </svg>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(colors).map(([src, clr]) => (
            <div key={src} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: clr }} />
              <span className="text-xs text-gray-600">{src}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Flow thickness represents volume of impressions, visits, and conversions | Labels show average time between stages
        </p>
      </Card>
    </>
  );
}
