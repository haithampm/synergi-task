import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatabaseConnection } from '@/hooks/useProjects';

const getStatusClasses = (status?: string) => {
  if (status === 'live' || status === 'synced') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'syncing' || status === 'connecting') return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
};

const DatabaseSyncStatus = () => {
  const { data: health, refetch, isFetching } = useDatabaseConnection();
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'syncing' | 'synced' | 'local'>('connecting');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: typeof liveStatus; syncedAt?: string }>).detail;
      if (detail?.status) setLiveStatus(detail.status);
      if (detail?.syncedAt) setSyncedAt(detail.syncedAt);
    };

    window.addEventListener('workspace-sync-status', handleSyncStatus as EventListener);
    return () => window.removeEventListener('workspace-sync-status', handleSyncStatus as EventListener);
  }, []);

  const isHealthy = Boolean(health?.operational && health.connected && health.authenticated && health.workspaceId);
  const hasConfigIssue = Boolean(health && (!health.operational || !health.configured));
  const label = isHealthy
    ? liveStatus === 'syncing'
      ? 'Syncing database'
      : liveStatus === 'live'
        ? 'Database live'
        : 'Database synced'
    : hasConfigIssue
      ? 'Local only'
      : health?.connected && !health.authenticated
        ? 'Login required'
        : 'Database issue';

  const Icon = isHealthy ? CheckCircle2 : hasConfigIssue ? CloudOff : AlertTriangle;

  return (
    <div className={`max-w-[calc(100vw-1.5rem)] rounded-2xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl ${getStatusClasses(isHealthy ? liveStatus : 'local')}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-black">{label}</p>
          <p className="max-w-[260px] truncate opacity-80">
            {isHealthy
              ? syncedAt
                ? `Last sync ${new Date(syncedAt).toLocaleTimeString()}`
                : health.message
              : health?.message ?? 'Checking Supabase connection...'}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 rounded-xl"
          onClick={() => void refetch()}
          title="Refresh database connection status"
        >
          {isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
};

export default DatabaseSyncStatus;
