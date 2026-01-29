#!/bin/bash
# Deploy to Vercel from latest commit
echo "Deploying from commit: $(git rev-parse HEAD)"
echo "Commit message: $(git log -1 --pretty=%B)"
npx vercel --prod --yes
