import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { workspaceKeys, useUserAccounts, useUpdateUserAccount, useDeleteUserAccount, useWorkspaceSettings } from "@/hooks/useProjects";
import { syncWorkspaceUserAccount } from "@/integrations/supabase/workspace-data";
import { toast } from "sonner";
import { makeId, readWorkspaceData, updateWorkspaceData, WorkspaceUserAccount } from "@/lib/workspace-store";

const fallbackRoles = [
  { id: "admin", name: "Admin" },
  { id: "super_admin", name: "Super Admin" },
  { id: "pm", name: "Project Manager" },
  { id: "lead", name: "Team Lead" },
  { id: "viewer", name: "Executive Viewer" },
];

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const mergeAccount = (accounts: WorkspaceUserAccount[] = [], account: WorkspaceUserAccount) => {
  const existingIndex = accounts.findIndex((item) =>
    item.id === account.id || normalizeEmail(item.email) === normalizeEmail(account.email),
  );

  if (existingIndex >= 0) {
    const next = [...accounts];
    next[existingIndex] = {
      ...next[existingIndex],
      ...account,
      id: next[existingIndex].id,
      createdAt: next[existingIndex].createdAt || account.createdAt,
    };
    return next;
  }

  return [account, ...accounts];
};

const UserAccounts = () => {
  const queryClient = useQueryClient();
  const { data: userAccounts = [], isLoading } = useUserAccounts();
  const { data: settings } = useWorkspaceSettings();
  const updateAccount = useUpdateUserAccount();
  const deleteAccount = useDeleteUserAccount();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Partial<WorkspaceUserAccount> | null>(null);
  const [saving, setSaving] = useState(false);
  const [localUserAccounts, setLocalUserAccounts] = useState<WorkspaceUserAccount[]>([]);

  const roles = settings?.privilegeRoles?.length ? settings.privilegeRoles : fallbackRoles;
  const visibleUserAccounts = localUserAccounts.reduce(
    (accounts, account) => mergeAccount(accounts, account),
    userAccounts,
  );

  const refreshUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.users }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.team }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.settings }),
    ]);
  };

  const handleOpenForm = (account?: WorkspaceUserAccount) => {
    setSelectedAccount(account || {
      fullName: "",
      email: "",
      roleId: "viewer",
      status: "active",
      authProvider: "email",
      title: "",
      department: "",
      notes: "",
    });
    setIsSheetOpen(true);
  };

  const saveLocalUserAccount = (account: WorkspaceUserAccount) => {
    updateWorkspaceData((current) => {
      const nextUserAccounts = mergeAccount(current.userAccounts, account);
      const existed = current.userAccounts.some((item) =>
        item.id === account.id || normalizeEmail(item.email) === normalizeEmail(account.email),
      );

      return {
        ...current,
        userAccounts: nextUserAccounts,
        auditLogs: [
          {
            id: makeId("audit"),
            action: existed ? "User access updated" : "User access created",
            entityType: "user",
            entityId: account.id,
            actorName: current.settings.currentUser.displayName || current.settings.profile.email || "Admin User",
            detail: `${account.fullName} was ${existed ? "updated" : "added"} as ${account.roleId}.`,
            createdAt: new Date().toISOString(),
          },
          ...current.auditLogs,
        ].slice(0, 300),
      };
    });

    setLocalUserAccounts((current) => mergeAccount(current, account));
    queryClient.setQueryData<WorkspaceUserAccount[]>(workspaceKeys.users, (current = []) => mergeAccount(current, account));
  };

  const handleSave = async () => {
    const fullName = selectedAccount?.fullName?.trim() ?? "";
    const email = selectedAccount?.email?.trim() ?? "";

    if (!fullName || !email) {
      toast.error("Full name and email are required");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }

    setSaving(true);
    try {
      const existingByEmail = visibleUserAccounts.find(
        (account) => normalizeEmail(account.email) === normalizeEmail(email),
      );
      const existing = selectedAccount.id
        ? visibleUserAccounts.find((account) => account.id === selectedAccount.id) ?? existingByEmail
        : existingByEmail;

      const account: WorkspaceUserAccount = {
        id: existing?.id ?? selectedAccount.id ?? makeId("user"),
        fullName,
        email,
        roleId: selectedAccount.roleId ?? "viewer",
        status: selectedAccount.status ?? "active",
        authProvider: selectedAccount.authProvider ?? "email",
        teamMemberId: selectedAccount.teamMemberId || existing?.teamMemberId,
        title: selectedAccount.title ?? existing?.title ?? "",
        department: selectedAccount.department ?? existing?.department ?? "",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastAccessAt: existing?.lastAccessAt,
        invitationSentAt: existing?.invitationSentAt,
        passwordResetSentAt: existing?.passwordResetSentAt,
        lastNotificationAt: existing?.lastNotificationAt,
        notificationCount: existing?.notificationCount ?? 0,
        invitedBy: existing?.invitedBy ?? readWorkspaceData().settings.currentUser.displayName,
        notes: selectedAccount.notes ?? existing?.notes ?? "",
      };

      saveLocalUserAccount(account);

      let serverSyncFailed = false;
      try {
        await syncWorkspaceUserAccount(account);
        if (existing?.id) {
          await updateAccount.mutateAsync(account);
        }
      } catch (syncError) {
        serverSyncFailed = true;
        console.error("User account server sync failed", syncError);
      }

      if (!serverSyncFailed) {
        await refreshUsers();
        queryClient.setQueryData<WorkspaceUserAccount[]>(workspaceKeys.users, (current = []) => mergeAccount(current, account));
      }

      setIsSheetOpen(false);
      setSelectedAccount(null);

      if (serverSyncFailed) {
        toast.warning("User account saved in this workspace. Server login membership was not created; configure Supabase Auth / workspace membership permissions for actual login.");
      } else {
        toast.success(existing?.id ? "User account updated" : "User account created");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to suspend this user's access?")) {
      try {
        await deleteAccount.mutateAsync(id);
        setLocalUserAccounts((current) => current.map((account) => account.id === id ? { ...account, status: "suspended" } : account));
        toast.success("User access suspended");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to suspend user access");
      }
    }
  };

  return (
    <AppLayout>
      <AppHeader title="User Accounts" />
      <PageSection
        title="Workspace Access Control"
        description="Manage mail users, admin access, linked team profiles, and workspace permissions from one directory."
        action={
          <Button onClick={() => handleOpenForm()} className="gap-2">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Users</p>
              <p className="mt-2 text-2xl font-black">{visibleUserAccounts.length}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active</p>
              <p className="mt-2 text-2xl font-black">{visibleUserAccounts.filter((account) => account.status === "active").length}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Admins</p>
              <p className="mt-2 text-2xl font-black">{visibleUserAccounts.filter((account) => ["admin", "super_admin"].includes(account.roleId)).length}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invited</p>
              <p className="mt-2 text-2xl font-black">{visibleUserAccounts.filter((account) => account.status === "invited").length}</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          Add or edit app-level user access here. Production login access still requires the user to exist in Supabase Auth and have an active workspace membership.
        </p>
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && visibleUserAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading user accounts...
                  </TableCell>
                </TableRow>
              ) : visibleUserAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No user accounts found. Use Add User to create the first account record.
                  </TableCell>
                </TableRow>
              ) : (
                visibleUserAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.fullName}</span>
                        <span className="text-xs text-muted-foreground">{account.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {roles.find(r => r.id === account.roleId)?.name || account.roleId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.department || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(account)} title="Edit user">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(account.id)}
                          title="Suspend user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </PageSection>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedAccount?.id ? "Edit User Access" : "Add New User"}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={selectedAccount?.fullName || ""}
                onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, fullName: e.target.value }) : null)}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={selectedAccount?.email || ""}
                onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Permission Role</Label>
              <Select
                value={selectedAccount?.roleId}
                onValueChange={(value) => setSelectedAccount(prev => prev ? ({ ...prev, roleId: value }) : null)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Account Status</Label>
              <Select
                value={selectedAccount?.status}
                onValueChange={(value: any) => setSelectedAccount(prev => prev ? ({ ...prev, status: value }) : null)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={selectedAccount?.title || ""}
                  onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={selectedAccount?.department || ""}
                  onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, department: e.target.value }) : null)}
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || updateAccount.isPending}>
              {saving || updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default UserAccounts;
