import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  carSalesmanProfiles,
  events,
  realtorProfiles,
  users,
  type InsertCarSalesmanProfile,
  type InsertRealtorProfile,
} from "../../shared/schema";
import { createProfessionalApplicationPersistence } from "../storage";

type FakeState = {
  realtors: any[];
  carSalesmen: any[];
  users: any[];
  events: any[];
};

type FakeFailure = {
  auditEventType?: string;
  userUpdate?: boolean;
};

function cloneState(state: FakeState): FakeState {
  return structuredClone(state);
}

function replaceState(target: FakeState, source: FakeState): void {
  target.realtors.splice(0, target.realtors.length, ...source.realtors);
  target.carSalesmen.splice(0, target.carSalesmen.length, ...source.carSalesmen);
  target.users.splice(0, target.users.length, ...source.users);
  target.events.splice(0, target.events.length, ...source.events);
}

function lazyOperation(run: () => Promise<any[]>) {
  let operation: Promise<any[]> | undefined;
  const execute = () => {
    operation ??= run();
    return operation;
  };
  return {
    returning: execute,
    then: (resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) =>
      execute().then(resolve, reject),
  };
}

function createRowLockManager() {
  const locks = new Map<
    string,
    { locked: boolean; waiters: Array<(release: () => void) => void> }
  >();

  const acquire = (key: string): Promise<() => void> => {
    const entry = locks.get(key) ?? { locked: false, waiters: [] };
    locks.set(key, entry);

    return new Promise((resolve) => {
      const createRelease = () => {
        let released = false;
        return () => {
          if (released) return;
          released = true;
          const next = entry.waiters.shift();
          if (next) {
            next(createRelease());
          } else {
            entry.locked = false;
            locks.delete(key);
          }
        };
      };

      if (entry.locked) {
        entry.waiters.push(resolve);
      } else {
        entry.locked = true;
        resolve(createRelease());
      }
    });
  };

  return { acquire };
}

function createFakeProfessionalDatabase(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    realtors: initial.realtors ?? [],
    carSalesmen: initial.carSalesmen ?? [],
    users: initial.users ?? [],
    events: initial.events ?? [],
  };
  const failures: FakeFailure = {};
  const forUpdateTables: unknown[] = [];
  const lockManager = createRowLockManager();

  const rowsForTable = (table: unknown): any[] => {
    if (table === realtorProfiles) return state.realtors;
    if (table === carSalesmanProfiles) return state.carSalesmen;
    if (table === users) return state.users;
    if (table === events) return state.events;
    throw new Error("Unexpected fake table");
  };

  const lockKeyForTable = (table: unknown): string => {
    const row = rowsForTable(table)[0];
    if (table === users) return `users:${row?.id ?? "missing"}`;
    if (table === realtorProfiles) return `realtors:${row?.id ?? "missing"}`;
    if (table === carSalesmanProfiles) return `car-salesmen:${row?.id ?? "missing"}`;
    return "events";
  };

  const makeQueryable = (heldLocks?: Array<() => void>) => ({
    select: (_selection?: unknown) => ({
      from: (table: unknown) => {
        let lockForUpdate = false;
        const query: any = {
          where: () => query,
          limit: () => query,
          for: (mode: string) => {
            if (mode !== "update") throw new Error(`Unexpected lock mode ${mode}`);
            lockForUpdate = true;
            forUpdateTables.push(table);
            return query;
          },
          then: async (resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) => {
            try {
              if (lockForUpdate) {
                if (!heldLocks) throw new Error("FOR UPDATE used outside a transaction");
                heldLocks.push(await lockManager.acquire(lockKeyForTable(table)));
              }
              return resolve(rowsForTable(table).map((row) => ({ ...row })));
            } catch (error) {
              return reject(error);
            }
          },
        };
        return query;
      },
    }),
  });

  const database: any = {
    ...makeQueryable(),
    transaction: async (callback: (tx: any) => Promise<any>) => {
      const snapshot = cloneState(state);
      const heldLocks: Array<() => void> = [];
      const tx: any = {
        ...makeQueryable(heldLocks),
        insert: (table: unknown) => ({
          values: (value: any) =>
            lazyOperation(async () => {
              if (table === events) {
                if (failures.auditEventType === value.eventType) {
                  throw new Error(`Injected audit failure for ${value.eventType}`);
                }
                const event = { id: `event-${state.events.length + 1}`, ...value };
                state.events.push(event);
                return [event];
              }

              const rows = rowsForTable(table);
              if (rows.some((row) => row.userId === value.userId)) {
                const error: any = new Error("duplicate professional application user");
                error.code = "23505";
                error.constraint =
                  table === realtorProfiles
                    ? "uq_realtor_profiles_user_id"
                    : "uq_car_salesman_profiles_user_id";
                throw error;
              }
              const prefix = table === realtorProfiles ? "realtor" : "car-salesman";
              const profile = { id: `${prefix}-${rows.length + 1}`, ...value };
              rows.push(profile);
              return [profile];
            }),
        }),
        update: (table: unknown) => ({
          set: (value: any) => ({
            where: () =>
              lazyOperation(async () => {
                if (table === users && failures.userUpdate) {
                  throw new Error("Injected user update failure");
                }
                const rows = rowsForTable(table);
                const row = rows[0];
                if (!row) return [];
                Object.assign(row, value);
                return [{ ...row }];
              }),
          }),
        }),
      };

      try {
        return await callback(tx);
      } catch (error) {
        replaceState(state, snapshot);
        throw error;
      } finally {
        for (const release of heldLocks.reverse()) release();
      }
    },
  };

  return { database, failures, forUpdateTables, state };
}

