#!/usr/bin/env bash
set -euo pipefail
commit_paths() {
  local message="$1"; shift
  git add -- "$@"
  if ! git diff --cached --quiet -- "$@"; then
    git commit --only -m "$message" -- "$@"
  fi
}
commit_paths "feat(ui): add Blinka branding themes and workspace navigation" \
  public/brand/blinka-light.svg public/brand/blinka-dark.svg public/brand/favicon.svg \
  src/components/brand.tsx src/components/theme-control.tsx src/components/app-shell.tsx \
  src/app/layout.tsx src/app/globals.css src/app/workspace.module.css
commit_paths "feat(ui): redesign landing dashboard and invoice workspace" \
  src/app/page.tsx src/app/login/page.tsx src/app/dashboard/page.tsx src/app/invoices/page.tsx \
  src/components/dashboard-view.tsx src/components/invoice-table.tsx
commit_paths "docs(ui): document visual update and verification limits" \
  docs/visual-update-009.md scripts/commit-visual.sh
