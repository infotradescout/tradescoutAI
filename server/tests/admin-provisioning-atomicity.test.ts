import { describe, expect, it, vi } from "vitest";
import { executeAdminProvisioningAtomically } from "../services/adminProvisioningTransaction";

type ProvisioningStage = "user" | "declaration" | "business" | "profile" | "token" | "audit";
type FakeState = Record<ProvisioningStage, string[]>;

const emptyState = (): FakeState => ({
  user: [],
  declaration: [],
  business: [],
  profile: [],
  token: [],
  audit: [],
});

class RollbackDatabase {
  state = emptyState();
  committed = false;

  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.state);
    const tx = {
      write: (stage: ProvisioningStage, value: string) => {
        this.state[stage].push(value);
      },
    };

    try {
      const result = await callback(tx);
      this.committed = true;
      return result;
    } catch (error) {
      this.state = snapshot;
      this.committed = false;
      throw error;
    }
  }
}

describe("admin user provisioning transaction boundary", () => {
  it("performs every validation before the first mutation", async () => {
    const database = new RollbackDatabase();
    const mutate = vi.fn();
    const afterCommit = vi.fn();

    await expect(
      executeAdminProvisioningAtomically({
        database,
        validate: async () => {
          throw new Error("eligibility rejected");
        },
        mutate,
        afterCommit,
      })
    ).rejects.toThrow("eligibility rejected");

    expect(mutate).not.toHaveBeenCalled();
    expect(afterCommit).not.toHaveBeenCalled();
    expect(database.state).toEqual(emptyState());
  });

  for (const failedStage of ["declaration", "business", "profile", "token", "audit"] as const) {
    it(`rolls back user and prior writes when ${failedStage} persistence fails`, async () => {
      const database = new RollbackDatabase();
      const stages: ProvisioningStage[] = [
        "user",
        "declaration",
        "business",
        "profile",
        "token",
        "audit",
      ];

      await expect(
        executeAdminProvisioningAtomically({
          database,
          validate: async () => ({ allowed: true }),
          mutate: async (tx) => {
            for (const stage of stages) {
              tx.write(stage, `new-${stage}`);
              if (stage === failedStage) throw new Error(`${stage} write failed`);
            }
            return { ok: true };
          },
        })
      ).rejects.toThrow(`${failedStage} write failed`);

      expect(database.committed).toBe(false);
      expect(database.state).toEqual(emptyState());
    });
  }

  it("runs external email work only after the complete database unit commits", async () => {
    const database = new RollbackDatabase();
    const observed: string[] = [];

    const result = await executeAdminProvisioningAtomically({
      database,
      validate: async () => ({ allowed: true }),
      mutate: async (tx) => {
        for (const stage of [
          "user",
          "declaration",
          "business",
          "profile",
          "token",
          "audit",
        ] as const) {
          tx.write(stage, stage);
        }
        return { userId: "user-1" };
      },
      afterCommit: async ({ userId }) => {
        expect(database.committed).toBe(true);
        expect(database.state.token).toEqual(["token"]);
        observed.push(`email:${userId}`);
      },
    });

    expect(result).toEqual({ userId: "user-1" });
    expect(observed).toEqual(["email:user-1"]);
    expect(database.state).toEqual({
      user: ["user"],
      declaration: ["declaration"],
      business: ["business"],
      profile: ["profile"],
      token: ["token"],
      audit: ["audit"],
    });
  });
});
