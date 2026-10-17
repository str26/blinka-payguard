#!/usr/bin/env bash
set -euo pipefail
commit_paths() {
  local message="$1"; shift
  git add -- "$@"
  if ! git diff --cached --quiet -- "$@"; then
    git commit --only -m "$message" -- "$@"
  fi
}
commit_paths "feat(i18n): add persistent Spanish and English locale selection" \
 src/lib/i18n/en.json src/lib/i18n/translate.ts src/lib/i18n/provider.tsx src/lib/i18n/server.ts \
 src/components/language-control.tsx src/app/layout.tsx src/app/globals.css
commit_paths "feat(i18n): localize public pages and financial dashboard" \
 src/app/page.tsx src/app/login/page.tsx src/app/login/login-form.tsx \
 src/app/dashboard/page.tsx src/app/invoices/page.tsx \
 src/components/app-shell.tsx src/components/brand.tsx src/components/theme-control.tsx \
 src/components/dashboard-view.tsx src/components/invoice-table.tsx
commit_paths "feat(i18n): localize invoice decisions approvals and refunds" \
 'src/app/invoices/[id]/page.tsx' 'src/app/invoices/[id]/agent-panel.tsx' \
 'src/app/invoices/[id]/decision-panel.tsx' 'src/app/invoices/[id]/financial-actions.tsx' \
 'src/app/invoices/[id]/review-form.tsx' 'src/app/invoices/[id]/refund-form.tsx' \
 'src/app/invoices/[id]/retry-button.tsx' 'src/app/invoices/[id]/retry-button.module.css' \
 src/app/invoices/upload-form.tsx
commit_paths "test(i18n): verify bilingual payment messages and locale persistence" \
 tests/i18n.test.mjs tests/i18n-components.test.mjs tests/i18n-preference.test.mjs \
 tests/retry-button-render.test.mjs docs/i18n-010-setup.md scripts/commit-i18n.sh
