// src/components/ProtectedRoute.tsx

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading session...</div>; // Or a spinner component
  }

  if (!user) {
    // User not authenticated, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the child component
  return children;
}

export default ProtectedRoute;
