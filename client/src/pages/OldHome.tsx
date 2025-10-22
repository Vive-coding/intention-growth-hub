import SharedLeftNav from "@/components/layout/SharedLeftNav";

export default function OldHomePage() {
  return (
    <div className="min-h-screen flex">
      <SharedLeftNav />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Old Home (Preview)</h1>
          <p className="text-sm text-gray-600">This route will host the previous home modules for reference while we migrate UI pieces into the new flows. It is hidden from the left nav.</p>
        </div>
      </main>
    </div>
  );
}


