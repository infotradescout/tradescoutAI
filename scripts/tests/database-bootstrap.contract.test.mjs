import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import {
  evaluateRequiredProductionSchema,
  verifyRequiredProductionSchema,
} from "../check-required-production-schema.mjs";
import {
  runVerifiedMigration,
  DATABASE_RECOVERY_GUIDANCE,
} from "../lib/verified-migration-runner.mjs";
import "./release-runtime-chain.test.mjs";

const run = (migrate, verify) => runVerifiedMigration({ migrate, verify, report: () => {} });
test("a successful SQL command is not success when schema verification fails", async () => {
  assert.equal(
    await run(
      async () => 0,
      async () => 1
    ),
    1
  );
});
test("success requires both the SQL command and schema proof, in that order", async () => {
  const calls = [];
  assert.equal(
    await run(
      async () => {
        calls.push("sql");
        return 0;
      },
      async () => {
        calls.push("verify");
        return 0;
      }
    ),
    0
  );
  assert.deepEqual(calls, ["sql", "verify"]);
});
test("failed SQL is neither retried nor baselined, and its exit code is retained", async () => {
  let calls = 0;
  assert.equal(
    await run(
      async () => {
        calls++;
        return 7;
      },
      async () => {
        assert.fail("must not verify failed SQL");
      }
    ),
    7
  );
  assert.equal(calls, 1);
});
test("a thrown SQL error remains a failure", async () => {
  await assert.rejects(
    run(
      async () => {
        throw new Error("synthetic SQL failure");
      },
      async () => 0
    ),
    /synthetic SQL failure/
  );
});
test("a thrown verification error remains a failure", async () => {
  await assert.rejects(
    run(
      async () => 0,
      async () => {
        throw new Error("synthetic verification failure");
      }
    ),
    /synthetic verification failure/
  );
});
test("missing or invalid child-process statuses cannot pass", async () => {
  for (const value of [undefined, null, -1, NaN, "0", 0.5]) {
    await assert.rejects(
      run(
        async () => value,
        async () => 0
      ),
      /valid exit status/
    );
    await assert.rejects(
      run(
        async () => 0,
        async () => value
      ),
      /valid exit status/
    );
  }
});
test("failure guidance separates base prerequisites from current successors", () => {
  for (const text of [
    "users",
    "businesses",
    "user_profiles",
    "profiles",
    "0118_profile_account_public_routes",
    "0129_restore_profile_account_identity_contract",
    "0131_preserve_jw_stone_pricing_revocation",
    "not a complete empty-database bootstrap recipe",
    "LF/CRLF",
  ]) {
    assert.ok(DATABASE_RECOVERY_GUIDANCE.includes(text), text);
  }
  assert.match(
    DATABASE_RECOVERY_GUIDANCE,
    /older backfills can erase current entitlement decisions/
  );
});
test("the retired baseline refuses without attempting a database connection", () => {
  const result = spawnSync(process.execPath, ["scripts/db-baseline-drizzle.mjs"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "not-a-database-url", TEST_DATABASE_URL: "" },
    timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /recording the latest migration without executing it/);
  const source = fs.readFileSync("scripts/db-baseline-drizzle.mjs", "utf8");
  assert.doesNotMatch(source, /new Client|client\.query|from ["']pg["']/);
});
test("the migration runner uses an independent verifier and contains no baseline shortcut", () => {
  const source = fs.readFileSync("scripts/db-migrate-safe.mjs", "utf8");
  assert.match(source, /check-required-production-schema\.mjs/);
  assert.match(source, /DATABASE_URL: dbUrl/);
  assert.doesNotMatch(
    source,
    /baselineEntrypoint|migrationCount|insert into drizzle|Attempting baseline/
  );
});
test("gap recovery rejects the unsafe mark flag and contains no mark-on-error branch", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/db-migrate-fill-gaps.mjs", "--mark-already-applied"],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "not-a-database-url", TEST_DATABASE_URL: "" },
      timeout: 10000,
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /one duplicate object does not prove/);
  assert.doesNotMatch(
    fs.readFileSync("scripts/db-migrate-fill-gaps.mjs", "utf8"),
    /if \(markAlreadyApplied/
  );
});
function schemaVerifierContract(source) {
  const parsed = ts.createSourceFile(
    "verifier.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const functions = parsed.statements.filter(ts.isFunctionDeclaration);
  const evaluator = functions.find(
    (node) => node.name?.text === "evaluateRequiredProductionSchema"
  );
  const verifier = functions.find((node) => node.name?.text === "verifyRequiredProductionSchema");
  assert.ok(
    evaluator && verifier,
    "schema evaluation and SQL execution must remain independently testable"
  );
  const flags = new Set();
  const queries = [];
  const walk = (node, inspect) => {
    inspect(node);
    ts.forEachChild(node, (child) => walk(child, inspect));
  };
  walk(evaluator, (node) => {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(parsed) === "check") {
      flags.add(node.name.text);
    }
  });
  walk(verifier, (node) => {
    if (!ts.isCallExpression(node) || node.expression.getText(parsed) !== "client.query") return;
    const [sql, parameters] = node.arguments;
    assert.ok(
      ts.isStringLiteral(sql) || ts.isNoSubstitutionTemplateLiteral(sql),
      "schema SQL must be static"
    );
    assert.ok(
      !parameters || ts.isArrayLiteralExpression(parameters),
      "schema parameters must be explicit"
    );
    queries.push({
      sql: sql.text,
      parameters: parameters?.elements.map((element) => element.getText(parsed)) || [],
    });
  });
  return {
    flags: [...flags],
    queries,
    evaluate: new Function(
      "return (" + evaluator.getText(parsed).replace(/^export\s+/, "") + ");"
    )(),
  };
}

// This decomposes only the static verifier's WITH/VALUES/SELECT shape. It is not
// a SQL evaluator: predicates are compared token-for-token, including literals.
function sqlTokens(sql) {
  return sql.match(/'(?:''|[^'])*'|"(?:\"\"|[^"])*"|\$\d+|[a-zA-Z_][a-zA-Z_0-9]*|\d+|[^\s]/g) || [];
}

