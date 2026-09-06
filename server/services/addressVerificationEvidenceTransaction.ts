import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { addressVerifications, users } from "@shared/schema";
import {
  discardAddressVerificationEvidence,
  snapshotAddressVerificationEvidence,
} from "./addressVerificationEvidence";

type VerificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type EvidenceSnapshot = (sourceKey: string, contentType: string) => Promise<string>;

/** Track only copies created by this submission, never its original upload or older evidence. */
export async function withAddressEvidenceTransaction<T>(
  userId: string,
  submit: (tx: VerificationTransaction, snapshot: EvidenceSnapshot) => Promise<T>
): Promise<T> {
  const createdKeys = new Set<string>();
  try {
    return await db.transaction((tx) =>
      submit(tx, async (sourceKey, contentType) => {
        const key = await snapshotAddressVerificationEvidence(sourceKey, userId, contentType);
        createdKeys.add(key);
        return key;
      })
    );
  } catch (submissionError) {
    if (createdKeys.size > 0) {
      try {
        await db.transaction(
          async (tx) => {
            await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
            await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
            // Match the account-first lock order used by submission and review. A rejected
            // commit response alone cannot establish whether the original write committed.
            const [account] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, userId))
              .for("update");
            if (!account) return;

            for (const key of createdKeys) {
              // Check every reference, not just one owner or the latest submission.
              const [reference] = await tx
                .select({ id: addressVerifications.id })
                .from(addressVerifications)
                .where(eq(addressVerifications.documentUrl, key))
                .limit(1);
              if (!reference) await discardAddressVerificationEvidence(key, userId);
            }
          },
          // The reference read must see a commit that completed while the account lock waited.
          { isolationLevel: "read committed" }
        );
      } catch {
        // Retain evidence when its reference state is uncertain. Never replace the original
        // submission error or put account identifiers/document keys into cleanup diagnostics.
        console.warn("Address verification evidence cleanup deferred");
      }
    }
    throw submissionError;
  }
}
