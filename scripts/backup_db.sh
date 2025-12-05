#!/bin/sh
# Backup Postgres database to /backups
set -e
mkdir -p /backups
pg_dump -U "$POSTGRES_USER" -h "$POSTGRES_HOST" "$POSTGRES_DB" > /backups/backup_$(date +%Y%m%d_%H%M%S).sql
