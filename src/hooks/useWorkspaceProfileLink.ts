import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  useRegisterUserAccess,
  useTeamMembers,
  useUpdateWorkspaceSettings,
  useUserAccounts,
  useWorkspaceSettings,
} from '@/hooks/useProjects';
import { normalizeWorkspaceRoleId } from '@/lib/workspace-access';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const getAuthDisplayName = (user: User) => {
  const metadata = user.user_metadata ?? {};

  if (typeof metadata.full_name === 'string' && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }

  if (typeof metadata.name === 'string' && metadata.name.trim()) {
    return metadata.name.trim();
  }

  const givenName = typeof metadata.given_name === 'string' ? metadata.given_name.trim() : '';
  const familyName = typeof metadata.family_name === 'string' ? metadata.family_name.trim() : '';
  return [givenName, familyName].filter(Boolean).join(' ').trim();
};

const splitName = (displayName: string) => {
  const parts = displayName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
};

export function useWorkspaceProfileLink(user: User | null) {
  const { data: settings } = useWorkspaceSettings();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const updateSettings = useUpdateWorkspaceSettings();
  const registerUserAccess = useRegisterUserAccess();

  useEffect(() => {
    if (!user || !settings || updateSettings.isPending) return;

    const authEmail = normalizeText(user.email);
    const linkedAccountById = settings.currentUser.userAccountId
      ? userAccounts.find((account) => account.id === settings.currentUser.userAccountId)
      : undefined;
    const linkedAccountByEmail = authEmail
      ? userAccounts.find((account) => normalizeText(account.email) === authEmail)
      : undefined;
    const linkedAccount = linkedAccountById ?? linkedAccountByEmail;
    const linkedById = settings.currentUser.teamMemberId
      ? teamMembers.find((member) => member.id === settings.currentUser.teamMemberId)
      : undefined;
    const linkedByEmail = authEmail
      ? teamMembers.find((member) => normalizeText(member.email) === authEmail)
      : undefined;
    const linkedAccountMember = linkedAccount?.teamMemberId
      ? teamMembers.find((member) => member.id === linkedAccount.teamMemberId)
      : undefined;
    const linkedMember = linkedById ?? linkedAccountMember ?? linkedByEmail;
    const displayName =
      getAuthDisplayName(user) ||
      linkedAccount?.fullName ||
      linkedMember?.name ||
      settings.currentUser.displayName;
    const { firstName, lastName } = splitName(displayName);

    const nextSettings = {
      ...settings,
      profile: {
        ...settings.profile,
        firstName: firstName || settings.profile.firstName,
        lastName: lastName || settings.profile.lastName,
        email: user.email ?? settings.profile.email,
      },
      currentUser: {
        ...settings.currentUser,
        authUserId: user.id,
        displayName,
        roleId: normalizeWorkspaceRoleId(linkedAccount?.roleId ?? linkedMember?.privilegeRole ?? settings.currentUser.roleId),
        teamMemberId: linkedMember?.id ?? linkedAccount?.teamMemberId ?? settings.currentUser.teamMemberId ?? '',
        userAccountId: linkedAccount?.id ?? settings.currentUser.userAccountId ?? '',
      },
    };

    const hasChanges =
      settings.profile.firstName !== nextSettings.profile.firstName ||
      settings.profile.lastName !== nextSettings.profile.lastName ||
      settings.profile.email !== nextSettings.profile.email ||
      settings.currentUser.authUserId !== nextSettings.currentUser.authUserId ||
      settings.currentUser.displayName !== nextSettings.currentUser.displayName ||
      settings.currentUser.roleId !== nextSettings.currentUser.roleId ||
      (settings.currentUser.teamMemberId ?? '') !== (nextSettings.currentUser.teamMemberId ?? '') ||
      (settings.currentUser.userAccountId ?? '') !== (nextSettings.currentUser.userAccountId ?? '');

    if (!hasChanges) return;

    updateSettings.mutate(nextSettings);
  }, [settings, teamMembers, updateSettings, user, userAccounts]);

  useEffect(() => {
    if (!user || !settings || registerUserAccess.isPending) return;

    const authEmail = normalizeText(user.email);
    const linkedAccount =
      (settings.currentUser.userAccountId
        ? userAccounts.find((account) => account.id === settings.currentUser.userAccountId)
        : undefined) ??
      (authEmail ? userAccounts.find((account) => normalizeText(account.email) === authEmail) : undefined);

    if (!linkedAccount || linkedAccount.status === 'suspended') return;

    const lastAccessAge = linkedAccount.lastAccessAt
      ? Date.now() - new Date(linkedAccount.lastAccessAt).getTime()
      : Number.POSITIVE_INFINITY;

    if (lastAccessAge < 15 * 60 * 1000 && linkedAccount.status === 'active') return;

    const displayName = getAuthDisplayName(user) || linkedAccount.fullName || settings.currentUser.displayName;
    registerUserAccess.mutate({
      userAccountId: linkedAccount.id,
      email: user.email,
      displayName,
      authUserId: user.id,
    });
  }, [registerUserAccess, settings, user, userAccounts]);
}
