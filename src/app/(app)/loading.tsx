export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <span className="text-sm">Carregando...</span>
    </div>
  );
}
