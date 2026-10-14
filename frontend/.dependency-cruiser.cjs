/**
 * The dependency rule, enforced (ADR 0003, ADR 0004). See the backend's copy
 * for how `$1` works. The frontend's application layer may use React and
 * TanStack Query — hooks are how a React app delivers its use cases.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'application-depends-only-inward',
      comment: 'Application may use react and @tanstack/react-query, and nothing else from outside.',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/application/' },
      to: {
        pathNot: [
          '^src/$1/(domain|application)/',
          '^src/shared/(domain|application)/',
          '^node_modules/(react|@tanstack/react-query)/',
        ],
      },
    },
    {
      name: 'infrastructure-not-to-presentation',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: '^src/(features/[^/]+|shared)/(presentation|ui)/' },
    },
    {
      name: 'presentation-not-to-infrastructure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+/presentation|shared/ui)/' },
      to: { path: '(^src/(features/[^/]+|shared)/infrastructure/|^node_modules/axios/)' },
    },
    {
      name: 'contracts-only-in-infrastructure',
      severity: 'error',
      from: { pathNot: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: 'backend/src/contracts/' },
    },
    {
      name: 'shared-ui-is-generic',
      severity: 'error',
      from: { path: '^src/shared/ui/' },
      to: { pathNot: ['^src/shared/ui/', '^node_modules/(react|clsx|tailwind-merge)/'] },
    },
    {
      name: 'features-meet-only-at-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'pages-use-feature-index',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '^src/features/', pathNot: '^src/features/[^/]+/index\\.ts$' },
    },
    {
      name: 'nothing-reaches-up',
      comment: 'shared knows no feature, page or app; features know no page or app.',
      severity: 'error',
      from: { path: '^src/(shared|features)/' },
      to: { path: '^src/(pages|app)/' },
    },
    {
      name: 'shared-knows-no-feature',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'pages-not-to-infrastructure',
      comment: 'Pages compose features. Network and wire-format code stays in infrastructure.',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '(^src/shared/infrastructure/|^node_modules/axios/|backend/src/contracts/)' },
    },
    {
      name: 'only-layer-folders',
      comment:
        'Code in a feature lives in one of the four layers (or its index.ts); shared/ holds only '
        + 'domain, application, infrastructure and ui. A folder outside them would be outside every rule above.',
      severity: 'error',
      from: {},
      to: {
        path: '^src/(features/[^/]+|shared)/',
        pathNot: [
          '^src/features/[^/]+/(domain|application|infrastructure|presentation)/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/shared/(domain|application|infrastructure|ui)/',
        ],
      },
    },
    {
      name: 'only-layer-folders-import',
      comment: 'The same rule from the importing side, so an unimported stray file is caught too.',
      severity: 'error',
      from: {
        path: '^src/(features/[^/]+|shared)/',
        pathNot: [
          '^src/features/[^/]+/(domain|application|infrastructure|presentation)/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/shared/(domain|application|infrastructure|ui)/',
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
      comment: 'virtual: modules come from Vite plugins and have no file.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^virtual:' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'backend/src/contracts'] },
    exclude: { path: ['\\.test\\.tsx?$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'browser', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
