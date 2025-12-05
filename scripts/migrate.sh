#!/bin/sh
# Run all pending database migrations (Drizzle ORM)
set -e
npx drizzle-kit migrate:deploy
