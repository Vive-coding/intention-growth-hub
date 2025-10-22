import SharedLeftNav from "@/components/layout/SharedLeftNav";

export default function JournalPage() {
  return (
    <div className="min-h-screen flex">
      <SharedLeftNav />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Journal (Preview)</h1>
          <p className="text-sm text-gray-600 mb-6">This is a placeholder route for the upcoming journal experience. It is intentionally hidden from the left nav.</p>
          <div className="border rounded-2xl p-4 bg-white shadow-sm">
            <textarea className="w-full min-h-[180px] outline-none" placeholder="Write your thoughts..." />
          </div>
        </div>
      </main>
    </div>
  );
}


