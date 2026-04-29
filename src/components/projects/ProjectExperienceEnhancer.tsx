import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type CachedProject = {
  id: string;
  name: string;
  status?: string;
  department?: string;
  tags?: string[];
};

const workspaceStorageKey = "synergi-workspace-data";

const readCachedProjects = (): CachedProject[] => {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return [];
    const data = JSON.parse(raw) as { projects?: CachedProject[] };
    return Array.isArray(data.projects) ? data.projects.filter((project) => project?.id && project?.name) : [];
  } catch {
    return [];
  }
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const replaceTextNodes = (root: HTMLElement) => {
  const replacements: Record<string, string> = {
    "New Project": "Create Project",
    "Registry": "Function",
    "Project Registry": "Project Function",
    "Delete Project": "Archive / Delete Project",
    "Project archived.": "Project archived.",
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent) {
      Object.entries(replacements).forEach(([from, to]) => {
        if (node.textContent?.includes(from)) {
          node.textContent = node.textContent.replaceAll(from, to);
        }
      });
    }
    node = walker.nextNode();
  }
};

const getLifecycleRows = () => {
  const candidates = Array.from(document.querySelectorAll("tr, [role='row'], .grid > div, .rounded-2xl, .rounded-3xl")) as HTMLElement[];
  return candidates.filter((element) => {
    const text = normalize(element.innerText);
    return text.includes("implementation") || text.includes("planning") || text.includes("closure") || text.includes("activities") || text.includes("leader");
  });
};

const addLifecycleFilters = (projects: CachedProject[]) => {
  if (document.getElementById("project-lifecycle-filter-panel")) return;

  const headings = Array.from(document.querySelectorAll("h1,h2,h3,p,div,span")) as HTMLElement[];
  const heading = headings.find((element) => normalize(element.textContent).includes("implementation lifecycle matrix"));
  if (!heading) return;

  const departments = Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[];
  const statuses = Array.from(new Set(projects.map((project) => project.status).filter(Boolean))) as string[];

  const panel = document.createElement("div");
  panel.id = "project-lifecycle-filter-panel";
  panel.className = "my-3 grid gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm md:grid-cols-4";
  panel.innerHTML = `
    <label class="space-y-1 font-semibold">Project
      <select data-project-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All projects</option>
        ${projects.map((project) => `<option value="${project.id}">${project.name}</option>`).join("")}
      </select>
    </label>
    <label class="space-y-1 font-semibold">Status
      <select data-status-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All statuses</option>
        ${statuses.map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
    </label>
    <label class="space-y-1 font-semibold">Department
      <select data-department-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All departments</option>
        ${departments.map((department) => `<option value="${department}">${department}</option>`).join("")}
      </select>
    </label>
    <button type="button" data-clear-lifecycle-filter class="self-end rounded-xl border bg-background px-3 py-2 text-sm font-bold hover:bg-primary/10">Clear filters</button>
  `;

  const container = heading.closest("div") ?? heading;
  container.insertAdjacentElement("afterend", panel);

  const applyFilters = () => {
    const projectId = (panel.querySelector("[data-project-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const status = (panel.querySelector("[data-status-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const department = (panel.querySelector("[data-department-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const selectedProject = projects.find((project) => project.id === projectId);

    getLifecycleRows().forEach((row) => {
      const text = normalize(row.innerText);
      const matchesProject = projectId === "all" || text.includes(normalize(selectedProject?.name));
      const matchesStatus = status === "all" || text.includes(normalize(status));
      const matchesDepartment = department === "all" || text.includes(normalize(department));
      row.style.display = matchesProject && matchesStatus && matchesDepartment ? "" : "none";
    });
  };

  panel.addEventListener("change", applyFilters);
  panel.querySelector("[data-clear-lifecycle-filter]")?.addEventListener("click", () => {
    panel.querySelectorAll("select").forEach((select) => {
      (select as HTMLSelectElement).value = "all";
    });
    getLifecycleRows().forEach((row) => {
      row.style.display = "";
    });
  });
};

const markProjectNamesClickable = (projects: CachedProject[], navigate: ReturnType<typeof useNavigate>) => {
  const projectByName = new Map(projects.map((project) => [normalize(project.name), project]));
  const nodes = Array.from(document.querySelectorAll("td, th, p, span, h2, h3, button")) as HTMLElement[];

  nodes.forEach((node) => {
    if (node.dataset.projectClickable === "true") return;
    const text = normalize(node.textContent);
    const project = projectByName.get(text);
    if (!project) return;

    node.dataset.projectClickable = "true";
    node.title = "Open project details";
    node.classList.add("cursor-pointer", "text-primary", "hover:underline", "font-semibold");
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigate(`/projects?projectId=${project.id}`);
    });
  });
};

const enhanceDeleteLabels = () => {
  const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
  buttons.forEach((button) => {
    const text = normalize(button.textContent);
    if (button.dataset.projectDeleteEnhanced === "true") return;
    if (!text.includes("delete") && !text.includes("archive")) return;

    button.dataset.projectDeleteEnhanced = "true";
    button.title = "Archive keeps the project recoverable. Permanent delete should be used only when you are sure.";
    if (text.includes("delete") && !text.includes("archive")) {
      button.appendChild(document.createTextNode(" / Archive"));
    }
  });
};

const addArchiveDeleteNote = () => {
  if (document.getElementById("project-delete-policy-note")) return;
  const destructiveButtons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
  const target = destructiveButtons.find((button) => normalize(button.textContent).includes("archive") || normalize(button.textContent).includes("delete"));
  if (!target) return;

  const note = document.createElement("p");
  note.id = "project-delete-policy-note";
  note.className = "mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100";
  note.textContent = "Deletion policy: use Archive to hide a project safely. Permanent delete should be used only when you want to remove it forever.";
  target.insertAdjacentElement("afterend", note);
};

const ProjectExperienceEnhancer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/projects") return undefined;

    let frame = 0;
    const enhance = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const projects = readCachedProjects();
        replaceTextNodes(document.body);
        addLifecycleFilters(projects);
        markProjectNamesClickable(projects, navigate);
        enhanceDeleteLabels();
        addArchiveDeleteNote();
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [location.pathname, navigate]);

  return null;
};

export default ProjectExperienceEnhancer;
