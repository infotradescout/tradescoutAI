import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminAuditLogPage() {
  const { user } = useAuth();
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    fetch('/api/admin/audit-log', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setLog(data.log || []))
      .finally(() => setLoading(false));
  }, [user]);
  if (!user?.isSuperAdmin) return <div className="p-8 text-center">Access denied</div>;
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Audit Log</h1>
      {loading ? <div>Loading…</div> : (
        <table className="w-full text-sm border">
          <thead>
            <tr>
              <th className="border px-2 py-1">Time</th>
              <th className="border px-2 py-1">Action</th>
              <th className="border px-2 py-1">User</th>
              <th className="border px-2 py-1">Target</th>
              <th className="border px-2 py-1">Details</th>
            </tr>
          </thead>
          <tbody>
            {log.map((entry, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="border px-2 py-1">{entry.type}</td>
                <td className="border px-2 py-1">{entry.adminId}</td>
                <td className="border px-2 py-1">{entry.userId || entry.targetUserId || ''}</td>
                <td className="border px-2 py-1">{entry.newRole || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}