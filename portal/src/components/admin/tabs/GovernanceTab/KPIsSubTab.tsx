'use client';

interface KPIsSubTabProps {
  governanceKPIs: any;
  kpiPeriod: number;
  setKpiPeriod: (period: number) => void;
  onRefresh: () => void;
}

export default function KPIsSubTab({ governanceKPIs, kpiPeriod, setKpiPeriod, onRefresh }: KPIsSubTabProps) {
  return (
    <div className="space-y-6" data-testid="kpis-subtab">
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-400">Period:</label>
        <select
          value={kpiPeriod}
          onChange={(e) => {
            setKpiPeriod(Number(e.target.value));
            setTimeout(onRefresh, 100);
          }}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {governanceKPIs?.kpis ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Avg Response (High Risk)</p>
              <p className="text-2xl font-bold text-orange-400">
                {governanceKPIs.kpis.avg_high_risk_response_time > 0 
                  ? `${governanceKPIs.kpis.avg_high_risk_response_time.toFixed(1)} min` 
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Avg Response (Imminent)</p>
              <p className="text-2xl font-bold text-red-400">
                {governanceKPIs.kpis.avg_imminent_risk_response_time > 0 
                  ? `${governanceKPIs.kpis.avg_imminent_risk_response_time.toFixed(1)} min` 
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">SLA Compliance</p>
              <p className={`text-2xl font-bold ${governanceKPIs.kpis.pct_high_risk_reviewed_in_sla >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>
                {governanceKPIs.kpis.pct_high_risk_reviewed_in_sla?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">High Risk Alerts</p>
              <p className="text-2xl font-bold">{governanceKPIs.kpis.total_high_risk_alerts || 0}</p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Imminent Risk Alerts</p>
              <p className="text-2xl font-bold text-red-400">{governanceKPIs.kpis.total_imminent_risk_alerts || 0}</p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Medium Risk Alerts</p>
              <p className="text-2xl font-bold text-yellow-400">{governanceKPIs.kpis.total_medium_risk_alerts || 0}</p>
            </div>
          </div>
          
          {/* Risk Distribution */}
          {governanceKPIs.kpis.risk_level_distribution && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h4 className="font-semibold mb-4">Risk Level Distribution</h4>
              <div className="flex gap-4">
                {['imminent', 'high', 'medium', 'low'].map((level) => (
                  <div key={level} className="flex-1">
                    <div className={`h-4 rounded ${
                      level === 'imminent' ? 'bg-red-500' :
                      level === 'high' ? 'bg-orange-500' :
                      level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} style={{
                      width: `${Math.max(10, (governanceKPIs.kpis.risk_level_distribution[level] || 0) * 10)}%`
                    }} />
                    <p className="text-xs text-gray-400 mt-1 capitalize">{level}: {governanceKPIs.kpis.risk_level_distribution[level] || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
          <p>Loading KPI data...</p>
        </div>
      )}
    </div>
  );
}
