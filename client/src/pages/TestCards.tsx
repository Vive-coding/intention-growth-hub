import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function TestCardsPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const createTestThread = async () => {
    setLoading(true);
    try {
      // Use the chat API to create a test thread that appears in the chat UI
      const response = await apiRequest('/api/chat/threads/test-cards', { method: 'POST' });
      setResult(response);

      if (response.threadId) {
        navigate(`/${response.threadId}`);
      }
    } catch (error) {
      console.error('Failed to create test thread:', error);
      setResult({ error: 'Failed to create test thread' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Test Cards Thread</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">What this does:</h2>
        <ul className="text-blue-800 space-y-1">
          <li>• Creates a test thread with all card types</li>
          <li>• Tests goal suggestion cards</li>
          <li>• Tests habit review cards</li>
          <li>• Tests optimization cards</li>
          <li>• Tests insight cards</li>
          <li>• <strong>Thread will appear in your chat sidebar</strong></li>
        </ul>
      </div>

      <button
        onClick={createTestThread}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        {loading ? 'Creating Test Thread...' : 'Create Test Thread with Cards'}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
          {result.threadId && (
            <div className="mt-4">
              <a 
                href={`/${result.threadId}`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Open Test Thread in Chat
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
