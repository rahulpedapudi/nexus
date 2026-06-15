import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "../../hooks/useMe";

/**
 * Wraps routes that require authentication.
 *
 * - No access token → redirect to /login
 * - Token present but /me still loading → render nothing (avoids flicker)
 * - Setup not complete → redirect to /onboarding
 * - Otherwise → render child routes
 */
export const ProtectedRoute = () => {
  const hasToken = !!localStorage.getItem("access_token");
  const { data: user, isLoading } = useMe();
  const location = useLocation();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return null;
  }

  // If onboarding is not complete, keep them on /onboarding only
  if (user && !user.is_setup_complete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding IS complete and they try to go back to /onboarding, redirect to dashboard
  if (user && user.is_setup_complete && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
