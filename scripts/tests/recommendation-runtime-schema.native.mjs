import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import dotenv from "dotenv";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";
import { buildTrustSnapshotsInsertSql } from "../../server/services/trustSnapshotsScoringSql.mjs";
import ts from "typescript";
import { drizzle } from "drizzle-orm/node-postgres";
import * as operators from "drizzle-orm";
import { z } from "zod";

assert.equal(process.env.NODE_ENV, "test");
const target = assertDisposableTestDatabaseUrl(process.env.TEST_DATABASE_URL);
assert.equal(target.loopback, true, "Native proof requires a disposable loopback database");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const { verifyRequiredProductionSchema, RECOMMENDATION_RUNTIME_SCHEMA_MIGRATION_HASHES } =
  await import("../check-required-production-schema.mjs");
const { toPublicContractorRecommendations } =
  await import("../../server/publicContractorRecommendations.ts");
const schema = await import("../../shared/schema.ts");
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();
const db = drizzle(client);
const {
  createRecommendationRepository,
  publicRecommendationConditions,
  RecommendationSubmissionError,
} = await import("../../server/storage/repositories/recommendations.ts");
// The outer fixture transaction always rolls back. Repository transactions use
// savepoints here so the actual owner cannot commit the surrounding DDL fixture.
const repositoryDatabase = new Proxy(db, {
  get(target, property) {
    if (property === "transaction")
      return async (run) => {
        await client.query("SAVEPOINT recommendation_owner");
        try {
          const result = await run(db);
          await client.query("RELEASE SAVEPOINT recommendation_owner");
          return result;
        } catch (error) {
          await client.query("ROLLBACK TO SAVEPOINT recommendation_owner");
          throw error;
        }
      };
    const value = target[property];
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const recommendationRepository = createRecommendationRepository(repositoryDatabase);
// Execute the actual route handler and storage method source with the native
// fixture DB, without importing unrelated server startup/provider side effects.
const sourceFile = (file) =>
  ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const storageSource = sourceFile("server/storage.ts");
const storageClass = storageSource.statements.find(
  (node) => ts.isClassDeclaration(node) && node.name?.text === "DatabaseStorage"
);
const methodNames = [
  "getContractorRatings",
  "moderateContractorRecommendation",
  "getContractorRecommendations",
  "updateContractorRecommendationStats",
  "analyzeContractorPerformance",
  "updateGoalProgress",
];
const methods = methodNames.map((name) => {
  const method = storageClass?.members.find(
    (member) => member.name?.getText(storageSource) === name
  );
  assert.ok(method, `Current storage owner is missing ${name}`);
  return method.getText(storageSource);
});
function instantiate(source, variable, storage) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(
    "db",
    "schema",
    "operators",
    "storage",
    "recommendationRepository",
    "publicRecommendationConditions",
    "z",
    "RecommendationSubmissionError",
    "const {recommendations,contractors,users}=schema; const {and,eq,inArray,sql,gt,desc}=operators;\n" +
      compiled +
      "\nreturn " +
      variable +
      ";"
  )(
    db,
    schema,
    operators,
    storage,
    recommendationRepository,
    publicRecommendationConditions,
    z,
    RecommendationSubmissionError
  );
}
const storageOwner = instantiate(
  "const owner = new (class {" + methods.join("\n") + "})();",
  "owner"
);
storageOwner.getRecommendationInsight = async () => null;
storageOwner.createRecommendationInsight = async (data) => data;
storageOwner.getContractorGoals = async () => [
  { id: "fixture-goal", isActive: true, startingRecommendations: 0, targetRecommendations: 5 },
];
let goalProgress;
storageOwner.updateRecommendationGoal = async (_id, data) => {
  goalProgress = data.currentProgress;
};
const routesSource = sourceFile("server/routes/recommendations.ts");
let moderationNode;
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === "/api/admin/recommendations/:id/moderate"
  )
    moderationNode = node.arguments.at(-1);
  ts.forEachChild(node, visit);
}
visit(routesSource);
assert.ok(moderationNode, "Current authenticated moderation owner is missing");
const moderate = instantiate(
  routesSource.statements
    .find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "handleError")
    .getText(routesSource) +
    "\nconst handler = " +
    moderationNode.getText(routesSource) +
    ";",
  "handler",
  storageOwner
);
async function moderation(id, action) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await moderate({ params: { id }, body: { action }, user: { id: provider } }, response);
  return response;
}
const proof = [];
const migration = fs.readFileSync(
  "migrations/0137_restore_recommendation_runtime_schema.sql",
  "utf8"
);
const scoringSql = buildTrustSnapshotsInsertSql({ forceOverwrite: true, filterByUserId: true });
const signalStart = scoringSql.indexOf("recommendation_signals AS (");
const signalEnd = scoringSql.indexOf("marketplace_signals AS (");
assert.ok(signalStart > 0 && signalEnd > signalStart);
const signalSql =
  "WITH " +
  scoringSql.slice(signalStart, signalEnd).trim().replace(/,$/, "") +
  " SELECT positive_recommendations, negative_recommendations FROM recommendation_signals WHERE user_id=$1";
