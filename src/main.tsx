import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ImportModeSelector from "@/components/ImportModeSelector";
import ImplementationActivitiesMatrix from "@/components/ImplementationActivitiesMatrix";
import ProjectOwnerTaskPanel from "@/components/projects/ProjectOwnerTaskPanel";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <ImportModeSelector />
    <ImplementationActivitiesMatrix />
    <ProjectOwnerTaskPanel />
  </>,
);
