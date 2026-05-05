import type { ReactNode } from 'react';

interface PageSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageSection = ({ title, description, actions }: PageSectionProps) => (
  <section className="section-toolbar">
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">{title}</p>
      {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="action-cluster shrink-0">{actions}</div> : null}
  </section>
);

export default PageSection;
