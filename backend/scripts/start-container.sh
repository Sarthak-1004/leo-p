#!/bin/sh
# Render invokes this file directly, avoiding provider-specific shell quoting.
set -eu
cd /app/backend
npm run db:migrate
npm run db:seed:production
exec node dist/src/server.js
