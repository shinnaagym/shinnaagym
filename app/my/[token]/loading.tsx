export default function MyReservationLoading() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="flex flex-col items-center gap-3 text-ink/40">
        <div className="h-8 w-8 rounded-full border-2 border-line border-t-coral animate-spin" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    </main>
  );
}
