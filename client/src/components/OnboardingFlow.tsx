
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type StepType = "info" | "choice" | "multi_choice" | "action";
type StepKey =
  | "welcome"
  | "goal_setting_ability"
  | "habit_building"
  | "coaching_style"
  | "coach_personality"
  | "life_metrics"
  | "start_conversation";

interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

interface OnboardingStep {
  key: StepKey;
  type: StepType;
  title: string;
  subtitle?: string;
  description?: string;
  question?: string;
  helperText?: string;
  icon?: ReactNode;
  options?: ChoiceOption[];
  actionLabel?: string;
  actionDescription?: string;
}

type OnboardingResponses = Partial<Record<StepKey, string | string[]>>;

const onboardingSteps: OnboardingStep[] = [
  {
    key: "welcome",
    type: "info",
    title: "Welcome to your growth journey",
    subtitle: "Let’s personalize how your coach shows up for you",
    description:
      "We’ll ask a few quick questions to tailor goal planning, habit support, and coaching style so the experience feels natural from day one.",
    icon: <Heart className="w-14 h-14 text-emerald-500" />,
  },
  {
    key: "goal_setting_ability",
    type: "choice",
    title: "Your experience with goal setting",
    question: "How would you describe your goal-setting experience?",
    helperText: "Pick the option that feels closest today—your coach will meet you where you are.",
    options: [
      {
        value: "new",
        label: "Just starting out",
        description: "I’m new to setting goals and want guidance on where to begin.",
        icon: "🌱",
      },
      {
        value: "experienced",
        label: "Have some practice",
        description: "I’ve set goals before and want to stay consistent.",
        icon: "🎯",
      },
      {
        value: "struggling",
        label: "Need help sticking with them",
        description: "I tend to lose momentum and want more support.",
        icon: "💪",
      },
    ],
  },
  {
    key: "habit_building",
    type: "choice",
    title: "Your habit-building confidence",
    question: "What best describes your relationship with habits right now?",
    helperText: "This helps your coach calibrate the pace and structure of recommendations.",
    options: [
      {
        value: "new",
        label: "New to habit tracking",
        description: "I’m building this muscle and would love simple wins.",
        icon: "🆕",
      },
      {
        value: "some_success",
        label: "Had some success",
        description: "I’ve found a few routines that worked for me before.",
        icon: "✅",
      },
      {
        value: "need_help",
        label: "Could use guidance",
        description: "I want support staying accountable and adjusting when life happens.",
        icon: "🤝",
      },
    ],
  },
  {
    key: "coaching_style",
    type: "multi_choice",
    title: "How would you like your coach to support you?",
    question: "Choose all the coaching styles that resonate with you.",
    helperText: "We’ll blend these styles so each check-in feels helpful and motivating.",
    options: [
      {
        value: "support",
        label: "Support & encouragement",
        description: "Gentle nudges, empathy, and positive reinforcement.",
        icon: "❤️",
      },
      {
        value: "accountability",
        label: "Accountability check-ins",
        description: "Direct reminders to keep promises to myself.",
        icon: "📊",
      },
      {
        value: "suggestions",
        label: "Ideas & suggestions",
        description: "Creative ways to make progress when I feel stuck.",
        icon: "💡",
      },
    ],
  },
  {
    key: "coach_personality",
    type: "choice",
    title: "What coach personality clicks with you?",
    question: "Pick the tone that feels most helpful right now.",
    helperText: "We’ll match your coach’s energy to this preference.",
    options: [
      {
        value: "patient_encouraging",
        label: "Patient & encouraging",
        description: "Gentle, kind, and celebrates small wins.",
        icon: "🤗",
      },
      {
        value: "tough_but_fair",
        label: "Tough but fair",
        description: "Direct, honest, and holds you accountable with empathy.",
        icon: "💪",
      },
      {
        value: "brutally_honest",
        label: "Brutally honest",
        description: "Cut to the chase, tell it like it is, and keep things sharp.",
        icon: "⚡️",
      },
      {
        value: "cheerleader",
        label: "Cheerleader energy",
        description: "High-energy hype, motivation, and positivity.",
        icon: "🎉",
      },
    ],
  },
  {
    key: "life_metrics",
    type: "multi_choice",
    title: "Where would you like to focus first?",
    question: "Pick the areas you want support with right now.",
    helperText: "We’ll prioritize goals and habits that move these areas forward.",
    options: [
      { value: "Health & Fitness", label: "Health & Fitness", description: "Energy, movement, and feeling strong.", icon: "🏃‍♀️" },
      { value: "Career Growth", label: "Career Growth", description: "Momentum in work, learning, and impact.", icon: "🚀" },
      { value: "Personal Development", label: "Personal Development", description: "Skills, confidence, and creative growth.", icon: "🧠" },
      { value: "Relationships", label: "Relationships", description: "Connection, communication, and empathy.", icon: "❤️" },
      { value: "Finance", label: "Finance", description: "Stability, investing, and mindful spending.", icon: "💰" },
      { value: "Mental Health", label: "Mental Health", description: "Calm, resilience, and emotional clarity.", icon: "🧘‍♂️" },
    ],
  },
  {
    key: "start_conversation",
    type: "action",
    title: "You’re ready for your first conversation",
    description:
      "We’ll bring these insights into your opening chat so the coach can suggest the right goals, habits, and next steps.",
    actionDescription: "When you’re ready, we’ll start a conversation that guides you toward your first goal and supporting habits.",
    actionLabel: "Start my first chat",
  },
];

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [, navigate] = useLocation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<OnboardingResponses>({});
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const totalSteps = onboardingSteps.length;
  const currentStep = onboardingSteps[currentStepIndex];
  const isLastStep = currentStepIndex === totalSteps - 1;

  const { data: existingProfile } = useQuery({
    queryKey: ["/api/users/onboarding-profile"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/users/onboarding-profile");
      } catch (err) {
        console.warn("Failed to fetch onboarding profile", err);
        return null;
      }
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!existingProfile || prefillApplied) return;

    const nextResponses: OnboardingResponses = {};
    if (existingProfile.goalSettingAbility) {
      nextResponses.goal_setting_ability = existingProfile.goalSettingAbility;
    }
    if (existingProfile.habitBuildingAbility) {
      nextResponses.habit_building = existingProfile.habitBuildingAbility;
    }
    if (Array.isArray(existingProfile.coachingStyle) && existingProfile.coachingStyle.length > 0) {
      nextResponses.coaching_style = existingProfile.coachingStyle;
    }
    if (existingProfile.coachPersonality) {
      nextResponses.coach_personality = existingProfile.coachPersonality;
    }
    if (Array.isArray(existingProfile.focusLifeMetrics) && existingProfile.focusLifeMetrics.length > 0) {
      nextResponses.life_metrics = existingProfile.focusLifeMetrics;
    }

    setResponses((prev) => ({ ...prev, ...nextResponses }));
    setPrefillApplied(true);
  }, [existingProfile, prefillApplied]);

  const optionLabelLookup = useMemo(() => {
    const lookup = new Map<StepKey, Record<string, string>>();
    onboardingSteps.forEach((step) => {
      if ((step.type === "choice" || step.type === "multi_choice") && step.options) {
        lookup.set(
          step.key,
          step.options.reduce<Record<string, string>>((acc, option) => {
            acc[option.value] = option.label;
            return acc;
          }, {}),
        );
      }
    });
    return lookup;
  }, []);

  const getSingleLabel = useCallback(
    (stepKey: StepKey, value: string | undefined) => {
      if (!value) return undefined;
      const dictionary = optionLabelLookup.get(stepKey);
      return dictionary?.[value] ?? value;
    },
    [optionLabelLookup],
  );

  const getMultiLabels = useCallback(
    (stepKey: StepKey, values: string[] | undefined) => {
      if (!values || values.length === 0) return undefined;
      const dictionary = optionLabelLookup.get(stepKey);
      return values.map((value) => dictionary?.[value] ?? value);
    },
    [optionLabelLookup],
  );

  const summaryItems = useMemo(() => {
    const goalSetting = typeof responses.goal_setting_ability === "string"
      ? getSingleLabel("goal_setting_ability", responses.goal_setting_ability)
      : undefined;
    const habitBuilding = typeof responses.habit_building === "string"
      ? getSingleLabel("habit_building", responses.habit_building)
      : undefined;
    const coaching = Array.isArray(responses.coaching_style)
      ? getMultiLabels("coaching_style", responses.coaching_style as string[])
      : undefined;
    const focusAreas = Array.isArray(responses.life_metrics)
      ? getMultiLabels("life_metrics", responses.life_metrics as string[])
      : undefined;
    const coachPersonality = typeof responses.coach_personality === "string"
      ? getSingleLabel("coach_personality", responses.coach_personality)
      : undefined;

    return [
      { title: "Goal-setting experience", value: goalSetting },
      { title: "Habit-building confidence", value: habitBuilding },
      { title: "Preferred coaching style", value: coaching?.join(", ") },
      { title: "Coach personality", value: coachPersonality },
      { title: "Focus areas", value: focusAreas?.join(", ") },
    ].filter((item) => Boolean(item.value));
  }, [
    getMultiLabels,
    getSingleLabel,
    responses.goal_setting_ability,
    responses.habit_building,
    responses.coaching_style,
    responses.coach_personality,
    responses.life_metrics,
  ]);

  const startWelcomeConversation = useCallback(async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pendingWelcomeThread");
    }

    const threadResponse = await apiRequest("/api/chat/threads", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const newThreadId = threadResponse?.threadId || threadResponse?.id;
    if (!newThreadId) {
      throw new Error("Preferences saved, but we couldn't start your welcome chat automatically.");
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("pendingWelcomeThread", newThreadId);
    }

    navigate(`/chat/${newThreadId}?welcome=1`);
  }, [navigate]);

  const saveOnboardingMutation = useMutation({
    mutationFn: async (payload: {
      goalSettingAbility: string | null;
      habitBuildingAbility: string | null;
      coachingStyle: string[];
      coachPersonality: string | null;
      focusLifeMetrics: string[];
    }) => {
      return apiRequest("/api/users/onboarding-profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      onComplete();
      try {
        await startWelcomeConversation();
      } catch (error: any) {
        console.error("[OnboardingFlow] Failed to launch welcome conversation", error);
        setSubmitError(
          error?.message ??
            "Saved your preferences, but we couldn't start the welcome chat automatically. You can open chat to continue.",
        );
        navigate("/chat");
      }
    },
    onError: (err: any) => {
      const message = err?.message ?? "We had trouble saving your preferences. Please try again.";
      setSubmitError(message);
    },
  });

  const validateStep = (step: OnboardingStep): boolean => {
    if (step.type === "choice") {
      const value = responses[step.key];
      if (!value || Array.isArray(value)) {
        setError("Please choose an option to continue.");
        return false;
      }
    }

    if (step.type === "multi_choice") {
      const value = responses[step.key];
      if (!Array.isArray(value) || value.length === 0) {
        setError("Select at least one option to continue.");
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleContinue = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handleBack = () => {
    setError(null);
    setSubmitError(null);
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleChoiceSelect = (stepKey: StepKey, value: string) => {
    setResponses((prev) => ({ ...prev, [stepKey]: value }));
    setError(null);
  };

  const handleMultiSelect = (stepKey: StepKey, value: string) => {
    setResponses((prev) => {
      const existing = Array.isArray(prev[stepKey]) ? (prev[stepKey] as string[]) : [];
      const isSelected = existing.includes(value);
      const updated = isSelected ? existing.filter((item) => item !== value) : [...existing, value];
      return { ...prev, [stepKey]: updated };
    });
    setError(null);
  };

  const handleSubmit = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (saveOnboardingMutation.isPending) return;
    setSubmitError(null);

    const payload = {
      goalSettingAbility: typeof responses.goal_setting_ability === "string" ? responses.goal_setting_ability : null,
      habitBuildingAbility: typeof responses.habit_building === "string" ? responses.habit_building : null,
      coachingStyle: Array.isArray(responses.coaching_style) ? (responses.coaching_style as string[]) : [],
      coachPersonality: typeof responses.coach_personality === "string" ? responses.coach_personality : null,
      focusLifeMetrics: Array.isArray(responses.life_metrics) ? (responses.life_metrics as string[]) : [],
    };

    saveOnboardingMutation.mutate(payload);
  };

  const renderOptions = (step: OnboardingStep) => {
    if (!step.options) return null;

    if (step.type === "choice") {
      const selected = typeof responses[step.key] === "string" ? (responses[step.key] as string) : null;
      return (
        <div className="mt-6 space-y-3">
          {step.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChoiceSelect(step.key, option.value)}
              className={cn(
                "w-full rounded-2xl border px-4 py-4 text-left transition shadow-sm",
                "bg-white/80 hover:bg-emerald-50",
                selected === option.value
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-200"
                  : "border-slate-200",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {option.icon}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{option.label}</p>
                  {option.description && (
                    <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (step.type === "multi_choice") {
      const selected = Array.isArray(responses[step.key]) ? (responses[step.key] as string[]) : [];
      return (
        <div className="mt-6 space-y-3">
          {step.options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleMultiSelect(step.key, option.value)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-4 text-left transition shadow-sm",
                  "bg-white/80 hover:bg-emerald-50",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-200"
                    : "border-slate-200",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>
                    {option.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      {option.label}
                      {isSelected && <span className="text-xs font-medium text-emerald-600">Selected</span>}
                    </p>
                    {option.description && (
                      <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch justify-center">
        <Card className="w-full border-0 bg-white/90 shadow-xl backdrop-blur">
          <CardContent className="p-6 sm:p-10">
            <div className="flex flex-col gap-8">
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  {currentStep.icon ?? <Heart className="h-7 w-7 text-emerald-500" />}
          </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">
                    Step {currentStepIndex + 1} of {totalSteps}
                  </p>
                  <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {currentStep.title}
            </h1>
                  {currentStep.subtitle && (
                    <p className="text-base text-slate-600">{currentStep.subtitle}</p>
                  )}
                  {currentStep.description && (
                    <p className="text-base text-slate-600">{currentStep.description}</p>
                  )}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
          </div>
          
              {(currentStep.question || currentStep.helperText) && (
                <div className="space-y-2 text-center">
                  {currentStep.question && (
                    <p className="text-lg font-medium text-slate-900">{currentStep.question}</p>
                  )}
                  {currentStep.helperText && (
                    <p className="text-sm text-slate-600">{currentStep.helperText}</p>
                  )}
          </div>
              )}

              {currentStep.type === "action" ? (
                <div className="space-y-6">
                  {summaryItems.length > 0 && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-left shadow-sm">
                      <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
                        What we heard
                      </p>
                      <div className="mt-4 space-y-3">
                        {summaryItems.map((item) => (
                          <div key={item.title}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                              {item.title}
                            </p>
                            <p className="text-base text-emerald-900">{item.value}</p>
          </div>
            ))}
          </div>
                    </div>
                  )}
                  {currentStep.actionDescription && (
                    <p className="text-sm text-slate-600 text-center">
                      {currentStep.actionDescription}
                    </p>
                  )}
                </div>
              ) : (
                renderOptions(currentStep)
              )}

              {error && (
                <p className="text-sm font-medium text-rose-600">{error}</p>
              )}
              {submitError && (
                <p className="text-sm font-medium text-rose-600">{submitError}</p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {currentStepIndex > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}

                {currentStep.type !== "action" && (
                  <Button
                    onClick={handleContinue}
                    className="flex-1 bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                  >
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}

                {currentStep.type === "action" && (
                  <Button
                    onClick={handleSubmit}
                    disabled={saveOnboardingMutation.isPending}
                    className="flex-1 bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                  >
                    {saveOnboardingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      currentStep.actionLabel ?? "Start Chat"
              )}
            </Button>
                )}
              </div>
            
              {!isLastStep && (
                <Button 
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Skip for now
                </Button>
              )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
