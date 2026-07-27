export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3 text-ink/40">
        <div className="h-8 w-8 rounded-full border-2 border-line border-t-coral animate-spin" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    </div>
  );
}
