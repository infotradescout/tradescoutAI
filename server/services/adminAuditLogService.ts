// Minimal admin audit log service
const auditLog: any[] = [];

export async function logAdminAction(event: any) {
  auditLog.push({ ...event, timestamp: new Date() });
}

export async function getAdminAuditLog(limit = 100) {
  return auditLog.slice(-limit).reverse();
}
