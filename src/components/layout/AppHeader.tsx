import { Bell, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

const AppHeader = ({ title, subtitle }: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search anything..."
            className="w-64 pl-9 bg-muted/50 border-transparent focus:border-primary/30 focus:bg-card"
          />
        </div>

        <Button size="sm" variant="outline" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        <Button size="sm" className="gradient-primary text-primary-foreground shadow-glow gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Project</span>
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