const provider = "native-recommendation-schema-provider";
const author = "native-recommendation-schema-author";
const publicationMigration = fs.readFileSync(
  "migrations/0138_recommendation_publication_projection.sql",
  "utf8"
);
const contractor = "native-recommendation-schema-contractor";
const addedColumns = [
  "recommendation_type",
  "project_type",
  "project_value",
  "work_quality",
  "timeliness",
  "communication",
  "would_hire_again",
  "customer_name",
  "customer_email",
  "customer_phone",
  "ip_address",
  "user_agent",
  "verification_method",
  "verified_at",
  "is_public",
  "moderation_status",
  "moderated_at",
  "moderated_by",
];
async function transaction(run) {
  await client.query("BEGIN");
  try {
    await run();
  } finally {
    await client.query("ROLLBACK");
  }
}
async function signals() {
  const result = await client.query(signalSql, [provider]);
  return result.rows[0] || { positive_recommendations: 0, negative_recommendations: 0 };
}
async function score() {
  await client.query("DELETE FROM trust_snapshots WHERE user_id=$1", [provider]);
  const result = await client.query(scoringSql, [provider]);
  assert.equal(result.rows[0].inserted_count, 1);
  return Number(
    (await client.query("SELECT cvs_score FROM trust_snapshots WHERE user_id=$1", [provider]))
      .rows[0].cvs_score
  );
}
try {
  assert.equal(
    (await client.query("select current_database() as name")).rows[0].name,
    target.database
  );
  await verifyRequiredProductionSchema(client);
  await client.query("EXPLAIN " + scoringSql, [provider]);
  proof.push({ completeCanonicalScoringPlan: true });
  const modeledColumns = [
    "id",
    "contractor_id",
    "user_id",
    "comment",
    "photo_url",
    "is_verified",
    "created_at",
    "updated_at",
    ...addedColumns,
  ];
  for (const column of modeledColumns) {
    await transaction(async () => {
      await client.query(`ALTER TABLE recommendations DROP COLUMN ${column} CASCADE`);
      await assert.rejects(
        verifyRequiredProductionSchema(client),
        /Required production schema is missing/
      );
    });
    proof.push({ missingColumnRejected: column });
  }
  for (const [label, mutation] of [
    ["public by default", "ALTER TABLE recommendations ALTER COLUMN is_public SET DEFAULT true"],
    [
      "approved by default",
      "ALTER TABLE recommendations ALTER COLUMN moderation_status SET DEFAULT 'approved'",
    ],
    [
      "implicit positive type",
      "ALTER TABLE recommendations ALTER COLUMN recommendation_type SET DEFAULT 'positive'",
    ],
    ["legacy rating required", "ALTER TABLE recommendations ALTER COLUMN rating SET NOT NULL"],
    ["primary key absent", "ALTER TABLE recommendations DROP CONSTRAINT recommendations_pkey"],
    [
      "wrong classification type",
      "ALTER TABLE recommendations ALTER COLUMN recommendation_type TYPE text",
    ],
  ]) {
    await transaction(async () => {
      if (label === "wrong classification type")
        await client.query("DROP TRIGGER recommendation_publication_projection ON recommendations");
      await client.query(mutation);
      if (label === "wrong classification type") await client.query(publicationMigration);
      await assert.rejects(
        verifyRequiredProductionSchema(client),
        /Required production schema is missing/
      );
    });
    proof.push({ incompatibleContractRejected: label });
  }
  await transaction(async () => {
    await client.query("DELETE FROM drizzle.__drizzle_migrations WHERE hash=any($1::text[])", [
      RECOMMENDATION_RUNTIME_SCHEMA_MIGRATION_HASHES,
    ]);
    await assert.rejects(verifyRequiredProductionSchema(client), /0137 canonical hash/);
  });
  proof.push({ missingMigrationRejected: true });
  await transaction(async () => {
    await client.query(
      "INSERT INTO users(id,email,role,county_fips,address_verified) VALUES($1,$2,'contractor','12001',true)",
      [provider, provider + "@tradescout.test"]
    );
    await client.query(
      "INSERT INTO contractors(id,user_id,company_name,slug,is_active,verified_licensed,verified_insured) VALUES($1,$2,'Native fixture',$1,true,true,true)",
      [contractor, provider]
    );
    await client.query(
      "INSERT INTO users(id,email,role,email_verified) VALUES($1,'fixture@tradescout.test','homeowner',true)",
      [author]
    );
    // Recreate the journal's populated legacy shape inside a rollback-only fixture.
    await client.query("DROP TRIGGER recommendation_publication_projection ON recommendations");
    await client.query(
      "ALTER TABLE recommendations " + addedColumns.map((c) => `DROP COLUMN ${c} CASCADE`).join(",")
    );
    await client.query(
      "ALTER TABLE recommendations ALTER COLUMN comment DROP NOT NULL, ALTER COLUMN rating SET NOT NULL"
    );
    await client.query(
      "INSERT INTO recommendations(id,contractor_id,user_id,rating,comment,is_verified) VALUES('native-legacy-high',$1,$2,5,NULL,true),('native-legacy-low',$1,$2,1,'Original low rating text',false)",
      [contractor, author]
    );
    await client.query(migration);
    await client.query(migration);
    await client.query(publicationMigration);
    const legacy = (
      await client.query(
        "SELECT id,rating,comment,recommendation_type,is_verified,is_public,moderation_status,customer_name,customer_email FROM recommendations WHERE id LIKE 'native-legacy-%' ORDER BY id"
      )
    ).rows;
    assert.deepEqual(legacy, [
      {
        id: "native-legacy-high",
        rating: 5,
        comment: "",
        recommendation_type: "legacy_unclassified",
        is_verified: true,
        is_public: false,
        moderation_status: "pending",
        customer_name: "",
        customer_email: "",
      },
      {
        id: "native-legacy-low",
        rating: 1,
        comment: "Original low rating text",
        recommendation_type: "legacy_unclassified",
        is_verified: false,
        is_public: false,
        moderation_status: "pending",
        customer_name: "",
        customer_email: "",
      },
    ]);
    await verifyRequiredProductionSchema(client);
    await client.query(
      "INSERT INTO recommendations(id,contractor_id,user_id,recommendation_type,comment,customer_name,customer_email) VALUES('native-current-new',$1,$2,'positive','Explicit modern review','Fixture','fixture@tradescout.test')",
      [contractor, author]
    );
    assert.equal(
      (await client.query("SELECT rating FROM recommendations WHERE id='native-current-new'"))
        .rows[0].rating,
      null
    );
    await client.query(
      "ALTER TABLE recommendations ALTER COLUMN recommendation_type DROP NOT NULL"
    );
    await client.query(
      "INSERT INTO recommendations(id,contractor_id,user_id,recommendation_type,comment,customer_name,customer_email,is_public,moderation_status,is_verified) VALUES('native-legacy-partial',$1,$2,NULL,'Preserved partial history','','',true,'approved',true)",
      [contractor, author]
    );
    await client.query(migration);
    assert.deepEqual(
      (
        await client.query(
          "SELECT recommendation_type,is_public,moderation_status,is_verified FROM recommendations WHERE id='native-legacy-partial'"
        )
      ).rows[0],
      {
        recommendation_type: "legacy_unclassified",
        is_public: false,
        moderation_status: "pending",
        is_verified: true,
      }
    );
    assert.equal((await moderation("native-legacy-high", "approve")).statusCode, 409);
    assert.equal((await moderation("native-legacy-low", "reject")).statusCode, 200);
    assert.equal((await moderation("native-current-new", "approve")).statusCode, 200);
    assert.deepEqual(await signals(), { positive_recommendations: 1, negative_recommendations: 0 });
    const baseline = await score();
    // Even corrupted publication flags cannot turn the sentinel into polarity.
    await client.query(
      "UPDATE recommendations SET is_public=true,moderation_status='approved' WHERE id='native-legacy-high'"
    );
    assert.deepEqual(await signals(), { positive_recommendations: 1, negative_recommendations: 0 });
    assert.equal(await score(), baseline);
    assert.deepEqual(
      toPublicContractorRecommendations([
        { recommendationType: "legacy_unclassified", isPublic: true, moderationStatus: "approved" },
      ]),
      []
    );
    assert.equal((await storageOwner.getContractorRecommendations(contractor)).length, 1);
    assert.equal(Number((await storageOwner.getContractorRatings(contractor)).count), 1);
    await storageOwner.updateContractorRecommendationStats(contractor);
    assert.deepEqual(
      (
        await client.query(
          "SELECT positive_recommendations,total_recommendations FROM contractors WHERE id=$1",
          [contractor]
        )
      ).rows[0],
      { positive_recommendations: 1, total_recommendations: 1 }
    );
    await client.query(
      "INSERT INTO contractors(id,company_name,slug) VALUES('native-legacy-competitor','Fixture competitor','native-legacy-competitor')"
    );
    await client.query(
      "INSERT INTO recommendations(contractor_id,user_id,recommendation_type,comment,customer_name,customer_email) SELECT 'native-legacy-competitor',$1,'legacy_unclassified','','','' FROM generate_series(1,5)",
      [provider]
    );
    const insight = await storageOwner.analyzeContractorPerformance(contractor);
    assert.equal(insight.totalRecommendations, 1);
    assert.equal(insight.competitorComparison.percentile, 100);
    await storageOwner.updateGoalProgress(contractor);
    assert.equal(Number(goalProgress), 20);
    proof.push({
      actualModerationHandlerRejectsSentinel: true,
      rejectionStillAllowed: true,
      canonicalApprovalStillWorks: true,
      publicReadAndCachedPrivateAggregatesExcludeSentinel: true,
      competitorAggregationUsesCanonicalTypes: true,
    });
    for (const [id, type, verified, published, moderation] of [
      ["positive", "positive", true, true, "approved"],
      ["unverified", "positive", false, true, "approved"],
      ["verification-unknown", "positive", null, true, "approved"],
      ["private", "positive", true, false, "approved"],
      ["publication-unknown", "positive", true, null, "approved"],
      ["pending", "positive", true, true, "pending"],
      ["moderation-unknown", "positive", true, true, null],
      ["moderation-uppercase", "positive", true, true, "APPROVED"],
      ["moderation-mixed-case", "positive", true, true, "Approved"],
      ["moderation-whitespace", "positive", true, true, " approved "],
      ["rejected", "positive", true, true, "rejected"],
    ]) {
      await client.query(
        "INSERT INTO recommendations(id,contractor_id,user_id,recommendation_type,comment,customer_name,customer_email,is_verified,is_public,moderation_status) VALUES($1,$2,$3,$4,'Preserved canonical text','Fixture','fixture@tradescout.test',$5,$6,$7)",
        ["native-current-" + id, contractor, author, type, verified, published, moderation]
      );
    }
    assert.deepEqual(await signals(), { positive_recommendations: 2, negative_recommendations: 0 });
    assert.equal(await score(), baseline + 2);
    assert.equal((await storageOwner.getContractorRecommendations(contractor)).length, 2);
    assert.equal(Number((await storageOwner.getContractorRatings(contractor)).count), 2);
    assert.deepEqual(
      (
        await client.query(
          "SELECT positive_recommendations,total_recommendations FROM contractors WHERE id=$1",
          [contractor]
        )
      ).rows[0],
      { positive_recommendations: 2, total_recommendations: 2 }
    );
    proof.push({ noncanonicalModerationGetsNoTrustPublicOrProjectionCredit: true });
    await client.query(
      "INSERT INTO recommendations(id,contractor_id,user_id,recommendation_type,comment,customer_name,customer_email,is_verified,is_public,moderation_status) VALUES('native-current-negative',$1,$2,'negative','Explicit negative','Fixture','fixture@tradescout.test',true,true,'approved')",
      [contractor, author]
    );
    assert.deepEqual(await signals(), { positive_recommendations: 2, negative_recommendations: 1 });
    assert.equal(await score(), baseline - 3);
    await client.query("UPDATE users SET email_verified=false WHERE id=$1", [author]);
    assert.deepEqual(await signals(), { positive_recommendations: 0, negative_recommendations: 0 });
    assert.equal((await storageOwner.getContractorRecommendations(contractor)).length, 0);
    assert.equal(
      (
        await client.query("SELECT total_recommendations FROM contractors WHERE id=$1", [
          contractor,
        ])
      ).rows[0].total_recommendations,
      0
    );
    await client.query(
      "UPDATE users SET email_verified=true,email='changed@tradescout.test' WHERE id=$1",
      [author]
    );
    assert.deepEqual(await signals(), { positive_recommendations: 0, negative_recommendations: 0 });
    await client.query("UPDATE users SET email='fixture@tradescout.test' WHERE id=$1", [author]);
    assert.deepEqual(await signals(), { positive_recommendations: 2, negative_recommendations: 1 });
    proof.push({
      authorRevocationRemovesTrustAndPublicCredit: true,
      changedAuthorEmailRemovesTrustCredit: true,
    });
    const before = (
      await client.query(
        "SELECT * FROM recommendations WHERE id LIKE 'native-current-%' ORDER BY id"
      )
    ).rows;
    await client.query(migration);
    assert.deepEqual(
      (
        await client.query(
          "SELECT * FROM recommendations WHERE id LIKE 'native-current-%' ORDER BY id"
        )
      ).rows,
      before
    );
    proof.push({
      legacyRowsPreserved: true,
      modernInsertWithoutRating: true,
      legacyUnclassifiedGainsNoCredit: true,
      privateUnverifiedPendingRejectedGainNoCredit: true,
      explicitCanonicalPolarityScored: true,
      canonicalRowsPreservedOnReplay: true,
    });
  });
  await transaction(async () => {
    await client.query("ALTER TABLE recommendations DROP COLUMN rating");
    await client.query(migration);
    await verifyRequiredProductionSchema(client);
  });
  proof.push({ schemaPushedTableWithoutLegacyRatingCompatible: true });
  await verifyRequiredProductionSchema(client);
  console.log(JSON.stringify({ database: target.database, proof }, null, 2));
} finally {
  await client.end();
}
