#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
commit_group() {
  local message="$1"; shift
  git add -- "$@"
  if git diff --cached --quiet -- "$@"; then
    echo "Sin cambios para: $message"
  else
    git commit --only -m "$message" -- "$@"
  fi
}
commit_group "feat(db): add policy-controlled autonomous payment execution" \
 supabase/migrations/202610170007_autonomous_agent.sql supabase/setup/enable_demo_agent.sql supabase/tests/agent_checks.sql
commit_group "feat(agent): orchestrate extraction validation and automatic payment" \
 src/modules/agent/server/process-invoice.ts src/app/api/invoices/route.ts 'src/app/api/invoices/[id]/extract/route.ts' src/modules/invoices/server/gemini.ts
commit_group "feat(agent): show execution traces and human exception handoffs" \
 src/app/dashboard/page.tsx src/app/invoices/page.tsx src/app/invoices/upload-form.tsx \
 'src/app/invoices/[id]/page.tsx' 'src/app/invoices/[id]/agent-panel.tsx' 'src/app/invoices/[id]/financial-actions.tsx' \
 'src/app/invoices/[id]/review-form.tsx' 'src/app/invoices/[id]/retry-button.tsx' src/modules/invoices/domain/review.ts
commit_group "chore(agent): refresh diagnostics and autonomous demo" \
 .gitattributes scripts/check-mvp.mjs supabase/tests/installation_readiness.sql scripts/generate-demo-invoices.py scripts/commit-agent.sh \
 output/pdf/demo-auto-001.pdf output/pdf/demo-approval-001.pdf output/pdf/demo-block-001.pdf examples/demo-invoices.json \
 docs/agent-setup.md docs/demo-runbook.md
