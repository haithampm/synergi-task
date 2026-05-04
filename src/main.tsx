import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ImplementationActivitiesMatrix from "@/components/ImplementationActivitiesMatrix";
import ProjectOwnerTaskPanel from "@/components/projects/ProjectOwnerTaskPanel";
import ProjectTaskBulkActionsPanel from "@/components/projects/ProjectTaskBulkActionsPanel";
import ProjectScheduleImporter from "@/components/schedule/ProjectScheduleImporter";
import PMODeliveryCyclePanel from "@/components/PMODeliveryCyclePanel";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <ImplementationActivitiesMatrix />
    <ProjectOwnerTaskPanel />
    <ProjectTaskBulkActionsPanel />
    <ProjectScheduleImporter />
    <PMODeliveryCyclePanel />
  </>,
);
