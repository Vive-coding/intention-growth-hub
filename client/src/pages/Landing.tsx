import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthModal } from "@/components/AuthModal";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export const Landing = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();


  const handleAuthClick = (mode: 'signup' | 'signin') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      const hasCompletedOnboarding = (user as any)?.onboardingCompleted;
      navigate(hasCompletedOnboarding ? "/" : "/journal", { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-purple-50 relative overflow-hidden">
      {/* Soft cloud-like shapes in the background */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute -top-16 right-[-4rem] h-72 w-72 rounded-full bg-white/50 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-32 h-64 w-64 rounded-full bg-white/40 blur-3xl" />

      {/* Header */}
      <header className="relative border-b border-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Logo size="lg" className="text-gray-900" />
            </div>
            <Button
              variant="outline"
              onClick={() => handleAuthClick("signin")}
              className="rounded-full border border-gray-200 bg-white/70 text-gray-800 hover:bg-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-gray-900 mb-6 tracking-tight leading-[1.1] pb-2">
            <span className="block sm:whitespace-nowrap">Discover and build life-changing habits</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-purple-600 sm:whitespace-nowrap">
              to achieve your goals
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            Chat with an AI coach that actually fits your energy and life. Get guidance and tracking to build your personal
            Operating System.
          </p>
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => handleAuthClick("signup")}
              className="rounded-full border-2 border-purple-500 bg-black text-white px-10 py-3 text-lg hover:bg-gray-900"
            >
              Join Private Beta
            </Button>
          </div>
        </div>
      </section>

      {/* Middle Panel: three simple, full-width rows */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <h2 className="text-3xl font-semibold text-center text-gray-900">
            What makes this coach feel different
          </h2>

          {/* On-demand sounding board row - FIRST */}
          <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-emerald-50/30 to-white border border-emerald-100/50 shadow-xl p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_1.2fr] md:items-center">
              {/* Chat visual on the left */}
              <div className="relative order-2 md:order-1">
                <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-emerald-50/30 border border-emerald-100 shadow-lg p-4 space-y-3 overflow-hidden">
                  <div className="flex flex-col gap-3">
                    {/* User message */}
                    <div className="self-start max-w-[80%] rounded-2xl bg-white/90 backdrop-blur-sm px-4 py-2.5 shadow-sm text-gray-800 text-sm">
                      I'm feeling overwhelmed with work and can't focus on my side project.
                    </div>
                    {/* Coach insightful suggestion */}
                    <div className="self-end max-w-[85%] rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-4 py-3 shadow-md text-left text-sm leading-relaxed">
                      Based on your patterns, your peak energy happens before 9am. What if we protect just two mornings this week—30 minutes each—to chip away at the side project? You can keep those windows sacred, no work emails.
                    </div>
                  </div>
                </div>
              </div>
              {/* Text content on the right */}
              <div className="order-1 md:order-2">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
                  On-demand coach as a sounding board
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl">
                  Bring in a messy brain-dump. Your coach reflects it back, pulls out the signal, and proposes concrete next
                  moves you can actually take this week.
                </p>
              </div>
            </div>
            </Card>

          {/* Discover your patterns row - SECOND */}
          <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white/50 to-white border border-gray-100/50 shadow-xl p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
                  Discover your patterns, not just your streaks
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl">
                  Instead of only counting checkmarks, the coach notices when and why things work for you — and when they
                  quietly fall off.
                </p>
              </div>
              <div className="relative">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 shadow-md p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-amber-800 tracking-wide">
                      PATTERN INSIGHT
                    </span>
                    <span className="text-[11px] text-amber-700">Confidence: 85%</span>
                  </div>
                  <p className="text-gray-900 font-semibold mb-1">
                    Early morning workouts compound into consistent energy, evening sessions fall off completely
                  </p>
                  <p className="text-xs text-gray-700">
                    Your weekday movement habit sticks when scheduled before 9am — morning slots protect against decision fatigue and show a 92% completion rate. Evening workouts drop to 30% due to energy depletion. Shift high-priority habits to your peak windows for lasting momentum.
                  </p>
                </div>
              </div>
            </div>
            </Card>

          {/* Conversational goal design and habit tracking - THIRD */}
          <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50/30 to-white border border-blue-100/50 shadow-xl p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_1.2fr] md:items-center">
              {/* Visual mockups on the left */}
              <div className="relative order-2 md:order-1 space-y-4">
                {/* Goal card mockup */}
                <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/40 border border-blue-100 shadow-lg p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-blue-600 tracking-wider mb-1">FOCUS GOAL</div>
                      <h4 className="text-base font-semibold text-gray-900 leading-tight mb-2">
                        Step into a leadership role
                      </h4>
                      <p className="text-xs text-gray-700 leading-relaxed mb-3">
                        Build the skills and visibility to transition from individual contributor to leading a team by identifying high-impact projects and developing mentorship relationships.
                      </p>
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-gray-500 tracking-wider mb-1.5">SUPPORTING HABITS</div>
                        <div className="flex items-start gap-2 text-xs">
                          <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700"><span className="font-medium">Weekly mentorship session</span> — connect with senior leaders</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs">
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5"></div>
                          <span className="text-gray-600"><span className="font-medium">Document wins</span> — capture impact for visibility</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Habit completion notification mockup */}
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200/80 shadow-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-semibold text-emerald-900 mb-0.5">Habit Logged!</h5>
                      <p className="text-sm text-gray-800 font-medium mb-1">Weekly mentorship session</p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Current streak:</span> 4 weeks • <span className="text-emerald-700">Completed today at 2:30 PM</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text content on the right */}
              <div className="order-1 md:order-2">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
                  Conversational goal design and habit tracking
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl mb-3">
                  Share where you want to grow in your career, and your coach helps shape it into a clear goal with specific habits to get there.
                </p>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl">
                  Track progress naturally through check-ins and conversations — no manual logging required. Your coach remembers what you're working on and celebrates progress with you.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Try GoodHabit in our private beta
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Get early access to chat-based coaching, My Focus, and habit tracking while we tune the experience with a small group of members.
          </p>
          <div className="flex flex-col items-center gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => handleAuthClick("signup")}
              className="rounded-full border-2 border-purple-500 bg-black text-white px-10 py-3 text-lg hover:bg-gray-900"
            >
              Join Private Beta
            </Button>
            <button
              type="button"
              onClick={() => handleAuthClick("signin")}
              className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="lg" className="text-gray-900" />
          </div>
          <p className="text-gray-600">
            Transform your life through intentional growth and AI-powered insights.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  );
};