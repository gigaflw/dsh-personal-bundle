/**
 * The composition contract: what the profile composer and the plugin manager
 * read out of this package, checked as data.
 *
 * These assertions cover the failure modes that are otherwise silent — a row
 * whose package is not declared as a dependency (dead row at boot), two rows
 * sharing an id (the loader refuses the whole tree), a floating dependency
 * spec (a different install tomorrow), and package metadata the manager reads
 * through `exports`, which a git install delivers only when `files` lists it.
 */
import { readFileSync, statSync } from 'node:fs'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { schema } from './lib/patch-yaml.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

/** Parse this package's declared patch file. */
function patch() {
  return load(readFileSync(resolve(root, manifest.dsh.bundle.patch), 'utf8'), { schema })
}

/** Wrap a resource specifier the way the plugin manager resolves it. */
function selfResolve(specifier) {
  try {
    return fileURLToPath(import.meta.resolve(specifier))
  } catch (error) {
    assert.fail(`the package must export ${specifier} (${String(error)})`)
  }
}

describe('bundle manifest', () => {
  it('declares its patch file and that file parses to one insert list', () => {
    const patches = patch()
    assert.equal(patches.length, 1, 'the patch must be a single entry: one insert list, no id-targeted overrides')
    const [entry] = patches
    assert.ok(Array.isArray(entry.insert), 'the single patch entry must be an insert list')
    assert.equal(entry.id, undefined, 'an insert list must not be id-targeted; it needs no existing row')
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['insert'],
      'the insert list must carry no overrides of its own',
    )
  })

  it('inserts unique row ids', () => {
    const ids = patch()[0].insert.map(row => row.id)
    assert.deepEqual([...new Set(ids)], ids, 'duplicate row ids make the loader refuse the whole tree')
  })

  it('inserts exactly the packages it depends on', () => {
    const names = patch()[0].insert.map(row => row.name).sort()
    assert.deepEqual(names, Object.keys(manifest.dependencies).sort(),
      'a row whose package is not a dependency cannot resolve, and an undeclared dependency would stay unmounted')
  })

  it('inserts the wallpaper row first', () => {
    // The wallpaper layer paints everything else; the sidebar guard in the
    // next row is also order-sensitive, since it only sees earlier entries.
    assert.equal(patch()[0].insert[0].id, 'dsh-any-background')
  })

  it('engines accept the DSH 0.2 line with an open upper bound', () => {
    // A pinned upper bound makes every host upgrade reject the install.
    assert.equal(manifest.dsh.engines.dsh, '>=0.2.0-rc.2')
  })
})

describe('rows resolve against the installed packages', () => {
  it('finds every inserted name in the installed node_modules', () => {
    for (const { name } of patch()[0].insert) {
      // The loader resolves a row name from the profile's node_modules, so the
      // package has to be installed there — which is what the dependency
      // declaration above provides. The proxy manifest is what a git install
      // delivers for the two commit-pinned packages.
      const installed = resolve(root, 'node_modules', name, 'package.json')
      assert.doesNotThrow(() => statSync(installed), `${name} must be installed (run pnpm install)`)
    }
  })
})

describe('metadata the plugin manager reads', () => {
  it('exports the resources the manager resolves', () => {
    assert.ok(selfResolve('dsh-personal-bundle/package.json').endsWith('package.json'))
    assert.ok(selfResolve('dsh-personal-bundle/cordis.patch.yml').endsWith('cordis.patch.yml'))
    assert.ok(selfResolve('dsh-personal-bundle/locale/en.json').endsWith('en.json'))
  })

  it('carries a relative, small SVG icon', () => {
    const icon = manifest.icon
    assert.equal(typeof icon, 'string')
    assert.ok(!icon.startsWith('/') && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(icon), 'the icon must be a relative path')
    assert.ok(icon.endsWith('.svg'), 'the icon must be SVG, PNG, JPEG, or WebP')
    const file = resolve(root, icon)
    assert.ok(statSync(file).isFile())
    assert.ok(statSync(file).size <= 256 * 1024, 'the manager rejects an icon over 256 KiB')
  })

  it('localizes the card title and description', () => {
    for (const language of ['en', 'zh']) {
      const file = resolve(root, 'locale', `${language}.json`)
      const { meta } = JSON.parse(readFileSync(file, 'utf8'))
      assert.equal(typeof meta.title, 'string')
      assert.ok(meta.title.trim() !== '')
      assert.equal(typeof meta.description, 'string')
      assert.ok(meta.description.trim() !== '')
    }
  })

  it('ships every file a git install needs', () => {
    // pnpm delivers only git-tracked files, then filters by `files`; a missing
    // entry is silent and the installed bundle is unusable.
    assert.deepEqual(
      [...manifest.files].sort(),
      ['background/*', 'cordis.patch.yml', 'icon.svg', 'index.js', 'locale/*.json', 'scripts/*.sh'],
    )
    for (const file of ['cordis.patch.yml', 'icon.svg', 'index.js']) {
      assert.ok(statSync(resolve(root, file)).isFile(), `${file} must exist to be shipped`)
    }
    // The wallpaper and its restore script travel inside the package: an
    // install through the plugin manager never clones the repository, so
    // anything left outside `files` simply is not there on the new machine.
    assert.ok(statSync(resolve(root, 'background/theme-config.json')).isFile())
    assert.ok(statSync(resolve(root, 'background/wallpaper.jpg')).isFile())
    assert.ok(statSync(resolve(root, 'scripts/restore-background.sh')).isFile())
  })
})