const realtorApplication = (userId = "user-1"): InsertRealtorProfile => ({
  userId,
  licenseNumber: "RE-12345",
  brokerageName: "County Realty",
  mlsId: "MLS-100",
  specializations: ["Residential Sales"],
  yearsExperience: 7,
  licenseState: "FL",
  licenseExpiration: new Date("2030-12-31T00:00:00.000Z"),
  serviceAreas: {
    counties: ["Escambia County"],
    cities: ["Pensacola"],
    zipCodes: ["32501"],
  },
});

const carSalesmanApplication = (userId = "user-1"): InsertCarSalesmanProfile => ({
  userId,
  dealershipName: "County Motors",
  dealerLicense: "DL-12345",
  salesmanLicense: "SL-12345",
  specializations: ["Used Vehicle Sales"],
  brandsSpecialty: ["Ford"],
  yearsExperience: 5,
  licenseState: "FL",
  licenseExpiration: new Date("2030-11-30T00:00:00.000Z"),
  serviceAreas: {
    counties: ["Escambia County"],
    cities: ["Pensacola"],
    zipCodes: ["32501"],
  },
});

describe("professional application transactional storage", () => {
  it("exposes no legacy profile creation, standalone approval, or role-grant entry point", () => {
    const fake = createFakeProfessionalDatabase();
    const persistence = createProfessionalApplicationPersistence(fake.database);
    expect(Object.keys(persistence).sort()).toEqual([
      "decideCarSalesmanApplication",
      "decideRealtorApplication",
      "submitCarSalesmanApplication",
      "submitRealtorApplication",
    ]);

    const storageSource = fs.readFileSync(path.resolve(process.cwd(), "server/storage.ts"), "utf8");
    const contractSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/storage/contracts.ts"),
      "utf8"
    );
    for (const legacyMethod of [
      "createRealtorProfile(",
      "createCarSalesmanProfile(",
      "grantProfessionalRole(",
      "removePendingApplicationRole(",
      "updateRealtorVerificationStatus(",
      "updateCarSalesmanVerificationStatus(",
    ]) {
      expect(storageSource).not.toContain(legacyMethod);
      expect(contractSource).not.toContain(legacyMethod);
    }
    expect(storageSource).not.toContain(".set({ ...profileData");
    expect(storageSource).toContain("editableProfessionalProfileData(profileData)");
  });

  it("fails migration preflight on legacy duplicates instead of deleting data", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0129_professional_application_integrity.sql"),
      "utf8"
    );

    expect(migration).toContain("HAVING count(*) > 1");
    expect(migration).toContain("professional application integrity preflight failed");
    expect(migration).toContain("Do not delete rows automatically");
    expect(migration).toContain("USING ERRCODE = '23505'");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+(realtor|car_salesman)_profiles/i);
    expect(migration).toContain("CREATE UNIQUE INDEX uq_realtor_profiles_user_id");
    expect(migration).toContain("CREATE UNIQUE INDEX uq_car_salesman_profiles_user_id");
  });

  it("reconciles legacy professional authority and keeps under-review rows decidable", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0129_professional_application_integrity.sql"),
      "utf8"
    );

    expect(
      migration.match(/verification_status IS NULL OR verification_status = 'under_review'/g)
    ).toHaveLength(2);
    expect(migration).toContain("approved_professional_authority");
    expect(migration).toContain("realtor_profiles.verification_status = 'approved'");
    expect(migration).toContain("car_salesman_profiles.verification_status = 'approved'");
    expect(migration.match(/is_active IS TRUE/g)).toHaveLength(4);
    expect(migration).toContain("authority.realtor_approved THEN ARRAY['realtor']::text[]");
    expect(migration).toContain("authority.car_dealer_approved THEN ARRAY['car_dealer']::text[]");
    expect(migration).toContain("'car_salesman'");
    expect(migration).toContain("'vehicle_dealer'");
    expect(migration).toContain("regexp_replace(");
    expect(migration).toContain("WHEN users.role IS NULL THEN");
    expect(migration).toContain("ELSE 'homeowner'::user_role");
    expect(migration).toContain("roles = rebuilt.next_roles");
    expect(migration).toContain("tradescout-schema:0129:v2");
    expect(migration).not.toContain("tradescout-schema:0129:v1");
  });

  it("commits a pending inactive application and its audit event together", async () => {
    const fake = createFakeProfessionalDatabase();
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.submitRealtorApplication(realtorApplication());

    expect(result.outcome).toBe("created");
    expect(fake.state.realtors).toEqual([
      expect.objectContaining({
        userId: "user-1",
        verificationStatus: "pending",
        isActive: false,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      }),
    ]);
    expect(fake.state.events).toEqual([
      expect.objectContaining({
        eventType: "realtor_application_submitted",
        userId: "user-1",
      }),
    ]);
  });

  it("rolls back profile creation when the submission audit insert fails", async () => {
    const fake = createFakeProfessionalDatabase();
    fake.failures.auditEventType = "realtor_application_submitted";
    const persistence = createProfessionalApplicationPersistence(fake.database);

    await expect(persistence.submitRealtorApplication(realtorApplication())).rejects.toThrow(
      "Injected audit failure"
    );
    expect(fake.state.realtors).toEqual([]);
    expect(fake.state.events).toEqual([]);
  });

  it("turns a unique-user violation into a deterministic duplicate result", async () => {
    const existing = {
      id: "realtor-existing",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const fake = createFakeProfessionalDatabase({ realtors: [existing] });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.submitRealtorApplication(realtorApplication());

    expect(result).toEqual({ outcome: "duplicate", profile: existing });
    expect(fake.state.realtors).toHaveLength(1);
    expect(fake.state.events).toEqual([]);
  });

  it("returns an already-decided conflict without changing roles or audit history", async () => {
    const profile = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "approved",
      isActive: true,
    };
    const user = {
      id: "user-1",
      role: "contractor",
      activeRole: "contractor",
      roles: ["homeowner", "contractor", "realtor"],
    };
    const fake = createFakeProfessionalDatabase({ realtors: [profile], users: [user] });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideRealtorApplication({
      profileId: "realtor-1",
      approved: false,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "Retry",
    });

    expect(result).toEqual({ outcome: "already_decided", profile });
    expect(fake.state.users).toEqual([user]);
    expect(fake.state.events).toEqual([]);
    expect(fake.forUpdateTables).toEqual([realtorProfiles, carSalesmanProfiles]);
  });

  it("rolls back status and durable review metadata when the role update fails", async () => {
    const profile = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    };
    const user = {
      id: "user-1",
      role: "contractor",
      activeRole: "contractor",
      roles: ["homeowner", "contractor"],
    };
    const fake = createFakeProfessionalDatabase({ realtors: [profile], users: [user] });
    fake.failures.userUpdate = true;
    const persistence = createProfessionalApplicationPersistence(fake.database);

    await expect(
      persistence.decideRealtorApplication({
        profileId: "realtor-1",
        approved: true,
        reviewedBy: "admin-1",
        reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
        reviewNotes: "License confirmed",
      })
    ).rejects.toThrow("Injected user update failure");

    expect(fake.state.realtors).toEqual([
      expect.objectContaining({
        id: "realtor-1",
        verificationStatus: "pending",
        isActive: false,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      }),
    ]);
    expect(fake.state.users).toEqual([user]);
    expect(fake.state.events).toEqual([]);
  });

  it("rolls back the profile and user projection when decision audit persistence fails", async () => {
    const profile = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    };
    const user = {
      id: "user-1",
      role: "contractor",
      activeRole: "contractor",
      roles: ["homeowner", "contractor"],
    };
    const initialProfile = structuredClone(profile);
    const initialUser = structuredClone(user);
    const fake = createFakeProfessionalDatabase({ realtors: [profile], users: [user] });
    fake.failures.auditEventType = "realtor_verification_decision";
    const persistence = createProfessionalApplicationPersistence(fake.database);

    await expect(
      persistence.decideRealtorApplication({
        profileId: "realtor-1",
        approved: true,
        reviewedBy: "admin-1",
        reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
        reviewNotes: "License confirmed",
      })
    ).rejects.toThrow("Injected audit failure");

    expect(fake.state.realtors).toEqual([initialProfile]);
    expect(fake.state.users).toEqual([initialUser]);
    expect(fake.state.events).toEqual([]);
  });

  it("serializes user-row locks so concurrent approvals preserve sibling roles", async () => {
    const realtor = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const carSalesman = {
      id: "car-salesman-1",
      ...carSalesmanApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const user = {
      id: "user-1",
      role: "contractor",
      activeRole: "contractor",
      roles: ["homeowner", "contractor"],
    };
    const fake = createFakeProfessionalDatabase({
      realtors: [realtor],
      carSalesmen: [carSalesman],
      users: [user],
    });
    const persistence = createProfessionalApplicationPersistence(fake.database);
    const reviewedAt = new Date("2026-09-01T12:00:00.000Z");

    const [realtorResult, carResult] = await Promise.all([
      persistence.decideRealtorApplication({
        profileId: realtor.id,
        approved: true,
        reviewedBy: "admin-1",
        reviewedAt,
        reviewNotes: "Realtor confirmed",
      }),
      persistence.decideCarSalesmanApplication({
        profileId: carSalesman.id,
        approved: true,
        reviewedBy: "admin-2",
        reviewedAt,
        reviewNotes: "Dealer confirmed",
      }),
    ]);

    expect(realtorResult.outcome).toBe("decided");
    expect(carResult.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "contractor",
        activeRole: "contractor",
        roles: ["homeowner", "contractor", "realtor", "car_dealer"],
      })
    );
    expect(fake.state.events.map((event) => event.eventType).sort()).toEqual([
      "car_salesman_verification_decision",
      "realtor_verification_decision",
    ]);
    expect(fake.forUpdateTables).toEqual(
      expect.arrayContaining([realtorProfiles, carSalesmanProfiles, users, users])
    );
  });

  it("rejects atomically while preserving unrelated roles and durable review evidence", async () => {
    const profile = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const user = {
      id: "user-1",
      role: "realtor",
      activeRole: "realtor",
      roles: ["homeowner", "contractor", "realtor"],
    };
    const fake = createFakeProfessionalDatabase({ realtors: [profile], users: [user] });
    const persistence = createProfessionalApplicationPersistence(fake.database);
    const reviewedAt = new Date("2026-09-01T12:00:00.000Z");

    const result = await persistence.decideRealtorApplication({
      profileId: profile.id,
      approved: false,
      reviewedBy: "admin-1",
      reviewedAt,
      reviewNotes: "License not confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.realtors[0]).toEqual(
      expect.objectContaining({
        verificationStatus: "rejected",
        isActive: false,
        reviewedBy: "admin-1",
        reviewedAt,
        reviewNotes: "License not confirmed",
      })
    );
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "contractor"],
      })
    );
    expect(fake.state.events).toEqual([
      expect.objectContaining({ eventType: "realtor_verification_decision" }),
    ]);
  });

  it("canonicalizes professional aliases when approving an application", async () => {
    const profile = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const user = {
      id: "user-1",
      role: "homeowner",
      activeRole: " ReAlToR ",
      roles: [" REALTOR ", "realtor", "contractor"],
    };
    const fake = createFakeProfessionalDatabase({ realtors: [profile], users: [user] });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideRealtorApplication({
      profileId: profile.id,
      approved: true,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "License confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "realtor",
        roles: ["realtor", "contractor", "homeowner"],
      })
    );
  });

  it("removes every realtor alias on rejection while preserving an approved car role", async () => {
    const realtor = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const approvedCarSalesman = {
      id: "car-salesman-1",
      ...carSalesmanApplication(),
      verificationStatus: "approved",
      isActive: true,
    };
    const user = {
      id: "user-1",
      role: "realtor",
      activeRole: " REALTOR ",
      roles: ["homeowner", "ReAlToR", " realtor ", "car-salesman", "vehicle dealer", "contractor"],
    };
    const fake = createFakeProfessionalDatabase({
      realtors: [realtor],
      carSalesmen: [approvedCarSalesman],
      users: [user],
    });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideRealtorApplication({
      profileId: realtor.id,
      approved: false,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "License not confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "car_dealer", "contractor"],
      })
    );
  });

  it("removes a stale sibling professional projection unless its locked application is approved", async () => {
    const realtor = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const rejectedCarSalesman = {
      id: "car-salesman-1",
      ...carSalesmanApplication(),
      verificationStatus: "rejected",
      isActive: false,
    };
    const user = {
      id: "user-1",
      role: "vehicle-dealer",
      activeRole: "car-salesman",
      roles: ["homeowner", "vehicle dealer", "contractor"],
    };
    const fake = createFakeProfessionalDatabase({
      realtors: [realtor],
      carSalesmen: [rejectedCarSalesman],
      users: [user],
    });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideRealtorApplication({
      profileId: realtor.id,
      approved: true,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "Realtor license confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "contractor", "realtor"],
      })
    );
    expect(fake.forUpdateTables.slice(0, 2)).toEqual([realtorProfiles, carSalesmanProfiles]);
  });

  it("removes every car-dealer alias on rejection while preserving a realtor role", async () => {
    const carSalesman = {
      id: "car-salesman-1",
      ...carSalesmanApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const approvedRealtor = {
      id: "realtor-1",
      ...realtorApplication(),
      verificationStatus: "approved",
      isActive: true,
    };
    const user = {
      id: "user-1",
      role: "car_dealer",
      activeRole: "vehicle-dealer",
      roles: [
        "homeowner",
        "car dealer",
        "CAR-DEALER",
        "car_salesman",
        "car-salesman",
        "vehicle_dealer",
        "vehicle dealer",
        "realtor",
      ],
    };
    const fake = createFakeProfessionalDatabase({
      realtors: [approvedRealtor],
      carSalesmen: [carSalesman],
      users: [user],
    });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideCarSalesmanApplication({
      profileId: carSalesman.id,
      approved: false,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "Dealer license not confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "realtor"],
      })
    );
  });

  it("gives a null legacy identity a deterministic homeowner fallback on rejection", async () => {
    const carSalesman = {
      id: "car-salesman-1",
      ...carSalesmanApplication(),
      verificationStatus: "pending",
      isActive: false,
    };
    const user = {
      id: "user-1",
      role: null,
      activeRole: " CAR SALESMAN ",
      roles: ["vehicle-dealer"],
    };
    const fake = createFakeProfessionalDatabase({ carSalesmen: [carSalesman], users: [user] });
    const persistence = createProfessionalApplicationPersistence(fake.database);

    const result = await persistence.decideCarSalesmanApplication({
      profileId: carSalesman.id,
      approved: false,
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-09-01T12:00:00.000Z"),
      reviewNotes: "Dealer license not confirmed",
    });

    expect(result.outcome).toBe("decided");
    expect(fake.state.users[0]).toEqual(
      expect.objectContaining({
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner"],
      })
    );
  });
});
