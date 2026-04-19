import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useUserAccounts, useWorkspaceSettings } from "@/hooks/useProjects";
import { useWorkspaceProfileLink } from "@/hooks/useWorkspaceProfileLink";
import { CommandPalette } from "@/components/CommandPalette";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";
import TeamChatPage from "./pages/TeamChat";
import CalendarPage from "./pages/Calendar";
import DocumentsPage from "./pages/Documents";
import ResourcesPage from "./pages/Resources";
import AiChat from "./pages/AiChat";
import Reports from "./pages/Reports";
import Tickets from "./pages/Tickets";
import Settings from "./pages/Settings";
import ImportExport from "./pages/ImportExport";
import Schedule from "./pages/Schedule";
import Profile from "./pages/Profile";
import StickyNotesPage from "./pages/StickyNotes";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, signOut } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const { data: userAccounts = [] } = useUserAccounts();
  useWorkspaceProfileLink(user);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
  const matchedAccount =
    userAccounts.find((account) => account.id === settings?.currentUser.userAccountId) ??
    userAccounts.find((account) => account.email.trim().toLowerCase() === normalizedEmail);

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
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              void signOut();
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<Dashboard />} />
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
        <Route path="/profile" element={<Profile />} />
        <Route path="/sticky-notes" element={<StickyNotesPage />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
