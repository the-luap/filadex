import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import ChangePasswordPage from "@/pages/change-password";
import PublicFilamentsPage from "@/pages/public-filaments";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/i18n/LanguageProvider";

// Initialize theme from localStorage on page load
const initializeTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
  }
};

// Execute immediately
initializeTheme();

// Protected route component
function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: {
  component: React.ComponentType<any>,
  adminOnly?: boolean,
  [key: string]: any
}) {
  const { isAuthenticated, isAdmin, isPublicRoute } = useAuth();
  const [location, navigate] = useLocation();

  // Reduce console logging to avoid cluttering the console
  const isCurrentRoutePublic = isPublicRoute(location);

  useEffect(() => {
    // Only log for non-public routes
    if (!isCurrentRoutePublic) {
      console.log("ProtectedRoute - Auth state:", { isAuthenticated, isAdmin, location });
    }

    if (!isAuthenticated) {
      // Only log for non-public routes
      if (!isCurrentRoutePublic) {
        console.log("Not authenticated, redirecting to login");
      }
      navigate("/login");
    } else if (adminOnly && !isAdmin) {
      console.log("Not admin, redirecting to home");
      navigate("/");
    }
  }, [isAuthenticated, isAdmin, navigate, adminOnly, location, isCurrentRoutePublic]);

  if (!isAuthenticated) {
    // Don't log for public routes
    if (!isCurrentRoutePublic) {
      console.log("Not authenticated, rendering null");
    }
    return null;
  }

  if (adminOnly && !isAdmin) {
    console.log("Not admin, rendering null");
    return null;
  }

  // Only log for non-public routes
  if (!isCurrentRoutePublic) {
    console.log("Rendering protected component");
  }
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/change-password">
        <ProtectedRoute component={ChangePasswordPage} />
      </Route>
      <Route path="/public/filaments/:userId" component={PublicFilamentsPage} />
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router />
        <Toaster />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
