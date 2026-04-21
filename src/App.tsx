import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useUserAccounts, useWorkspaceSettings } from "@/hooks/useProjects";
import { useWorkspaceProfileLink } from "@/hooks/useWorkspaceProfileLink";

const CommandPalette = lazy(() => import("@/components/CommandPalette").then((module) => ({ default: module.CommandPalette })));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Team = lazy(() => import("./pages/Team"));
const TeamChatPage = lazy(() => import("./pages/TeamChat"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const DocumentsPage = lazy(() => import("./pages/Documents"));
const ResourcesPage = lazy(() => import("./pages/Resources"));
const AiChat = lazy(() => import("./pages/AiChat"));
const Reports = lazy(() => import("./pages/Reports"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Settings = lazy(() => import("./pages/Settings"));
const UserAccounts = lazy(() => import("./pages/UserAccounts"));
const Profile = lazy(() => import("./pages/Profile"));
const StickyNotesPage = lazy(() => import("./pages/StickyNotes"));
const ImportExport = lazy(() => import("./pages/ImportExport"));
const Schedule = lazy(() => import("./pages/Schedule"));
const AppMonitor = lazy(() => import("./pages/AppMonitor"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoutes() {
  const { user, loading, signOut } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const { data: userAccounts = [] } = useUserAccounts();
  useWorkspaceProfileLink(user);

  if (loading) {
    return <AppLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const matchedAccount = userAccounts.find(
    (acc) => acc.email.trim().toLowerCase() === user.email?.trim().toLowerCase()
  );

  if (matchedAccount?.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-3xl border bg-card p-8 text-center space-y-4 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Access Restricted</p>
          <h1 className="text-2xl font-semibold">This user account is suspended</h1>
          <p className="text-sm text-muted-foreground">
            The administrator has suspended access for <span className="font-medium text-foreground">{matchedAccount.email}</span>.
            Contact your workspace admin to reactivate the profile.
          </p>
          <Button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              void signOut();
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/team" element={<Team />} />
          <Route path="/team-chat" element={<TeamChatPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/ai-chat" element={<AiChat />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/user-accounts" element={<UserAccounts />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/sticky-notes" element={<StickyNotesPage />} />
          <Route path="/import-export" element={<ImportExport />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/app-monitor" element={<AppMonitor />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<AppLoader />}>
      <Auth />
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="*" element={<ProtectedRoutes />} />
          </Routes>
          <Sonner position="top-right" expand={true} richColors />
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
