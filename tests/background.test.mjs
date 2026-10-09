/**
 * The background assets shipped alongside the bundle, and the script that puts
 * them back.
 *
 * Installing the plugin does not restore the wallpaper: any-background owns
 * `$DSH_HOME/.dsh-any-background-data/` and reads `theme-config.json` plus the
 * image from disk. These checks keep that pair honest — a config that names an
 * image the repository does not carry is a restore that half-works, which is
 * exactly the failure nobody notices until the wallpaper is missing.
 *
 * The script is exercised for real against a scratch `DSH_HOME`, so its copy
 * and backup behaviour is tested rather than described.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const assets = resolve(root, 'background')
const script = resolve(root, 'scripts/restore-background.sh')
const config = JSON.parse(readFileSync(join(assets, 'theme-config.json'), 'utf8'))

/** Image extensions any-background serves as a wallpaper. */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
/** Video extensions any-background serves as a wallpaper. */
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'video']

/** Files present in `background/`, by extension. */
function assetsByExtension() {
  const found = new Map()
  for (const name of readdirSync(assets)) {
    const dot = name.lastIndexOf('.')
    if (dot > 0) found.set(name.slice(dot + 1).toLowerCase(), name)
  }
  return found
}

/**
 * Intrinsic size of a baseline JPEG, read from its start-of-frame marker.
 *
 * `bgState.iw`/`ih` record the size of the image the composition was built
 * against, so comparing them proves the shipped image is the one the shipped
 * config describes — a swapped image with a stale config would render wrong.
 * @param file - absolute path of the JPEG.
 * @returns `{ width, height }`, or undefined when no frame header is found.
 */
function jpegSize(file) {
  const bytes = readFileSync(file)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined
  let index = 2
  while (index + 3 < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1
      continue
    }
    const marker = bytes[index + 1]
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      index += 2
      continue
    }
    const segment = bytes.readUInt16BE(index + 2)
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrameHeader) return { height: bytes.readUInt16BE(index + 5), width: bytes.readUInt16BE(index + 7) }
    index += 2 + segment
  }
  return undefined
}

describe('shipped background assets', () => {
  it('carries a config with the keys the plugin writes', () => {
    assert.equal(typeof config.backgroundType, 'string')
    assert.equal(typeof config.bgState, 'object')
    assert.ok(config.bgState !== null)
    assert.equal(typeof config.rotation, 'object')
  })

  it('carries the wallpaper the config names', () => {
    const extensions = assetsByExtension()
    const expected = config.backgroundType === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS
    const found = expected.map(extension => extensions.get(extension)).filter(Boolean)
    assert.equal(found.length, 1,
      `backgroundType is "${config.backgroundType}", so background/ must carry exactly one of ${expected.join('/')}`)
  })

  it('describes the shipped image with the shipped composition', () => {
    const { bgState, backgroundType } = config
    if (backgroundType !== 'image') return
    const file = join(assets, assetsByExtension().get('jpg') ?? 'wallpaper.jpg')
    const size = jpegSize(file)
    assert.ok(size, 'the shipped wallpaper must be a readable JPEG')
    assert.deepEqual(
      { width: bgState.iw, height: bgState.ih },
      size,
      'bgState records the width/height the composition was built against, so it must match the shipped image',
    )
  })

  it('stays small enough to belong in a git repository', () => {
    for (const name of readdirSync(assets)) {
      const bytes = readFileSync(join(assets, name)).length
      assert.ok(bytes <= 5 * 1024 * 1024, `${name} is ${String(bytes)} bytes; a shared bundle should stay under 5 MiB`)
    }
  })
})

describe('restore-background.sh', () => {
  /** Run the script against a scratch DSH home. */
  function run(dshHome) {
    return execFileSync('/bin/sh', [script], {
      encoding: 'utf8',
      env: { ...process.env, DSH_HOME: dshHome },
    })
  }

  /** A scratch DSH home under the repository's ignored tmp directory. */
  function scratch() {
    const base = resolve(root, 'tmp')
    mkdirSync(base, { recursive: true })
    return mkdtempSync(join(base, 'restore-'))
  }

  it('puts the wallpaper where the plugin reads it', () => {
    const home = scratch()
    run(home)
    const restored = readdirSync(join(home, '.dsh-any-background-data')).sort()
    assert.deepEqual(restored, ['theme-config.json', 'wallpaper.jpg'])
    assert.equal(
      readFileSync(join(home, '.dsh-any-background-data/theme-config.json'), 'utf8'),
      readFileSync(join(assets, 'theme-config.json'), 'utf8'),
    )
  })

  it('keeps the previous files instead of overwriting them', () => {
    const home = scratch()
    run(home)
    const again = run(home)
    const restored = readdirSync(join(home, '.dsh-any-background-data')).sort()
    assert.equal(restored.filter(name => name.includes('.bak.')).length, 2,
      'a second run must keep both previous files aside')
    assert.match(again, /kept the previous theme-config\.json/)
  })

  it('targets the directory name the plugin uses', () => {
    // The name is the plugin's own constant; a rename here would restore into
    // a directory nothing reads.
    assert.match(readFileSync(script, 'utf8'), /\.dsh-any-background-data/)
  })

  it('stays executable in the repository', () => {
    // A clone runs it directly (`./scripts/restore-background.sh`). An install
    // through pnpm does not: packing normalises the mode to 644, which is why
    // the documented command is `sh <script>`.
    assert.ok(statSync(script).mode & 0o111, 'the script must keep its executable bit in git')
  })

  it('resolves $DSH_HOME the way the host does', () => {
    const home = scratch()
    const restore = (dshHome) => execFileSync('/bin/sh', [script], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, DSH_HOME: dshHome },
    })

    // A blank override counts as unset, as it does in resolveDshHome.
    restore('   ')
    assert.deepEqual(
      readdirSync(join(home, '.dsh', '.dsh-any-background-data')).sort(),
      ['theme-config.json', 'wallpaper.jpg'],
    )

    // A leading ~/ expands against $HOME rather than creating a literal "~".
    restore('~/scratch')
    assert.deepEqual(
      readdirSync(join(home, 'scratch', '.dsh-any-background-data')).sort(),
      ['theme-config.json', 'wallpaper.jpg'],
    )
  })
})
