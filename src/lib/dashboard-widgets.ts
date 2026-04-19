import { makeId, type WorkspaceDashboardWidget } from "@/lib/workspace-store";

type DashboardWidgetTemplate = Omit<WorkspaceDashboardWidget, "id" | "enabled">;

export const dashboardWidgetCatalog: DashboardWidgetTemplate[] = [
  { key: "portfolioHealth", title: "Portfolio Health", type: "metric", size: "md" },
  { key: "resourceUtilization", title: "Resource Utilization", type: "chart", size: "lg" },
  { key: "workflowSla", title: "Workflow SLA", type: "workflow", size: "md" },
  { key: "riskRadar", title: "Risk Radar", type: "list", size: "md" },
];

export const buildDashboardWidgets = (keys?: string[]) => {
  const templates = keys?.length
    ? dashboardWidgetCatalog.filter((widget) => keys.includes(widget.key))
    : dashboardWidgetCatalog;

  return templates.map((widget) => ({
    ...widget,
    id: makeId("widget"),
    enabled: true,
  })) satisfies WorkspaceDashboardWidget[];
};

