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
echo "Test endpoint:"
echo "curl -X POST https://your-domain.vercel.app/api/cron/email-sequences \\"
echo "  -H \"Authorization: Bearer $CRON_SECRET\""
