import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ImportModeSelector from "@/components/ImportModeSelector";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <ImportModeSelector />
  </>,
);
