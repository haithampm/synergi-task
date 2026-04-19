import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Save, Trash2, User } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers, useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings } from "@/hooks/useProjects";
import { toast } from "sonner";

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const Profile = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const updateSettings = useUpdateWorkspaceSettings();
  const [draft, setDraft] = useState(settings);

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

  const initials = `${draft.profile.firstName?.[0] ?? ""}${draft.profile.lastName?.[0] ?? ""}`.trim() || draft.currentUser.displayName.slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <AppHeader title="My Profile" subtitle="Manage your personal account details, linked workspace access, and profile picture." />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <div className="space-y-6 p-6 animate-fade-in">
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
      </div>
    </AppLayout>
  );
};

export default Profile;
