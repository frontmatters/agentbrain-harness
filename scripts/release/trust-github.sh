#!/usr/bin/env bash
# Configure GitHub Actions as the trusted publisher for every published
# @agentbrain-harness package, so the Release (abh) workflow publishes to npm
# over OIDC without a long-lived token (see .github/workflows/release.yml).
#
# Run once as an org owner with account-level 2FA enabled; npm challenges 2FA on
# the first call. It is idempotent: npm keeps one trusted-publisher config per
# package, so re-running updates each in place. The package set is the scope's
# published packages, which is exactly the set release:publish writes.
#
# The trust config pins three claims that the workflow's OIDC token must match:
# the repository, the workflow filename, and the deployment environment. A
# publish from any other repo, workflow, or environment is rejected.
#
# npm requires account-level 2FA for each trust write. Pass a fresh TOTP code in
# TRUST_OTP; npm opens a short auth window after the first accepted code, which
# usually carries the rest of the loop. If a later call fails on 2FA, re-run with
# a new TRUST_OTP: the loop is idempotent, so already-configured packages simply
# get rewritten with the same config.
#
# Overridable via env: TRUST_REPO, TRUST_WORKFLOW, TRUST_ENV, TRUST_SCOPE, TRUST_OTP.
set -euo pipefail

REPO="${TRUST_REPO:-frontmatters/agentbrain-harness}"
WORKFLOW="${TRUST_WORKFLOW:-release.yml}"
ENVIRONMENT="${TRUST_ENV:-npm-publish}"
SCOPE="${TRUST_SCOPE:-@agentbrain-harness}"
OTP="${TRUST_OTP:-}"

command -v npm >/dev/null || { echo "npm not on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq not on PATH" >&2; exit 1; }

mapfile -t packages < <(npm access list packages "$SCOPE" --json | jq -r 'keys[]' | sort)
if [ "${#packages[@]}" -eq 0 ]; then
  echo "No published packages found under $SCOPE (are you logged in as an org member?)" >&2
  exit 1
fi

echo "Configuring trusted publisher on ${#packages[@]} package(s)"
echo "  repo=$REPO workflow=$WORKFLOW env=$ENVIRONMENT"

otp_args=()
[ -n "$OTP" ] && otp_args=(--otp "$OTP")

ok=0
fail=0
for pkg in "${packages[@]}"; do
  if npm trust github "$pkg" \
      --file "$WORKFLOW" \
      --repo "$REPO" \
      --env "$ENVIRONMENT" \
      "${otp_args[@]}" \
      --yes >/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "FAIL: $pkg" >&2
  fi
done

echo "TRUSTED ok=$ok fail=$fail"
[ "$fail" -eq 0 ]
