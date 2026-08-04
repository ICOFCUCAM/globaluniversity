export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-sand border-t-brand-purple" />
        <p className="mt-4 font-heading text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
          ICOF Global University
        </p>
      </div>
    </div>
  );
}
