import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToolsPageSkeleton } from '@/pages/tools/ToolsPageSkeleton';
import { AppShell } from './shell/AppShell';
import { RouteBoundary } from './shell/RouteBoundary';

// Each page is its own chunk. Its skeleton is not: it must be ready the
// moment the page is not (ADR 0013).
const ToolsPage = lazy(() => import('@/pages/tools/ToolsPage').then((module) => ({ default: module.ToolsPage })));

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <RouteBoundary skeleton={<ToolsPageSkeleton />}>
            <ToolsPage />
          </RouteBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
