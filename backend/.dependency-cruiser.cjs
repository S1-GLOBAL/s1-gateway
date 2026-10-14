/**
 * The dependency rule, enforced (ADR 0003, ADR 0004).
 *
 * Layers: domain ← application ← infrastructure / presentation. `$1` in a
 * `to` pattern refers to the group captured by the rule's `from.path`, so
 * "its own module" means the same module the importing file lives in.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'Domain imports only its own domain and shared/domain — no package, no Node built-in.',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'application-depends-only-inward',
      comment: 'Application imports only domain and application code — no package, no Node built-in.',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/application/' },
      to: { pathNot: ['^src/$1/(domain|application)/', '^src/shared/(domain|application)/'] },
    },
    {
      name: 'infrastructure-not-to-presentation',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/infrastructure/' },
      to: { path: '^src/(modules/[^/]+|shared)/presentation/' },
    },
    {
      name: 'presentation-not-to-infrastructure',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/presentation/' },
      to: { path: '^src/(modules/[^/]+|shared)/infrastructure/' },
    },
    {
      name: 'modules-meet-only-at-index',
      comment: 'Another module is reached through its index.ts, never its internals.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'shared-knows-no-module',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(modules/|main\\.ts|compose\\.ts|database-schema\\.ts)' },
    },
    {
      name: 'contracts-are-self-contained',
      comment: 'Contracts are types only and import nothing but each other.',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { pathNot: '^src/contracts/' },
    },
    {
      name: 'contracts-only-in-presentation',
      severity: 'error',
      from: { pathNot: ['^src/(modules/[^/]+|shared)/presentation/', '^src/contracts/'] },
      to: { path: '^src/contracts/' },
    },
    {
      name: 'only-layer-folders',
      comment:
        'Code in a module or in shared/ lives in one of the four layers (or a module index.ts). '
        + 'A folder outside them would be outside every rule above.',
      severity: 'error',
      from: {},
      to: {
        path: '^src/(modules/[^/]+|shared)/',
        pathNot: [
          '^src/(modules/[^/]+|shared)/(domain|application|infrastructure|presentation)/',
          '^src/modules/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'only-layer-folders-import',
      comment: 'The same rule from the importing side, so an unimported stray file is caught too.',
      severity: 'error',
      from: {
        path: '^src/(modules/[^/]+|shared)/',
        pathNot: [
          '^src/(modules/[^/]+|shared)/(domain|application|infrastructure|presentation)/',
          '^src/modules/[^/]+/index\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'test-doubles-only-in-tests',
      comment: 'Fakes in a testing/ folder are for tests. Production code never imports them.',
      severity: 'error',
      from: { pathNot: '/testing/' },
      to: { path: '/testing/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.ts$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
