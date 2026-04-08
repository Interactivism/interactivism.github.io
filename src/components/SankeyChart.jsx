import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Table2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AttributionHeatmapTable from './AttributionHeatmapTable';
import LastTouchSourcesModal from './LastTouchSourcesModal';

export default function SankeyChart({ metrics, visits, title }) {
  const [showTable, setShowTable] = useState(false);
  const [showLastTouch, setShowLastTouch] = useState(false);
  // Calculate totals
  const totalImpressions = metrics.reduce((sum, m) => sum + (m.total_impressions || 0), 0);

  // Aggregate visits by referral source
  const visitsBySource = visits.reduce((acc, v) => {
    // Skip direct
    if (v.referral_source === 'direct') {
      return acc;
    }

    const source = v.referral_source === 'direct_tv' ? 'TVScientific Direct' :
                   v.referral_source === 'social' ? 'Meta' :
                   v.referral_source === 'paid_search' ? 'Search' :
                   v.referral_source === 'referral' ? 'Email' :
                   v.referral_source === 'organic' ? 'Snap' :
                   'Pinterest';

    if (!acc[source]) {
      acc[source] = { visits: 0, conversions: 0 };
    }
    acc[source].visits += v.visit_count || 0;
    acc[source].conversions += v.outcomes || 0;
    return acc;
  }, {});

  // Ensure all sources have at least some baseline volume
  const defaultSources = ['TVScientific Direct', 'Meta', 'Search', 'Email', 'Snap', 'Pinterest'];
  defaultSources.forEach(source => {
    if (!visitsBySource[source]) {
      visitsBySource[source] = { visits: 120, conversions: 18 };
    }
  });

  // Define color palette
  const colors = {
    'TVScientific Direct': '#6366f1',
    'Meta': '#ec4899',
    'Search': '#eab308',
    'Email': '#8b5cf6',
    'Snap': '#f97316',
    'Pinterest': '#10b981'
  };

  // Build nodes with colors
  const sources = Object.keys(visitsBySource);
  const nodes = [
    { name: 'TV Impressions', nodeColor: '#6366f1' },
    ...sources.map(source => ({
      name: `${source} Visits`,
      nodeColor: colors[source] || '#94a3b8'
    })),
    { name: 'Total Conversions', nodeColor: '#10b981' },
    { name: 'No Conversion', nodeColor: '#94a3b8' }
  ];

  // Build links with time metrics
  const links = [];

  // Generate time data (in minutes/hours)
  const getTimeData = (source) => {
    const baseImpToVisit = {
      'TVScientific Direct': 12,
      'Meta': 45,
      'Search': 30,
      'Email': 60,
      'Snap': 38,
      'Pinterest': 25
    };
    const baseVisitToConv = {
      'TVScientific Direct': 180,
      'Meta': 240,
      'Search': 120,
      'Email': 360,
      'Snap': 200,
      'Pinterest': 150
    };
    return {
      impToVisit: baseImpToVisit[source] || 30,
      visitToConv: baseVisitToConv[source] || 180
    };
  };

  // Impressions to Visits
  sources.forEach((source, idx) => {
    const times = getTimeData(source);
    links.push({
      source: 0,
      target: idx + 1,
      value: visitsBySource[source].visits,
      color: colors[source] || '#94a3b8',
      avgTime: times.impToVisit
    });
  });

  // Visits to Conversions and No Conversion
  const totalConversionsIndex = sources.length + 1;
  const noConversionIndex = sources.length + 2;

  sources.forEach((source, idx) => {
    const times = getTimeData(source);
    const totalVisits = visitsBySource[source].visits;
    const conversions = visitsBySource[source].conversions;
    const noConversions = totalVisits - conversions;

    // Link to Conversions
    if (conversions > 0) {
      links.push({
        source: idx + 1,
        target: totalConversionsIndex,
        value: conversions,
        color: colors[source] || '#94a3b8',
        avgTime: times.visitToConv
      });
    }

    // Link to No Conversion
    if (noConversions > 0) {
      links.push({
        source: idx + 1,
        target: noConversionIndex,
        value: noConversions,
        color: colors[source] || '#94a3b8',
        avgTime: null
      });
    }
  });

  const data = { nodes, links };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const linkData = data.payload;

      // Check if it's a link (has source and target) or a node
      if (linkData && linkData.source !== undefined && linkData.target !== undefined) {
        const sourceName = nodes[linkData.source]?.name || 'Source';
        const targetName = nodes[linkData.target]?.name || 'Target';

        return (
          <div className="bg-white p-3 rounded-lg shadow-lg border">
            <p className="font-semibold text-gray-900 text-sm">{sourceName} → {targetName}</p>
            <p className="text-sm text-gray-600 mt-1">
              Volume: {linkData.value?.toLocaleString() || 0}
            </p>
            {linkData.avgTime && (
              <p className="text-sm text-indigo-600 font-medium mt-1">
                Avg Time: {formatTime(linkData.avgTime)}
              </p>
            )}
          </div>
        );
      } else if (data.name) {
        // It's a node
        return (
          <div className="bg-white p-3 rounded-lg shadow-lg border">
            <p className="font-semibold text-gray-900">{data.name}</p>
          </div>
        );
      }
    }
    return null;
  };

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
          <div className="overflow-auto p-6">
            <AttributionHeatmapTable />
          </div>
        </div>
      </div>
    )}
    <Card className="p-6 border-0 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLastTouch(true)} className="gap-2">
            <Layers className="w-4 h-4" />
            Last Touch Sources
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTable(true)} className="gap-2">
            <Table2 className="w-4 h-4" />
            View Data Table
          </Button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <Sankey
          data={data}
          node={(props) => {
            const { x, y, width, height, index, payload } = props;
            const fillColor = payload.nodeColor || '#6366f1';
            return (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fillColor}
                  fillOpacity={0.8}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={x - 8}
                  y={y + height / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#1e293b"
                  fontSize="12"
                  fontWeight="700"
                >
                  {payload.name}
                </text>
              </g>
            );
          }}
          link={(props) => {
            const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index } = props;
            const linkData = data.links[index];

            // Calculate midpoint for label
            const midX = (sourceX + targetX) / 2;
            const midY = (sourceY + targetY) / 2;

            return (
              <g>
                <path
                  d={`
                    M${sourceX},${sourceY + linkWidth / 2}
                    C${sourceControlX},${sourceY + linkWidth / 2}
                      ${targetControlX},${targetY + linkWidth / 2}
                      ${targetX},${targetY + linkWidth / 2}
                    L${targetX},${targetY - linkWidth / 2}
                    C${targetControlX},${targetY - linkWidth / 2}
                      ${sourceControlX},${sourceY - linkWidth / 2}
                      ${sourceX},${sourceY - linkWidth / 2}
                    Z
                  `}
                  fill={linkData.color || '#94a3b8'}
                  fillOpacity={0.3}
                  stroke="none"
                />
                {linkData.avgTime && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize="11"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    ⏱ {formatTime(linkData.avgTime)}
                  </text>
                )}
              </g>
            );
          }}
          nodePadding={50}
          margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.keys(colors).map(source => (
          <div key={source} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors[source] }}
            ></div>
            <span className="text-xs text-gray-600">{source}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4 text-center">
        Flow thickness represents volume of impressions, visits, and conversions | Hover to see average time between stages
      </p>
    </Card>
    </>
  );
}
