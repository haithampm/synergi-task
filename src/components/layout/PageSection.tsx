import type { ReactNode } from 'react';

interface PageSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageSection = ({ title, description, actions }: PageSectionProps) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default PageSection;
