# Ashbi Local CI validation

Pull requests are validated by the isolated, VPS-hosted `Ashbi Local CI`
GitHub App. The repository profile is keyed by the immutable GitHub repository
ID and validates the exact pull-request head in a fresh rootless container.

The profile installs the root and `server/` lockfiles with lifecycle scripts
disabled, then explicitly rebuilds only the locked `better-sqlite3` native
dependency without network access. Lint, TypeScript compilation, the production
Vite/service-worker build, and the complete unit/server-integration suite run
offline. Validation jobs have no deployment credentials, production volumes,
container socket, or permission to publish, migrate, seed, or deploy.

The required check must pass on the current head before merge. A failed check
is evidence to fix the repository or its reviewed validator profile; it must
not be bypassed with a stale result from an earlier commit.
