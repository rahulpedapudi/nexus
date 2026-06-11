import { createBrowserRouter, Navigate } from 'react-router';
import { Onboarding } from './pages/Onboarding';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { Integrations } from './pages/Integrations';
import { Memory } from './pages/Memory';
import { Account } from './pages/Account';
import { Layout } from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/onboarding" replace />,
  },
  {
    path: '/onboarding',
    Component: Onboarding,
  },
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/setup',
    Component: Setup,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { path: 'dashboard', Component: Dashboard },
      { path: 'integrations', Component: Integrations },
      { path: 'memory', Component: Memory },
      { path: 'account', Component: Account },
    ],
  },
]);
