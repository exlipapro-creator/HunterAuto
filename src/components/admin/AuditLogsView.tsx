import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types';
import { Shield, Search, Clock, User, AlertCircle } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    fetch('/api/v1/audit-logs')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setLogs(json.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.entityId.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" id="audit-logs-container">
      <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase tracking-widest block">
            IMMUTABLE SECURITY TELEMETRY
          </span>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase">
            AUDIT LOG TRAIL
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Cryptographically sealed and append-only record of all financial, inventory, and status mutations.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search action, actor, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white font-mono-telemetry focus:outline-none focus:border-[#159EF3]"
          />
        </div>
      </div>

      <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-telemetry text-xs">
            <thead className="bg-[#000000] border-b border-[#132038] text-[#8E9BAE] uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Telemetry Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132038]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#001830] transition-colors">
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className="font-bold text-white">{log.actorName}</span>
                    <span className="block text-[10px] text-slate-500">{log.actorRole}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-[#002958] text-[#159EF3] border border-[#159EF3]/30">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-300">
                    {log.entityType}: <strong className="text-white">{log.entityId}</strong>
                  </td>
                  <td className="p-3.5 text-slate-300 max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
