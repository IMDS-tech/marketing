# Secret rotation runbook

Server-only secrets include the Supabase service-role/secret key, database password, OAuth client secrets, credential master key, internal service token, AI provider key, Telegram token and webhook signing secret.

## Rules

- Keep values only in managed secret stores.
- Never use `VITE_` for server secrets.
- Never log secrets or decrypted credentials.
- Rotate one family at a time and record actor, time, services and verification.

## Internal service token

Add current plus next token support on receivers, deploy receivers, update callers, verify internal calls, then remove the old token.

## OAuth client secret

Create a secondary provider secret where supported, update Integration Service, verify new OAuth and refresh, then revoke the old secret and monitor authentication errors.

## Credential master key

Production rotation requires key versioning and a resumable audited re-encryption job. Never replace the only key before every credential has been migrated and verified.

## Supabase service key

Rotate in Supabase, update Platform Core, Clients API and Sync Worker atomically, restart, verify Auth Admin invitations and worker writes, then revoke the old key.
