import { Button, EmptyState } from '@imds/ui';
export function EmptySectionPage({ title }: { title: string }) {
  return <EmptyState icon="▦" title={`${title} are ready to configure`} description="This section is part of the Phase 1 application shell and will be connected to production data in the next implementation phases." benefits={["Tenant-aware permissions","Consistent design system","Ready for integrations and automation"]} action={<Button>Create first item</Button>} />;
}
