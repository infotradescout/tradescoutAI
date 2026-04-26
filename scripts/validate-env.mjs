import dotenv from "dotenv";
dotenv.config();

const required = ["DATABASE_URL", "SESSION_SECRET"];
const optional = [
  "STRIPE_SECRET_KEY",
  "SENDGRID_API_KEY",
  "SENTRY_DSN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "FACEBOOK_APP_ID",
  "FACEBOOK_APP_SECRET",
  "FACEBOOK_CALLBACK_URL",
  "PUBLIC_WEB_URL",
  "PUBLIC_URL_BASE",
  "APP_URL",
  "APP_BASE_URL",
  "VITE_API_BASE_URL",
  "CORS_ALLOWED_ORIGINS",
  "TRADESCOUT_GOOGLE_MAPS_API_KEY",
  "VITE_GOOGLE_MAPS_MAP_ID",
  "MASTER_ADMIN_EMAIL",
  "MASTER_ADMIN_PASSWORD",
];

let missingRequired = false;
console.log("--- Environment Variable Validation ---");

for (const key of required) {
  if (!process.env[key]) {
    console.error(`FAIL: Required variable ${key} is missing!`);
    missingRequired = true;
  } else {
    console.log(`PASS: Required variable ${key} is set.`);
  }
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`WARN: Optional variable ${key} is missing. Related features will be disabled.`);
  } else {
    console.log(`PASS: Optional variable ${key} is set.`);
  }
}

if (missingRequired) {
  console.error("\nCRITICAL: Missing required environment variables. Application will not start in production.");
  process.exit(1);
} else {
  console.log("\nSUCCESS: All required environment variables are present.");
}
