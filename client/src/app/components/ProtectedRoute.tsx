import { Navigate, Outlet } from "react-router";
import { useMe } from "../../hooks/useMe";

/**
 * Wraps routes that require authentication.
 *
 * - No access token → redirect to /login
 * - Token present but /me still loading → render nothing (avoids flicker)
 * - Otherwise → render child routes
 */
export const ProtectedRoute = () => {
  const hasToken = !!localStorage.getItem("access_token");
  const { data: user, isLoading } = useMe();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return null;
  }

  return <Outlet />;
};
