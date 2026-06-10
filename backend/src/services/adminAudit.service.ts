import { db } from '../config/db';
import { adminAuditLog } from '../models/market.model';

export interface AuditLogEntry {
    adminEmail: string;
    action: string;
    targetTable?: string;
    targetId?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    ipAddress?: string;
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
    await db.insert(adminAuditLog).values({
        adminEmail: entry.adminEmail,
        action: entry.action,
        targetTable: entry.targetTable ?? null,
        targetId: entry.targetId ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        ipAddress: entry.ipAddress ?? null,
    });
}