function splitSql(tokens, separator) {
  const parts = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token === separator && depth === 0) parts.push([]);
    else parts.at(-1).push(token);
    if (token === "(" || token === "[") depth++;
    if (token === ")" || token === "]") depth--;
    assert.ok(depth >= 0, "balanced schema SQL");
  }
  assert.equal(depth, 0, "balanced schema SQL");
  return parts;
}

function uniqueSqlMap(entries) {
  const map = new Map(entries);
  assert.equal(map.size, entries.length, "schema SQL names must be unique");
  return map;
}

function decomposeSchemaSql(sql) {
  const selectParts = splitSql(sqlTokens(sql), "select");
  assert.equal(selectParts.length, 2, "one top-level SELECT per schema query");
  const [prefix, projection] = selectParts;
  assert.ok(prefix.length === 0 || prefix[0] === "with", "schema query must remain a SELECT");
  const ctes = uniqueSqlMap(
    prefix.length
      ? splitSql(prefix.slice(1), ",").map((cte) => {
          const [header, wrappedBody, ...extra] = splitSql(cte, "as");
          assert.equal(extra.length, 0);
          assert.equal(wrappedBody[0], "(");
          assert.equal(wrappedBody.at(-1), ")");
          return [header[0], { header, body: wrappedBody.slice(1, -1) }];
        })
      : []
  );
  const projections = uniqueSqlMap(
    splitSql(projection, ",").map((expression) => {
      assert.equal(expression.at(-2), "as", "every schema predicate needs an explicit result name");
      return [expression.at(-1), expression.slice(0, -2)];
    })
  );
  return { ctes, projections };
}

function assertBaselineSqlPreserved(originalQueries, currentQueries) {
  assert.equal(
    currentQueries.length,
    originalQueries.length,
    "all baseline SQL queries must execute"
  );
  for (const [index, originalQuery] of originalQueries.entries()) {
    const currentQuery = currentQueries[index];
    assert.deepEqual(
      currentQuery.parameters.slice(0, originalQuery.parameters.length),
      originalQuery.parameters,
      "query " + index + ": baseline hash and identity parameters must retain their positions"
    );
    const original = decomposeSchemaSql(originalQuery.sql);
    const current = decomposeSchemaSql(currentQuery.sql);
    for (const [name, originalCte] of original.ctes) {
      const currentCte = current.ctes.get(name);
      assert.ok(currentCte, "required CTE " + name);
      assert.deepEqual(
        currentCte.header,
        originalCte.header,
        name + ": unchanged contract columns"
      );
      if (originalCte.body[0] !== "values") {
        assert.deepEqual(
          currentCte.body,
          originalCte.body,
          name + ": every original SQL predicate must remain"
        );
        continue;
      }
      assert.equal(currentCte.body[0], "values");
      const rows = (body) =>
        uniqueSqlMap(
          splitSql(body.slice(1), ",").map((row) => [
            JSON.stringify(splitSql(row.slice(1, -1), ",").slice(0, 2)),
            row,
          ])
        );
      const currentRows = rows(currentCte.body);
      for (const [key, row] of rows(originalCte.body)) {
        assert.deepEqual(
          currentRows.get(key),
          row,
          name + ": preserve baseline requirement " + key
        );
      }
    }
    for (const [name, expression] of original.projections) {
      assert.deepEqual(
        current.projections.get(name),
        expression,
        name + ": preserve the complete baseline predicate"
      );
    }
  }
}

