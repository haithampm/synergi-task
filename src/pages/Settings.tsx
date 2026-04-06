import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, Palette, Shield } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';

const Settings = () => (
  <AppLayout>
    <AppHeader title="Settings" subtitle="Manage your account and preferences." />
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs">First Name</Label><Input defaultValue="John" className="mt-1" /></div>
            <div><Label className="text-xs">Last Name</Label><Input defaultValue="Doe" className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">Email</Label><Input defaultValue="john@company.com" className="mt-1" /></div>
          <Button size="sm" className="gradient-primary text-primary-foreground">Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {['Email notifications', 'Push notifications', 'Task reminders', 'Weekly digest'].map((item) => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-sm">{item}</span>
              <Switch defaultChecked />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Dark mode</span>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Compact view</span>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Two-factor authentication</span>
            <Switch />
          </div>
          <Separator />
          <Button variant="outline" size="sm">Change Password</Button>
        </CardContent>
      </Card>
    </div>
  </AppLayout>
);

export default Settings;
