import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <LoadingState
        variant="page"
        tips={[
          "Verificando tu sesión...",
          "Preparando tu espacio de trabajo...",
          "Ya casi estamos...",
        ]}
      />
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
