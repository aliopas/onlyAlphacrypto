export default function ArchiveLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-48 bg-[#222] rounded" />
        <div className="h-4 w-72 bg-[#222] rounded mt-2" />
      </div>

      <div className="h-11 w-full bg-[#111] border border-[#222] rounded-lg" />

      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-16 bg-[#222] rounded-md" />
        ))}
      </div>

      <div className="h-4 w-32 bg-[#222] rounded" />

      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 border border-[#222] rounded-lg bg-[#0A0A0A]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-[#222] rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-[#222] rounded" />
              <div className="h-3 w-1/2 bg-[#222] rounded" />
              <div className="flex gap-3">
                <div className="h-3 w-20 bg-[#222] rounded" />
                <div className="h-3 w-16 bg-[#222] rounded" />
                <div className="h-3 w-24 bg-[#222] rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
