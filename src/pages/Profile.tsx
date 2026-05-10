import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Download, ExternalLink, Filter, Save, Search, Trash2, User } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, useTasks, useTeamMembers, useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings } from "@/hooks/useProjects";
import { getProjectLifecycleActivityTotal, getProjectLifecycleStageCounts, lifecycleStageCatalog, type LifecycleStageKey } from "@/lib/project-activities";
import { resolveProjectLeader } from "@/lib/workspace-access";
import type { WorkspaceProject } from "@/lib/workspace-store";
import { toast } from "sonner";

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
const statusLabel = (value: WorkspaceProject["status"]) => value.replace("-", " ");
const statusBadge: Record<WorkspaceProject["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  "on-hold": "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  completed: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
  "at-risk": "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  archived: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
};

const Profile = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const updateSettings = useUpdateWorkspaceSettings();
  const [draft, setDraft] = useState(settings);
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixDepartment, setMatrixDepartment] = useState("all");
  const [matrixYear, setMatrixYear] = useState("all");
  const [matrixStatus, setMatrixStatus] = useState<"all" | WorkspaceProject["status"]>("all");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const linkedTeamMember = useMemo(() => {
    if (!draft) return undefined;
    return (
      teamMembers.find((member) => member.id === draft.currentUser.teamMemberId) ??
      teamMembers.find((member) => normalizeText(member.email) === normalizeText(draft.profile.email))
    );
  }, [draft, teamMembers]);

  const linkedUserAccount = useMemo(() => {
    if (!draft) return undefined;
    return (
      userAccounts.find((account) => account.id === draft.currentUser.userAccountId) ??
      userAccounts.find((account) => normalizeText(account.email) === normalizeText(draft.profile.email))
    );
  }, [draft, userAccounts]);

  const linkedRole = useMemo(
    () => draft?.privilegeRoles.find((role) => role.id === (linkedUserAccount?.roleId ?? draft.currentUser.roleId)),
    [draft, linkedUserAccount],
  );

  const matrixRows = useMemo(
    () => projects.map((project) => ({
      project,
      leader: resolveProjectLeader(project, teamMembers, userAccounts)?.name ?? "Unassigned",
      stageCounts: getProjectLifecycleStageCounts(project, tasks),
      totalActivities: getProjectLifecycleActivityTotal(project, tasks),
    })),
    [projects, tasks, teamMembers, userAccounts],
  );

  const matrixDepartments = useMemo(
    () => Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[],
    [projects],
  );
  const matrixYears = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => [
      project.start_date ?? project.startDate ?? "",
      project.end_date ?? project.endDate ?? "",
    ].filter(Boolean).map((value) => value.slice(0, 4))))).sort(),
    [projects],
  );

  const filteredMatrixRows = useMemo(() => {
    const search = normalizeText(matrixSearch);
    return matrixRows.filter((row) => {
      const project = row.project;
      const matchesSearch = !search || [
        project.name,
        project.description,
        project.department,
        project.projectNature,
        ...(project.tags ?? []),
        row.leader,
      ].filter(Boolean).some((value) => normalizeText(String(value)).includes(search));
      const matchesDepartment = matrixDepartment === "all" || project.department === matrixDepartment;
      const matchesYear =
        matrixYear === "all" ||
        (project.start_date ?? project.startDate ?? "").startsWith(matrixYear) ||
        (project.end_date ?? project.endDate ?? "").startsWith(matrixYear);
      const matchesStatus = matrixStatus === "all" || project.status === matrixStatus;
      return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
    });
  }, [matrixDepartment, matrixRows, matrixSearch, matrixStatus, matrixYear]);

  if (!draft) return null;

  const saveProfile = async () => {
    const displayName = `${draft.profile.firstName} ${draft.profile.lastName}`.trim() || draft.currentUser.displayName;
    await updateSettings.mutateAsync({
      ...draft,
      currentUser: {
        ...draft.currentUser,
        displayName,
      },
    });
    toast.success("Profile updated");
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => current ? ({
        ...current,
        profile: {
          ...current.profile,
          avatarUrl: typeof reader.result === "string" ? reader.result : current.profile.avatarUrl,
        },
      }) : current);
      toast.success("Profile picture updated");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const openProjectTasks = (projectId: string, stageKey?: LifecycleStageKey) => {
    navigate(stageKey ? `/tasks?projectId=${projectId}&stage=${stageKey}` : `/tasks?projectId=${projectId}`);
  };

  const exportMatrix = () => {
    const header = [
      "Project Name",
      "Department",
      "Leader",
      "Start Date",
      "End Date",
      "Status",
      "Progress",
      "Activities",
      ...lifecycleStageCatalog.map((stage) => stage.label),
    ];
    const csv = [
      header.map(csvCell).join(","),
      ...filteredMatrixRows.map((row) => [
        row.project.name,
        row.project.department ?? "",
        row.leader,
        row.project.start_date ?? row.project.startDate ?? "",
        row.project.end_date ?? row.project.endDate ?? "",
        statusLabel(row.project.status),
        `${row.project.progress ?? 0}%`,
        row.totalActivities,
        ...lifecycleStageCatalog.map((stage) => row.stageCounts[stage.key]),
      ].map(csvCell).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "implementation-lifecycle-matrix.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetMatrixFilters = () => {
    setMatrixSearch("");
    setMatrixDepartment("all");
    setMatrixYear("all");
    setMatrixStatus("all");
  };

  const initials = `${draft.profile.firstName?.[0] ?? ""}${draft.profile.lastName?.[0] ?? ""}`.trim() || draft.currentUser.displayName.slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <AppHeader title="My Profile" subtitle="Manage your personal account details, linked workspace access, and portfolio lifecycle view." />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <div className="space-y-6 p-6 animate-fade-in">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="profile">Profile Details</TabsTrigger>
            <TabsTrigger value="lifecycle">Implementation Lifecycle Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <PageSection
              title="Profile Details"
              description="Update your personal information and the profile picture shown across the application."
            />

            <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
              <Card className="glass">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    {draft.profile.avatarUrl ? (
                      <img src={draft.profile.avatarUrl} alt="Profile" className="h-28 w-28 rounded-full object-cover shadow-md" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                        {initials}
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-semibold">{draft.currentUser.displayName}</h2>
                      <p className="text-sm text-muted-foreground">{draft.profile.email}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Badge variant="secondary">{linkedRole?.name ?? draft.currentUser.roleId}</Badge>
                      {linkedTeamMember ? <Badge variant="outline">{linkedTeamMember.role}</Badge> : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full gap-2" variant="outline" onClick={() => fileRef.current?.click()}>
                      <Camera className="h-4 w-4" /> Change Profile Picture
                    </Button>
                    <Button
                      className="w-full gap-2"
                      variant="ghost"
                      onClick={() =>
                        setDraft((current) => current ? ({
                          ...current,
                          profile: { ...current.profile, avatarUrl: "" },
                        }) : current)
                      }
                    >
                      <Trash2 className="h-4 w-4" /> Remove Picture
                    </Button>
                  </div>

                  <div className="rounded-2xl border bg-card/40 p-4">
                    <p className="text-sm font-medium">Linked Access</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>Auth account: {user?.email ?? "No active sign-in"}</p>
                      <p>Managed user: {linkedUserAccount?.fullName ?? "Not linked"}</p>
                      <p>Team profile: {linkedTeamMember?.name ?? "Not linked"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">First Name</Label>
                        <Input
                          className="mt-1"
                          value={draft.profile.firstName}
                          onChange={(event) =>
                            setDraft((current) => current ? ({
                              ...current,
                              profile: { ...current.profile, firstName: event.target.value },
                            }) : current)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Last Name</Label>
                        <Input
                          className="mt-1"
                          value={draft.profile.lastName}
                          onChange={(event) =>
                            setDraft((current) => current ? ({
                              ...current,
                              profile: { ...current.profile, lastName: event.target.value },
                            }) : current)
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">Display Name</Label>
                        <Input
                          className="mt-1"
                          value={draft.currentUser.displayName}
                          onChange={(event) =>
                            setDraft((current) => current ? ({
                              ...current,
                              currentUser: { ...current.currentUser, displayName: event.target.value },
                            }) : current)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input
                          className="mt-1"
                          value={draft.profile.email}
                          onChange={(event) =>
                            setDraft((current) => current ? ({
                              ...current,
                              profile: { ...current.profile, email: event.target.value },
                            }) : current)
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Profile Image URL</Label>
                      <Input
                        className="mt-1"
                        placeholder="https://..."
                        value={draft.profile.avatarUrl ?? ""}
                        onChange={(event) =>
                          setDraft((current) => current ? ({
                            ...current,
                            profile: { ...current.profile, avatarUrl: event.target.value },
                          }) : current)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-base">Account Relationship</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Managed Account</p>
                      <p className="mt-2 font-medium">{linkedUserAccount?.fullName ?? "Not linked"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{linkedUserAccount?.email ?? "No linked managed user"}</p>
                    </div>
                    <div className="rounded-2xl border bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Team Member</p>
                      <p className="mt-2 font-medium">{linkedTeamMember?.name ?? "Not linked"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{linkedTeamMember?.department ?? "No team profile"}</p>
                    </div>
                    <div className="rounded-2xl border bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Permission Role</p>
                      <p className="mt-2 font-medium">{linkedRole?.name ?? draft.currentUser.roleId}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {linkedRole?.permissions.slice(0, 3).join(", ") || "No permissions configured"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button className="gap-2 gradient-primary text-primary-foreground" onClick={saveProfile} disabled={updateSettings.isPending}>
                    <Save className="h-4 w-4" /> Save Profile
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lifecycle" className="space-y-4">
            <PageSection
              title="Implementation Lifecycle Matrix"
              description="Portfolio lifecycle matrix displayed inside the profile page as a full table, not a floating quick-action overlay."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={resetMatrixFilters}>
                    <Filter className="h-4 w-4" /> Reset Filters
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={exportMatrix}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                </div>
              }
            />

            <Card className="glass">
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_150px_190px]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={matrixSearch} onChange={(event) => setMatrixSearch(event.target.value)} placeholder="Search project, department, leader, or tag" className="pl-9" />
                  </label>
                  <select value={matrixDepartment} onChange={(event) => setMatrixDepartment(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="all">All departments</option>
                    {matrixDepartments.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={matrixYear} onChange={(event) => setMatrixYear(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="all">All years</option>
                    {matrixYears.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={matrixStatus} onChange={(event) => setMatrixStatus(event.target.value as "all" | WorkspaceProject["status"])} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="at-risk">At Risk</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="max-h-[68vh] overflow-auto rounded-2xl border">
                  <table className="min-w-[1600px] w-full border-separate border-spacing-0 text-left text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-0 z-20 border-b border-r bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Project</th>
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Owner</th>
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Dates</th>
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Progress</th>
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Total</th>
                        {lifecycleStageCatalog.map((stage) => (
                          <th key={stage.key} className="sticky top-0 z-10 min-w-[110px] border-b bg-background px-2 py-2 text-center font-black uppercase tracking-[0.08em] text-muted-foreground">
                            {stage.label}
                          </th>
                        ))}
                        <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrixRows.map((row) => {
                        const project = row.project;
                        return (
                          <tr key={project.id} className="odd:bg-muted/20 hover:bg-muted/40">
                            <td className="sticky left-0 z-10 max-w-[280px] border-b border-r bg-inherit px-3 py-3 align-top">
                              <div className="font-semibold leading-snug">{project.name}</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">{project.department || "No department"}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(project.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                              </div>
                            </td>
                            <td className="border-b px-3 py-3 align-top">
                              <div className="font-medium">{row.leader}</div>
                              <div className="text-[11px] text-muted-foreground">Project lead</div>
                            </td>
                            <td className="border-b px-3 py-3 align-top text-muted-foreground">
                              <div>{formatDate(project.start_date ?? project.startDate)}</div>
                              <div>{formatDate(project.end_date ?? project.endDate)}</div>
                            </td>
                            <td className="border-b px-3 py-3 align-top">
                              <Badge variant="outline" className={`capitalize ${statusBadge[project.status]}`}>{statusLabel(project.status)}</Badge>
                            </td>
                            <td className="min-w-[170px] border-b px-3 py-3 align-top">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Completion</span>
                                <span>{project.progress ?? 0}%</span>
                              </div>
                              <Progress value={project.progress ?? 0} className="h-2" />
                            </td>
                            <td className="border-b px-3 py-3 text-center align-top">
                              <button type="button" onClick={() => openProjectTasks(project.id)} className="rounded-xl border px-3 py-1 font-black hover:bg-background">
                                {row.totalActivities}
                              </button>
                            </td>
                            {lifecycleStageCatalog.map((stage) => {
                              const count = row.stageCounts[stage.key];
                              return (
                                <td key={stage.key} className="border-b px-2 py-3 text-center align-top">
                                  <button
                                    type="button"
                                    onClick={() => openProjectTasks(project.id, stage.key)}
                                    className={`mx-auto flex h-9 min-w-12 items-center justify-center rounded-xl border px-3 font-black transition hover:bg-background ${stage.border} ${stage.text}`}
                                    title={`Open ${stage.label} tasks`}
                                  >
                                    {count}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="border-b px-3 py-3 text-center align-top">
                              <Button size="sm" variant="outline" className="gap-2" onClick={() => openProjectTasks(project.id)}>
                                <ExternalLink className="h-3.5 w-3.5" /> Open
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredMatrixRows.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Filter className="mx-auto mb-2 h-5 w-5" /> No projects match the current filters.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Profile;
