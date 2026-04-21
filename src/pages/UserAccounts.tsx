import { useState } from \"react\";
import { Plus, Pencil, Trash2, Shield, User, Mail, Building2, Briefcase } from \"lucide-react\";
import AppLayout from \"@/components/layout/AppLayout\";
import AppHeader from \"@/components/layout/AppHeader\";
import PageSection from \"@/components/layout/PageSection\";
import { Button } from \"@/components/ui/button\";
import { Card, CardContent } from \"@/components/ui/card\";
import { Badge } from \"@/components/ui/badge\";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from \"@/components/ui/table\";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from \"@/components/ui/sheet\";
import { Input } from \"@/components/ui/input\";
import { Label } from \"@/components/ui/label\";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from \"@/components/ui/select\";
import { useUserAccounts, useCreateUserAccount, useUpdateUserAccount, useDeleteUserAccount, useWorkspaceSettings } from \"@/hooks/useProjects\";
import { toast } from \"sonner\";
import { WorkspaceUserAccount } from \"@/lib/workspace-store\";

const UserAccounts = () => {
  const { data: userAccounts = [], isLoading } = useUserAccounts();
  const { data: settings } = useWorkspaceSettings();
  const createAccount = useCreateUserAccount();
  const updateAccount = useUpdateUserAccount();
  const deleteAccount = useDeleteUserAccount();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Partial<WorkspaceUserAccount> | null>(null);

  const roles = settings?.privilegeRoles || [];

  const handleOpenForm = (account?: WorkspaceUserAccount) => {
    setSelectedAccount(account || {
      fullName: \"\",
      email: \"\",
      roleId: \"viewer\",
      status: \"invited\",
      authProvider: \"email\",
      title: \"\",
      department: \"\",
    });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!selectedAccount?.fullName || !selectedAccount?.email) {
      toast.error(\"Full name and email are required\");
      return;
    }

    try {
      if (selectedAccount.id) {
        await updateAccount.mutateAsync({
          id: selectedAccount.id,
          ...selectedAccount,
        });
        toast.success(\"User account updated\");
      } else {
        await createAccount.mutateAsync(selectedAccount as any);
        toast.success(\"User account created\");
      }
      setIsSheetOpen(false);
    } catch (error) {
      toast.error(\"Failed to save user account\");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(\"Are you sure you want to remove this user's access?\")) {
      try {
        await deleteAccount.mutateAsync(id);
        toast.success(\"User access removed\");
      } catch (error) {
        toast.error(\"Failed to remove user access\");
      }
    }
  };

  return (
    <AppLayout>
      <AppHeader title=\"User Accounts\" />
      <PageSection
        title=\"Workspace Access Control\"
        description=\"Manage user accounts, permissions, and workspace access.\"
        action={
          <Button onClick={() => handleOpenForm()} className=\"gap-2\">
            <Plus className=\"h-4 w-4\" /> Add User
          </Button>
        }
      >
        <Card className=\"glass\">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className=\"text-right\">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className=\"text-center py-8 text-muted-foreground\">
                    Loading user accounts...
                  </TableCell>
                </TableRow>
              ) : userAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className=\"text-center py-8 text-muted-foreground\">
                    No user accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                userAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className=\"flex flex-col\">
                        <span className=\"font-medium\">{account.fullName}</span>
                        <span className=\"text-xs text-muted-foreground\">{account.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant=\"outline\" className=\"capitalize\">
                        {roles.find(r => r.id === account.roleId)?.name || account.roleId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={account.status === 'active' ? 'default' : 'secondary'}
                        className=\"capitalize\"
                      >
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.department || \"-\"}</TableCell>
                    <TableCell className=\"text-right\">
                      <div className=\"flex justify-end gap-2\">
                        <Button variant=\"ghost\" size=\"icon\" onClick={() => handleOpenForm(account)}>
                          <Pencil className=\"h-4 w-4\" />
                        </Button>
                        <Button 
                          variant=\"ghost\" 
                          size=\"icon\" 
                          className=\"text-destructive hover:text-destructive\"
                          onClick={() => handleDelete(account.id)}
                        >
                          <Trash2 className=\"h-4 w-4\" />
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
        <SheetContent className=\"sm:max-w-md\">
          <SheetHeader>
            <SheetTitle>{selectedAccount?.id ? \"Edit User Access\" : \"Add New User\"}</SheetTitle>
          </SheetHeader>
          <div className=\"grid gap-4 py-6\">
            <div className=\"grid gap-2\">
              <Label htmlFor=\"fullName\">Full Name</Label>
              <Input 
                id=\"fullName\" 
                value={selectedAccount?.fullName || \"\"} 
                onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, fullName: e.target.value }) : null)}
                placeholder=\"John Doe\"
              />
            </div>
            <div className=\"grid gap-2\">
              <Label htmlFor=\"email\">Email Address</Label>
              <Input 
                id=\"email\" 
                type=\"email\"
                value={selectedAccount?.email || \"\"} 
                onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                placeholder=\"john@example.com\"
              />
            </div>
            <div className=\"grid gap-2\">
              <Label htmlFor=\"role\">Permission Role</Label>
              <Select 
                value={selectedAccount?.roleId} 
                onValueChange={(value) => setSelectedAccount(prev => prev ? ({ ...prev, roleId: value }) : null)}
              >
                <SelectTrigger id=\"role\">
                  <SelectValue placeholder=\"Select a role\" />
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
            <div className=\"grid gap-2\">
              <Label htmlFor=\"status\">Account Status</Label>
              <Select 
                value={selectedAccount?.status} 
                onValueChange={(value: any) => setSelectedAccount(prev => prev ? ({ ...prev, status: value }) : null)}
              >
                <SelectTrigger id=\"status\">
                  <SelectValue placeholder=\"Select status\" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"active\">Active</SelectItem>
                  <SelectItem value=\"invited\">Invited</SelectItem>
                  <SelectItem value=\"suspended\">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className=\"grid grid-cols-2 gap-4\">
              <div className=\"grid gap-2\">
                <Label htmlFor=\"title\">Job Title</Label>
                <Input 
                  id=\"title\" 
                  value={selectedAccount?.title || \"\"} 
                  onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                />
              </div>
              <div className=\"grid gap-2\">
                <Label htmlFor=\"department\">Department</Label>
                <Input 
                  id=\"department\" 
                  value={selectedAccount?.department || \"\"} 
                  onChange={(e) => setSelectedAccount(prev => prev ? ({ ...prev, department: e.target.value }) : null)}
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant=\"outline\" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default UserAccounts;
