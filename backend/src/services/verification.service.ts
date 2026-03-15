import { db } from '../config/db';
import { userProgress, airdropTasks, userWallets } from '../models/index';
import { and, eq } from 'drizzle-orm';
import { getWalletTransactions, doesTxMatchTask } from './moralis.service';

export interface VerificationResult {
    taskId: number;
    completed: boolean;
    txHash?: string;
    verifiedBy: 'auto' | 'manual';
}

// ─── Auto-verify a single task for a user ────────────────────────────────────

export async function verifyTask(
    userId: number,
    taskId: number
): Promise<VerificationResult> {
    // 1. Get task details
    const [task] = await db
        .select()
        .from(airdropTasks)
        .where(eq(airdropTasks.id, taskId));

    if (!task) throw new Error(`Task ${taskId} not found`);
    if (!task.isAutoVerifiable) {
        return { taskId, completed: false, verifiedBy: 'manual' };
    }

    // 2. Get user's wallets
    const wallets = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.userId, userId));

    if (wallets.length === 0) {
        return { taskId, completed: false, verifiedBy: 'auto' };
    }

    // 3. Check each wallet
    for (const wallet of wallets) {
        const chains = task.chain ? [task.chain] : undefined;
        const txs = await getWalletTransactions(wallet.address, chains, 100);

        for (const tx of txs) {
            if (doesTxMatchTask(tx, {
                contractAddress: task.contractAddress,
                chain: task.chain,
                minAmount: task.minAmount,
                tokenSymbol: task.tokenSymbol,
            })) {
                // ✅ Match found! Write to DB
                await db
                    .insert(userProgress)
                    .values({
                        userId,
                        taskId,
                        walletId: wallet.id,
                        completed: true,
                        completedAt: new Date(),
                        verifiedBy: 'auto',
                        txHash: tx.hash,
                    })
                    .onConflictDoNothing();

                return {
                    taskId,
                    completed: true,
                    txHash: tx.hash,
                    verifiedBy: 'auto',
                };
            }
        }
    }

    return { taskId, completed: false, verifiedBy: 'auto' };
}

// ─── Get progress % for a project ────────────────────────────────────────────

export async function getProjectProgress(
    userId: number,
    projectId: number
): Promise<{ percent: number; completedCount: number; totalCount: number }> {
    const tasks = await db
        .select()
        .from(airdropTasks)
        .where(eq(airdropTasks.projectId, projectId));

    if (tasks.length === 0) return { percent: 0, completedCount: 0, totalCount: 0 };

    const taskIds = tasks.map((t) => t.id);
    const completedRows = await db
        .select()
        .from(userProgress)
        .where(
            and(
                eq(userProgress.userId, userId),
                eq(userProgress.completed, true)
            )
        );

    const completedCount = completedRows.filter((r) => taskIds.includes(r.taskId)).length;
    const percent = Math.round((completedCount / tasks.length) * 100);

    return { percent, completedCount, totalCount: tasks.length };
}
