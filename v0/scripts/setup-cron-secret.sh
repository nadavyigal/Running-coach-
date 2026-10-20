#!/bin/bash
# Setup CRON_SECRET for Vercel Cron Jobs
# Usage: ./scripts/setup-cron-secret.sh

# Generate a secure random secret (32 characters)
CRON_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

echo "Generated CRON_SECRET: $CRON_SECRET"
echo ""
echo "Adding to Vercel (production)..."

# Add to Vercel (requires Vercel CLI: npm i -g vercel)
vercel env add CRON_SECRET production <<< "$CRON_SECRET"

echo ""
echo "✅ CRON_SECRET configured!"
echo ""
echo "Save this secret for manual testing:"
echo "export CRON_SECRET=$CRON_SECRET"
echo ""
echo "Note: /api/cron/email-sequences is disabled (2026-10-20) and returns 503"
echo "email_sequences_disabled for every request, so there is no endpoint to test here."
