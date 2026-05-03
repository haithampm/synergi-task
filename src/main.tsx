import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ImplementationActivitiesMatrix from "@/components/ImplementationActivitiesMatrix";
import ProjectOwnerTaskPanel from "@/components/projects/ProjectOwnerTaskPanel";
import PMODeliveryCyclePanel from "@/components/PMODeliveryCyclePanel";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <ImplementationActivitiesMatrix />
    <ProjectOwnerTaskPanel />
    <PMODeliveryCyclePanel />
  </>,
);
