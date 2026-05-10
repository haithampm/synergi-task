import { createRoot } from "react-dom/client";
import { installSupabaseEgressGuard } from "./integrations/supabase/egress-guard";
import App from "./App.tsx";
import "./index.css";

installSupabaseEgressGuard();

createRoot(document.getElementById("root")!).render(<App />);
