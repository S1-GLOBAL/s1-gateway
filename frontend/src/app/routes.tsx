import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AccountsPageSkeleton } from '@/pages/accounts/AccountsPageSkeleton';
import { AuthPageSkeleton } from '@/pages/auth/AuthPageSkeleton';
import { ThemePageSkeleton } from '@/pages/theme/ThemePageSkeleton';
import { AppShell } from './shell/AppShell';
import { RequireAuth } from './shell/RequireAuth';
import { RouteBoundary } from './shell/RouteBoundary';

// Each page is its own chunk. Its skeleton is not: it must be ready the
// moment the page is not (ADR 0013).
const ThemePage = lazy(() => import('@/pages/theme/ThemePage').then((module) => ({ default: module.ThemePage })));
const AccountsPage = lazy(() =>
  import('@/pages/accounts/AccountsPage').then((module) => ({ default: module.AccountsPage })),
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
      { index: true, element: <Navigate to="/theme" replace /> },
      {
        path: 'theme',
        element: (
          <RouteBoundary skeleton={<ThemePageSkeleton />}>
            <ThemePage />
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