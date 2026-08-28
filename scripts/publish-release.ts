/**
 * Publish a clean, validated release snapshot to the public GitHub remote.
 *
 * Development lives on the private `origin` (Gitea) with its full history. The
 * public `github` remote receives only tagged, gate-validated snapshots: one
 * clean commit per version, never the development jungle.
 *
 * The release commit is authored under the project's GitHub noreply identity so
 * no private email is published; `origin` commits keep their own author.
 *
 * Usage:
 *   pnpm run release            validate, then publish v<version> to github
 *   pnpm run release --dry-run  show what would publish, run no gates, push nothing
 *   pnpm run release --skip-gates  publish without re-running gates (use only when
 *                                  the exact tree was already validated)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const GITHUB_REMOTE = 'github'
const RELEASE_BRANCH = 'main'
const GITHUB_REPO = 'frontmatters/agentbrain-harness'
/** Project GitHub identity for public release commits (keeps private email off GitHub). */
const AUTHOR_NAME = 'frontmatters'
const AUTHOR_EMAIL = '196871115+frontmatters@users.noreply.github.com'

/** The gates a tree must pass before it may be published. */
const GATES: readonly (readonly [string, readonly string[]])[] = [
  ['pnpm', ['run', 'lint']],
  ['pnpm', ['run', 'typecheck']],
  ['pnpm', ['run', 'doc-sync']],
  ['pnpm', ['run', 'hygiene']],
  ['pnpm', ['run', 'build']],
  ['pnpm', ['run', 'test:coverage']],
]

const dryRun = process.argv.includes('--dry-run')
const skipGates = process.argv.includes('--skip-gates')

function git(args: readonly string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, { encoding: 'utf8', ...env === undefined ? {} : { env } }).trim()
}
function run(cmd: string, args: readonly string[]): void {
  execFileSync(cmd, args, { stdio: 'inherit' })
}
function fail(message: string): never {
  console.error(`release: ${message}`)
  process.exit(1)
}

// 1. The tree must be clean, so the published snapshot equals a real commit.
if (git(['status', '--porcelain']) !== '') fail('working tree is not clean; commit or stash first')

// 2. Version and tag come from the manifest.
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
const tag = `v${version}`

// 3. Refuse to re-publish an existing version.
if (git(['ls-remote', '--tags', GITHUB_REMOTE]).includes(`refs/tags/${tag}`)) {
  fail(`tag ${tag} is already published on ${GITHUB_REMOTE}; bump the version first`)
}

// 4. Gates: only a validated tree is publishable.
if (skipGates) {
  console.log('release: --skip-gates set; publishing without re-running gates')
} else {
  for (const [cmd, args] of GATES) {
    console.log(`\nrelease gate: ${cmd} ${args.join(' ')}`)
    try { run(cmd, args) } catch { fail(`gate failed: ${cmd} ${args.join(' ')} — not validated, nothing published`) }
  }
}

// 5. Build the release commit: reuse the existing github head when its tree
//    already matches (e.g. a prior snapshot), else append one clean commit.
const tree = git(['rev-parse', 'HEAD^{tree}'])
git(['fetch', GITHUB_REMOTE, '--quiet']) // refresh the github/main tracking ref
let prevMain: string | undefined
try { prevMain = git(['rev-parse', `${GITHUB_REMOTE}/${RELEASE_BRANCH}`]) } catch { prevMain = undefined }
const prevTree = prevMain === undefined ? undefined : git(['rev-parse', `${prevMain}^{tree}`])

let releaseCommit: string
if (prevMain !== undefined && prevTree === tree) {
  releaseCommit = prevMain
} else {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: AUTHOR_NAME, GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: AUTHOR_NAME, GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
  }
  const parent = prevMain === undefined ? [] : ['-p', prevMain]
  releaseCommit = git(['commit-tree', tree, ...parent, '-m', `${tag}\n\nValidated release snapshot of ${version}.`], env)
}

if (dryRun) {
  console.log(`\n[dry-run] would publish ${releaseCommit.slice(0, 10)} as ${GITHUB_REMOTE}/${RELEASE_BRANCH} and tag ${tag}`)
  process.exit(0)
}

// 6. Publish the branch and the tag.
git(['push', GITHUB_REMOTE, `${releaseCommit}:refs/heads/${RELEASE_BRANCH}`])
git(['tag', '-f', tag, releaseCommit])
git(['push', '--force', GITHUB_REMOTE, `refs/tags/${tag}`])

// 7. A GitHub Release makes the tag first-class; a failure here is not fatal.
try {
  run('gh', ['release', 'create', tag, '--repo', GITHUB_REPO, '--title', tag, '--notes', `Validated release snapshot of ${version}.`])
} catch {
  console.warn(`release: pushed ${tag}, but 'gh release create' failed — create the Release in the UI if wanted`)
}

console.log(`\nrelease: published ${tag} (${releaseCommit.slice(0, 10)}) to ${GITHUB_REPO}`)
