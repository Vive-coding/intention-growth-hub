import { Button } from "@/components/ui/button";

interface Props {
  mode: 'chat' | 'journal';
  onChange: (mode: 'chat' | 'journal') => void;
}

export default function JournalToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex items-center rounded-lg border p-1 bg-white">
      <button
        className={`px-3 py-1 rounded-md text-sm ${mode==='chat' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        onClick={() => onChange('chat')}
      >
        Chat
      </button>
      <button
        className={`px-3 py-1 rounded-md text-sm ${mode==='journal' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        onClick={() => onChange('journal')}
      >
        Journal
      </button>
    </div>
  );
}