const recoveryFlags = [
  "profileBookingLineageMigrationRecorded",
  "professionalApplicationIntegrityMigrationRecorded",
  "documentStandaloneLineageMigrationRecorded",
  "documentAccountingJobIdInvariantContract",
  "profileBookingRequests",
  "profileBookingRequestsLineageContract",
  "profileBookingRequestsLineageImmutabilityTrigger",
  "profilePublicationAuthorityContract",
  "realtorProfiles",
  "realtorProfilesIntegrityContract",
  "carSalesmanProfiles",
  "carSalesmanProfilesIntegrityContract",
];

test("required-schema additions retain every release-base SQL predicate and required check", () => {
  const original = spawnSync(
    "git",
    [
      "show",
      "908d2d4e2c76141ffe2cdcfa52e756dfb52fae84:scripts/check-required-production-schema.mjs",
    ],
    { encoding: "utf8" }
  );
  assert.equal(original.status, 0, "the release-base verifier must be available for comparison");
  const baseline = schemaVerifierContract(original.stdout);
  const current = schemaVerifierContract(
    fs.readFileSync("scripts/check-required-production-schema.mjs", "utf8")
  );
  assertBaselineSqlPreserved(baseline.queries, current.queries);
  const complete = Object.fromEntries(current.flags.map((flag) => [flag, true]));
  assert.deepEqual(evaluateRequiredProductionSchema(complete), []);
  for (const flag of [...baseline.flags, ...recoveryFlags]) {
    assert.ok(current.flags.includes(flag), "required schema flag " + flag);
    const incomplete = { ...complete, [flag]: false };
    const missing = evaluateRequiredProductionSchema(incomplete);
    assert.ok(missing.length > 0, flag + " must block release");
    for (const requirement of baseline.evaluate(incomplete)) {
      assert.ok(missing.includes(requirement), flag + ": retain " + requirement);
    }
  }
  for (const [before, after] of [
    ["actual.udt_name = any(expected.allowed_udt_names)", "true"],
    ["constraint_record.convalidated", "not constraint_record.convalidated"],
    ["index_record.indisvalid", "true"],
    ["to_regclass('public.ts_publication_rules') is not null", "true"],
  ]) {
    const weakened = current.queries.map((query) => ({
      ...query,
      sql: query.sql.replace(before, after),
    }));
    assert.throws(
      () => assertBaselineSqlPreserved(baseline.queries, weakened),
      assert.AssertionError,
      "the preservation guard must reject removal of " + before
    );
  }
});

test("the executing verifier fails closed on every baseline and recovery SQL result", async () => {
  const source = schemaVerifierContract(
    fs.readFileSync("scripts/check-required-production-schema.mjs", "utf8")
  );
  const aliases = source.queries.flatMap((query) => [
    ...decomposeSchemaSql(query.sql).projections.keys(),
  ]);
  // profiles is a redundant existence probe; profile_publication_authority_contract
  // independently requires its canonical column, and is tested below.
  for (const missingAlias of [null, ...aliases.filter((alias) => alias !== "profiles")]) {
    const client = {
      query: async () => ({
        rows: [Object.fromEntries(aliases.map((alias) => [alias, alias !== missingAlias]))],
      }),
    };
    if (missingAlias === null) await verifyRequiredProductionSchema(client);
    else
      await assert.rejects(
        verifyRequiredProductionSchema(client),
        /Required production schema is missing/,
        missingAlias + " must block release through the real query-to-check mapping"
      );
  }
});
