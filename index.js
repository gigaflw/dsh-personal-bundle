/**
 * dsh-personal-bundle — composition bundle for a DSH desktop profile.
 *
 * The package's substance is `cordis.patch.yml`, declared by the
 * `dsh.bundle.patch` manifest field and resolved by the profile composer.
 * A bundle is not a plugin row, so this module carries no runtime API; it
 * exists only because a package needs an entry point, and it is written by
 * hand rather than built so that a git install cannot deliver a bundle whose
 * artifacts were never compiled (`lib/` output must otherwise be committed).
 * @module dsh-personal-bundle
 */

export {}
