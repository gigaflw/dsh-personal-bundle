/**
 * Every row in this bundle's patch is a copy of the row its own package
 * inserts from its `cordis.patch.yml`.
 *
 * The loader composes only the layers named in `dsh.profile.bundles`, and it
 * never loads a dependency's own patch transitively: installing these six
 * packages as dependencies places their code in `node_modules` while leaving
 * their patches dead. The rows therefore have to be duplicated here, and this
 * test is what keeps the copy honest — an upstream edit to any row fails this
 * repo's test run instead of silently shipping a stale row.
 *
 * A missing package is a failure rather than a skip: the comparison is the
 * point. `pnpm install` resolves all six from the specs pinned in
 * `package.json`, so a clone without them is an incomplete checkout.
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { load } from 'js-yaml'
import { schema } from './lib/patch-yaml.mjs'
import { context, diffRows, evaluate, fakeLoader } from './lib/patch-compare.mjs'

/** Upstream package name paired with the row id it inserts. */
const MIRRORED = [
  { package: 'dsh-any-background', id: 'dsh-any-background' },
  { package: 'dsh-better-sidebar', id: 'better-sidebar' },
  { package: 'dsh-context', id: 'dsh-context' },
  { package: '@changfenhuang/dsh-annotation', id: 'dsh-annotation' },
  { package: 'dsh-hover-archive', id: 'dsh-hover-archive' },
  { package: '@michengai/dsh-btw', id: 'michengai-btw' },
]

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const patchPath = resolve(root, manifest.dsh.bundle.patch)

/**
 * Locate an installed package's own bundle patch.
 *
 * The dependency may be a git spec, so pnpm materializes it under whichever
 * `node_modules` it chooses; the manifest path is probed directly first, then
 * through Node's resolver, which follows the symlinks pnpm's layouts use.
 * @param packageName - installed package name.
 * @returns absolute path of the package's `cordis.patch.yml`.
 */
function upstreamPatchPath(packageName) {
  const manifestPath = resolve(root, 'node_modules', packageName, 'package.json')
  if (existsSync(manifestPath)) {
    const upstream = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const patch = upstream.dsh?.bundle?.patch
    assert.ok(typeof patch === 'string', `${packageName} declares no dsh.bundle.patch`)
    return resolve(dirname(manifestPath), patch)
  }
  const require = createRequire(import.meta.url)
  try {
    const resolved = require.resolve(`${packageName}/package.json`)
    const upstream = JSON.parse(readFileSync(resolved, 'utf8'))
    const patch = upstream.dsh?.bundle?.patch
    assert.ok(typeof patch === 'string', `${packageName} declares no dsh.bundle.patch`)
    return resolve(dirname(resolved), patch)
  } catch (error) {
    assert.fail(`cannot find ${packageName}; run pnpm install first (${String(error)})`)
  }
}

/** Inserted rows of a patch file, keyed by row id. */
function rowsOf(path) {
  const parsed = load(readFileSync(path, 'utf8'), { schema })
  return new Map(parsed.flatMap(patch => patch.insert ?? []).map(row => [row.id, row]))
}

describe('rows mirrored from the dependency packages', () => {
  const bundleRows = rowsOf(patchPath)

  for (const { package: packageName, id } of MIRRORED) {
    it(`mirrors the upstream "${id}" row of ${packageName}`, () => {
      const upstreamRows = rowsOf(upstreamPatchPath(packageName))
      const upstream = upstreamRows.get(id)
      assert.ok(upstream, `${packageName} must insert a "${id}" row`)
      const bundleRow = bundleRows.get(id)
      assert.ok(bundleRow, `this bundle's patch must insert a "${id}" row`)

      assert.deepEqual(diffRows(upstream, bundleRow, id), [], `the "${id}" row drifted from ${packageName}`)
    })
  }

  it('evaluates every mirrored expression to the same value as upstream', () => {
    const ctx = context()
    for (const { package: packageName, id } of MIRRORED) {
      const upstream = rowsOf(upstreamPatchPath(packageName)).get(id)
      const bundleRow = bundleRows.get(id)
      // Evaluating proves each `!!js` scalar runs with only `ctx` and
      // `process` in scope; comparing the results proves both copies resolve
      // the same way. A row without an expression is a plain plugin row and
      // only has to evaluate at all.
      const expected = evaluate(upstream, ctx)
      const actual = evaluate(bundleRow, ctx)
      assert.equal(actual.id, id)
      assert.deepEqual(actual, expected, `the "${id}" row resolves differently`)
    }
  })

  it('keeps the sidebar self-disable guard working', () => {
    // The one mirrored expression with real logic: back this row off when an
    // earlier enabled entry already mounts dsh-better-sidebar under another id.
    const row = rowsOf(patchPath).get('better-sidebar')
    const guard = row.disabled
    assert.ok(guard, 'the better-sidebar row must keep its disabled guard')

    const standalone = { id: 'better-sidebar', name: 'dsh-better-sidebar' }
    const aggregate = { id: 'web-ui-better-sidebar', name: 'dsh-better-sidebar' }
    const unrelated = { id: 'dsh-context', name: 'dsh-context' }

    const run = entries => evaluate(row, context({ ctx: { loader: fakeLoader(entries) } })).disabled
    assert.equal(run([standalone]), false, 'the row must not disable itself')
    assert.equal(run([unrelated]), false, 'an unrelated entry must not disable the row')
    assert.equal(run([aggregate]), true, 'an earlier aggregate mount must disable the row')
    assert.equal(run([{ ...aggregate, disabled: true }]), false, 'a disabled mount must not disable the row')
  })

  it('declares every mirrored package as a pinned dependency', () => {
    const expectedNames = MIRRORED.map(entry => entry.package).sort()
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), expectedNames,
      'dependencies must be exactly the mirrored packages — a row whose package is missing cannot resolve')
    for (const [name, spec] of Object.entries(manifest.dependencies)) {
      // A floating spec (a range, a branch, a bare repository) would make the
      // same install resolve differently tomorrow. Registry pins are exact
      // versions; git pins are 40-hex commits.
      const exact = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(spec)
      const commit = /^github:[^#]+#[0-9a-f]{40}$/.test(spec)
      assert.ok(exact || commit, `${name} must pin an exact version or commit, got ${JSON.stringify(spec)}`)
    }
  })
})
