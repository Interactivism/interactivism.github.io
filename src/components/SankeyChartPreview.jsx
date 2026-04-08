import SankeyChart from './SankeyChart';

const mockMetrics = [
  { total_impressions: 120000 },
  { total_impressions: 85000 },
  { total_impressions: 60000 },
];

const mockVisits = [
  { referral_source: 'direct_tv', visit_count: 3200, outcomes: 480 },
  { referral_source: 'social',    visit_count: 2100, outcomes: 210 },
  { referral_source: 'paid_search', visit_count: 1800, outcomes: 270 },
  { referral_source: 'referral',  visit_count: 900,  outcomes: 90  },
  { referral_source: 'organic',   visit_count: 650,  outcomes: 52  },
  { referral_source: 'pinterest', visit_count: 420,  outcomes: 63  },
];

export default function SankeyChartPreview() {
  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh' }}>
      <SankeyChart
        metrics={mockMetrics}
        visits={mockVisits}
        title="Attribution Flow — TV Impressions to Conversions"
      />
    </div>
  );
}
