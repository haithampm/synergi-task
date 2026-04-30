import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ImportModeSelector from "@/components/ImportModeSelector";
import ImplementationActivitiesMatrix from "@/components/ImplementationActivitiesMatrix";
import DynamicProjectLifecycleMatrix from "@/components/projects/DynamicProjectLifecycleMatrix";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <ImportModeSelector />
    <ImplementationActivitiesMatrix />
    <DynamicProjectLifecycleMatrix />
  </>,
);
