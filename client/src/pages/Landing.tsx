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

  // Full list of frameworks from coachingFrameworks.md
  const frameworks = [
    "GROW Model",
    "SMART Goals",
    "Habit Stacking",
    "The Five Whys",
    "Wheel of Life",
    "Progress Over Perfection",
    "Accountability",
    "Implementation Intentions",
    "Ikigai",
    "Kaizen",
    "Hansei"
  ];
  const [frameworkIndex, setFrameworkIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Infinite scroll: keep incrementing forever, never reset
      setFrameworkIndex((prev) => prev + 1);
    }, 2200);
    return () => clearInterval(id);
  }, []);

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
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-gray-900 mb-6 tracking-tight">
            Discover and build life-changing habits{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-purple-600">
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

          {/* Frameworks row */}
          <Card className="relative overflow-hidden rounded-3xl bg-white/85 border border-emerald-100 p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Informed by time-tested frameworks
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl">
                  Under the hood, GoodHabit blends classic coaching frameworks so the questions feel grounded and practical,
                  not generic self-help quotes.
                </p>
              </div>
              <div className="relative flex justify-center">
                <div className="relative w-48 h-14">
                  {/* iPhone-style black box */}
                  <div className="absolute inset-0 rounded-xl bg-black shadow-lg overflow-hidden">
                    {/* Rotating frameworks text - slides down infinitely (never scrolls back up) */}
                    <div 
                      className="absolute inset-0 flex flex-col text-white font-semibold text-base transition-transform duration-700 ease-in-out"
                      style={{
                        transform: `translateY(${-(frameworkIndex % frameworks.length) * 100}%)`,
                      }}
                    >
                      {/* Render frameworks multiple times for seamless infinite scroll */}
                      {[...frameworks, ...frameworks].map((fw, idx) => (
                        <div 
                          key={`${fw}-${idx}`}
                          className="flex-shrink-0 h-full flex items-center justify-center"
                        >
                          {fw}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Subtle label below */}
                  <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-gray-500 whitespace-nowrap">
                    Rotating through frameworks
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* On-demand sounding board row */}
          <Card className="relative overflow-hidden rounded-3xl bg-white/90 border border-purple-100 shadow-md p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_1.2fr] md:items-center">
              {/* Chat visual on the left */}
              <div className="relative order-2 md:order-1">
                <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-purple-50/30 border border-purple-100 shadow-lg p-4 space-y-3">
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
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  On-demand coach as a sounding board
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-xl">
                  Bring in a messy brain-dump. Your coach reflects it back, pulls out the signal, and proposes concrete next
                  moves you can actually take this week.
                </p>
              </div>
            </div>
          </Card>

          {/* See your patterns row */}
          <Card className="relative overflow-hidden rounded-3xl bg-white/90 border border-amber-100 shadow-md p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
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