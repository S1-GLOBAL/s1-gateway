import { lazy } from 'react';
import { type RouteObject } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AccountsPageSkeleton } from '@/pages/accounts/AccountsPageSkeleton';
import { AtlasPageSkeleton } from '@/pages/atlas/AtlasPageSkeleton';
import { NewSpecIdPageSkeleton } from '@/pages/atlas/NewSpecIdPageSkeleton';
import { SpecIdPageSkeleton } from '@/pages/atlas/SpecIdPageSkeleton';
import { AuthPageSkeleton } from '@/pages/auth/AuthPageSkeleton';
import { LandingPageSkeleton } from '@/pages/landing/LandingPageSkeleton';
import { ThemePageSkeleton } from '@/pages/theme/ThemePageSkeleton';
import { AppShell } from './shell/AppShell';
import { RequireAuth } from './shell/RequireAuth';
import { RouteBoundary } from './shell/RouteBoundary';

// Each page is its own chunk. Its skeleton is not: it must be ready the
// moment the page is not (ADR 0013).
const ThemePage = lazy(() => import('@/pages/theme/ThemePage').then((module) => ({ default: module.ThemePage })));
const AtlasPage = lazy(() => import('@/pages/atlas/AtlasPage').then((module) => ({ default: module.AtlasPage })));
const NewSpecIdPage = lazy(() =>
  import('@/pages/atlas/NewSpecIdPage').then((module) => ({ default: module.NewSpecIdPage })),
);
const SpecIdPage = lazy(() => import('@/pages/atlas/SpecIdPage').then((module) => ({ default: module.SpecIdPage })));
const AccountsPage = lazy(() =>
  import('@/pages/accounts/AccountsPage').then((module) => ({ default: module.AccountsPage })),
);
const LandingPage = lazy(() =>
  import('@/pages/landing/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const SignInPage = lazy(() => import('@/pages/auth/SignInPage').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage').then((module) => ({ default: module.SignUpPage })));
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
);
const ChangePasswordPage = lazy(() =>
  import('@/pages/auth/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage })),
);

export const routes: RouteObject[] = [
  // Outside the shell: bare layout, no navigation.
  {
    path: '/',
    element: (
      <RouteBoundary skeleton={<LandingPageSkeleton />}>
        <LandingPage />
      </RouteBoundary>
    ),
  },
  {
    path: 'sign-in',
    element: (
      <RouteBoundary skeleton={<AuthPageSkeleton />}>
        <SignInPage />
      </RouteBoundary>
    ),
  },
  {
    path: 'sign-up',
    element: (
      <RouteBoundary skeleton={<AuthPageSkeleton />}>
        <SignUpPage />
      </RouteBoundary>
    ),
  },
  {
    path: 'reset-password',
    element: (
      <RouteBoundary skeleton={<AuthPageSkeleton />}>
        <ResetPasswordPage />
      </RouteBoundary>
    ),
  },
  {
    path: 'change-password',
    element: (
      <RequireAuth allowMustChangePassword>
        <RouteBoundary skeleton={<AuthPageSkeleton />}>
          <ChangePasswordPage />
        </RouteBoundary>
      </RequireAuth>
    ),
  },
  // Inside the shell: signed in only.
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        path: 'theme',
        element: (
          <RouteBoundary skeleton={<ThemePageSkeleton />}>
            <ThemePage />
          </RouteBoundary>
        ),
      },
      {
        path: 'atlas',
        element: (
          <RouteBoundary skeleton={<AtlasPageSkeleton />}>
            <AtlasPage />
          </RouteBoundary>
        ),
      },
      // A static segment outranks `:id`, so `new` is never read as an id.
      {
        path: 'atlas/new',
        element: (
          <RouteBoundary skeleton={<NewSpecIdPageSkeleton />}>
            <NewSpecIdPage />
          </RouteBoundary>
        ),
      },
      {
        path: 'atlas/:id',
        element: (
          <RouteBoundary skeleton={<SpecIdPageSkeleton />}>
            <SpecIdPage />
          </RouteBoundary>
        ),
      },
      {
        path: 'accounts',
        element: (
          <RouteBoundary skeleton={<AccountsPageSkeleton />}>
            <AccountsPage />
          </RouteBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
