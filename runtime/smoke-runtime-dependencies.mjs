import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { VertexAI } from "@google-cloud/vertexai";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import mime from "mime";
import cron from "node-cron";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pg from "pg";
import { createClient as createRedisClient } from "redis";
import sharp from "sharp";

const require = createRequire(import.meta.url);

assert.equal(typeof express, "function");
assert.equal(typeof cors, "function");
assert.equal(typeof session, "function");
assert.equal(typeof helmet, "function");
assert.equal(typeof passport.initialize, "function");
assert.equal(typeof LocalStrategy, "function");
assert.equal(typeof connectPgSimple, "function");
assert.equal(typeof cron.schedule, "function");
assert.equal(typeof VertexAI, "function");
assert.equal(typeof dotenv.config, "function");
assert.equal(typeof sql, "function");
assert.equal(typeof pg.Pool, "function");
const redisClient = createRedisClient({ url: "redis://127.0.0.1:6379" });
assert.equal(typeof redisClient.connect, "function");
assert.equal(mime.getType("photo.webp"), "image/webp");

const passwordHash = await bcrypt.hash("runtime-smoke", 4);
assert.equal(await bcrypt.compare("runtime-smoke", passwordHash), true);

const image = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 40, g: 80, b: 120, alpha: 1 },
  },
})
  .resize(1, 1)
  .png()
  .toBuffer();
const metadata = await sharp(image).metadata();
assert.equal(metadata.width, 1);
assert.equal(metadata.height, 1);
assert.equal(metadata.format, "png");

const s3 = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: "runtime-smoke", secretAccessKey: "runtime-smoke" },
});
assert.ok(new HeadObjectCommand({ Bucket: "runtime-smoke", Key: "runtime-smoke" }));
s3.destroy();

const drizzleCli = path.join(path.dirname(require.resolve("drizzle-kit")), "bin.cjs");
const drizzleResult = spawnSync(process.execPath, [drizzleCli, "--version"], {
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" },
});
assert.equal(
  drizzleResult.status,
  0,
  `drizzle-kit CLI failed: ${drizzleResult.stderr || drizzleResult.stdout}`,
);

console.log("Runtime dependency smoke passed.");
