export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="page-lead mt-2 max-w-prose text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
