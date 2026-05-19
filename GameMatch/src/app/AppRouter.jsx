import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { LoaderScreen } from "../components/shared/LoaderScreen";
import { useAppContext } from "./AppProvider";
import { AuthPage } from "../pages/AuthPage";
import { DiscoverPage } from "../pages/DiscoverPage";
import { LikedPage } from "../pages/LikedPage";
import { MatchesPage } from "../pages/MatchesPage";
import { RoomsPage } from "../pages/RoomsPage";

function RequireAuth({ children }) {
  const { authReady, user } = useAppContext();
  const location = useLocation();

  if (!authReady) {
    return <LoaderScreen label="Carregando sua arena..." />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate replace to={`/auth?redirect=${redirect}`} />;
  }

  return <AppShell>{children}</AppShell>;
}

function RedirectIfAuthenticated() {
  const { authReady, user } = useAppContext();
  const location = useLocation();

  if (!authReady) {
    return <LoaderScreen label="Conectando com sua conta..." />;
  }

  if (user) {
    const redirect = new URLSearchParams(location.search).get("redirect");
    return <Navigate replace to={redirect && redirect.startsWith("/") ? redirect : "/discover"} />;
  }

  return <AuthPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<RedirectIfAuthenticated />} />
      <Route
        path="/discover"
        element={
          <RequireAuth>
            <DiscoverPage />
          </RequireAuth>
        }
      />
      <Route
        path="/liked"
        element={
          <RequireAuth>
            <LikedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/matches"
        element={
          <RequireAuth>
            <MatchesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rooms"
        element={
          <RequireAuth>
            <RoomsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <RequireAuth>
            <RoomsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate replace to="/discover" />} />
    </Routes>
  );
}
