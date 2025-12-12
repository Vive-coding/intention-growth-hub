
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { StepIndicator } from "@/components/StepIndicator";
import { onboardingIllustrations } from "@/assets/onboardingIllustrations";
import { analytics } from "@/services/analyticsService";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type StepType = "info" | "choice" | "multi_choice" | "action";
type StepKey =
  | "welcome"
  | "goal_setting_ability"
  | "habit_building"
  | "coach_personality"
  | "life_metrics"
  | "notification_opt_in"
  | "notification_time"
  | "notification_frequency"
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
const DEFAULT_NOTIFICATION_TIME = "morning";

const parseDelimitedValues = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const ensureArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

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
    title: "How you relate to goals",
    question: "Which description feels most like you right now?",
    helperText: "We’ll tailor goal planning to match how you naturally work toward what matters.",
    options: [
      {
        value: "achiever",
        label: "I set and achieve goals",
        description: "I’m organized and love seeing plans turn into results.",
        icon: "🏆",
      },
      {
        value: "idea_person",
        label: "I think of goals but don’t track them",
        description: "I have ideas in mind, but I rarely document or review them.",
        icon: "💡",
      },
      {
        value: "go_with_flow",
        label: "I go with the flow",
        description: "I prefer to stay flexible and respond to what each day brings.",
        icon: "🌊",
      },
    ],
  },
  {
    key: "habit_building",
    type: "choice",
    title: "Your relationship with habits",
    question: "What best describes how you approach habits?",
    helperText: "We’ll match the cadence of support to keep progress feeling natural.",
    options: [
      {
        value: "build_new",
        label: "I want to build new habits",
        description: "I’m ready to add new routines that support my goals.",
        icon: "🚀",
      },
      {
        value: "same_routine",
        label: "I like the same routine",
        description: "Consistency comforts me—I prefer predictable rhythms.",
        icon: "🔁",
      },
      {
        value: "always_building",
        label: "I consistently build new habits",
        description: "Iterating on routines is second nature and keeps me energized.",
        icon: "⚙️",
      },
      {
        value: "unsure",
        label: "I’m not sure yet",
        description: "I’m still learning what kind of habit structure fits me best.",
        icon: "❔",
      },
    ],
  },
  {
    key: "coach_personality",
    type: "multi_choice",
    title: "What coach energy works for you?",
    question: "Pick the personalities that help you feel supported—choose all that fit.",
    helperText: "We’ll blend these tones so each check-in feels like the right kind of nudge.",
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
        label: "Direct & candid",
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
    key: "notification_opt_in",
    type: "choice",
    title: "Would you like gentle email check-ins?",
    question: "Should your coach send a quick email when it’s time to review progress?",
    helperText: "Opt in to stay accountable—your coach can always adjust the cadence later.",
    options: [
      {
        value: "opt_in",
        label: "Yes, keep me accountable",
        description: "Send friendly reminders so I stay on top of my goals.",
        icon: "📬",
      },
      {
        value: "opt_out",
        label: "Not right now",
        description: "I’ll come back when I’m ready for email nudges.",
        icon: "🔕",
      },
    ],
  },
  {
    key: "notification_time",
    type: "multi_choice",
    title: "When should check-ins arrive?",
    question: "Pick the times of day that work best—you can tap more than one.",
    helperText: "We’ll do our best to land in your inbox when you can actually respond.",
    options: [
      {
        value: "morning",
        label: "Morning",
        description: "8–11am • Start the day with a quick alignment",
        icon: "🌅",
      },
      {
        value: "afternoon",
        label: "Afternoon",
        description: "2–5pm • Midday reset to keep momentum",
        icon: "🌤",
      },
      {
        value: "evening",
        label: "Evening",
        description: "6–9pm • Wind down and reflect before tomorrow",
        icon: "🌙",
      },
    ],
  },
  {
    key: "notification_frequency",
    type: "choice",
    title: "How often should we check in?",
    question: "Choose the cadence that feels supportive, not spammy.",
    helperText: "You can update this anytime from your profile settings.",
    options: [
      {
        value: "weekday",
        label: "Weekdays",
        description: "Monday–Friday nudges to keep momentum all week",
        icon: "📅",
      },
      {
        value: "twice_per_week",
        label: "Twice per week",
        description: "Two focused touchpoints to track progress",
        icon: "⏱",
      },
      {
        value: "weekly",
        label: "Weekly",
        description: "One thoughtful recap at the end of the week",
        icon: "🪴",
      },
    ],
  },
  {
    key: "start_conversation",
    type: "action",
    title: "You’re ready for your first conversation",
    description:
      "We’ll bring these insights into your opening chat so the coach can suggest the right goals, habits, and next steps.",
    actionDescription: "When you’re ready, we’ll start a conversation that guides you toward your first goal and supporting habits.",
    actionLabel: "Start chat with Coach",
  },
];

const mapLegacyGoalSetting = (value: string): string => {
  switch (value) {
    case "new":
      return "idea_person";
    case "experienced":
      return "achiever";
    case "struggling":
      return "go_with_flow";
    default:
      return value;
  }
};

const mapLegacyHabitConfidence = (value: string): string => {
  switch (value) {
    case "new":
      return "build_new";
    case "some_success":
      return "always_building";
    case "need_help":
      return "unsure";
    default:
      return value;
  }
};

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [, navigate] = useLocation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<OnboardingResponses>({});
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  const shouldSkipStep = useCallback(
    (stepKey: StepKey) => {
      if (stepKey === "notification_time" || stepKey === "notification_frequency") {
        return responses.notification_opt_in !== "opt_in";
      }
      return false;
    },
    [responses.notification_opt_in],
  );

  const findNextStepIndex = useCallback(
    (startIndex: number, direction: 1 | -1) => {
      let nextIndex = startIndex;
      while (true) {
        nextIndex += direction;
        if (nextIndex < 0 || nextIndex >= onboardingSteps.length) {
          return Math.min(Math.max(nextIndex, 0), onboardingSteps.length - 1);
        }
        const candidate = onboardingSteps[nextIndex];
        if (!candidate || !shouldSkipStep(candidate.key)) {
          return nextIndex;
        }
      }
    },
    [shouldSkipStep],
  );

  const currentStep = onboardingSteps[currentStepIndex];
  const visibleSteps = useMemo(
    () => onboardingSteps.filter((step) => !shouldSkipStep(step.key)),
    [shouldSkipStep],
  );
  const displayStepIndex = Math.max(visibleSteps.findIndex((step) => step.key === currentStep.key), 0);
  const displayTotalSteps = visibleSteps.length;
  const isLastStep = displayStepIndex === displayTotalSteps - 1;

  // Track onboarding started
  useEffect(() => {
    if (!hasTrackedStart) {
      analytics.trackOnboardingStarted();
      setHasTrackedStart(true);
    }
  }, [hasTrackedStart]);

  // Track step viewed
  useEffect(() => {
    if (currentStep && !shouldSkipStep(currentStep.key)) {
      analytics.trackOnboardingStepViewed(
        currentStep.key,
        displayStepIndex + 1,
        {
          step_title: currentStep.title,
          total_steps: displayTotalSteps,
        }
      );
    }
  }, [currentStep?.key, displayStepIndex, displayTotalSteps, shouldSkipStep]);

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
    if (!shouldSkipStep(currentStep.key)) {
      return;
    }
    setCurrentStepIndex((prev) => {
      const forward = findNextStepIndex(prev, 1);
      if (forward !== prev) {
        return forward;
      }
      return findNextStepIndex(prev, -1);
    });
  }, [currentStep.key, findNextStepIndex, shouldSkipStep]);

  useEffect(() => {
    if (!existingProfile || prefillApplied) return;

    const nextResponses: OnboardingResponses = {};
    if (existingProfile.goalSettingAbility) {
      nextResponses.goal_setting_ability = mapLegacyGoalSetting(existingProfile.goalSettingAbility);
    }
    if (existingProfile.habitBuildingAbility) {
      nextResponses.habit_building = mapLegacyHabitConfidence(existingProfile.habitBuildingAbility);
    }

    const storedCoachPersonality = existingProfile.coachPersonality;
    if (Array.isArray(storedCoachPersonality)) {
      nextResponses.coach_personality = storedCoachPersonality as string[];
    } else {
      const parsed = parseDelimitedValues(storedCoachPersonality);
      if (parsed.length > 0) {
        nextResponses.coach_personality = parsed;
      }
    }

    if (Array.isArray(existingProfile.focusLifeMetrics) && existingProfile.focusLifeMetrics.length > 0) {
      nextResponses.life_metrics = existingProfile.focusLifeMetrics;
    }

    if (typeof existingProfile.notificationEnabled === "boolean") {
      nextResponses.notification_opt_in = existingProfile.notificationEnabled ? "opt_in" : "opt_out";
    }

    const storedNotificationTime = existingProfile.preferredNotificationTime;
    if (Array.isArray(storedNotificationTime)) {
      nextResponses.notification_time = storedNotificationTime as string[];
    } else {
      const parsedTimes = parseDelimitedValues(storedNotificationTime);
      if (parsedTimes.length > 0) {
        nextResponses.notification_time = parsedTimes;
      }
    }

    if (existingProfile.notificationFrequency) {
      nextResponses.notification_frequency = existingProfile.notificationFrequency;
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
    const coachEnergySelections = getMultiLabels("coach_personality", ensureArray(responses.coach_personality));
    const focusAreas = Array.isArray(responses.life_metrics)
      ? getMultiLabels("life_metrics", responses.life_metrics as string[])
      : undefined;
    const notificationOptIn = responses.notification_opt_in === "opt_in";
    const notificationTimeSelections = getMultiLabels("notification_time", ensureArray(responses.notification_time));
    const notificationFrequency = typeof responses.notification_frequency === "string"
      ? getSingleLabel("notification_frequency", responses.notification_frequency)
      : undefined;

    const notificationSummaryValue = notificationOptIn
      ? [notificationFrequency, notificationTimeSelections?.join(" • ")].filter(Boolean).join(" • ")
      : undefined;

    return [
      { title: "How you approach goals", value: goalSetting },
      { title: "Habit relationship", value: habitBuilding },
      { title: "Coach energy", value: coachEnergySelections?.join(", ") },
      { title: "Focus areas", value: focusAreas?.join(", ") },
      { title: "Email check-ins", value: notificationSummaryValue },
    ].filter((item) => Boolean(item.value));
  }, [
    getMultiLabels,
    getSingleLabel,
    responses.goal_setting_ability,
    responses.habit_building,
    responses.coach_personality,
    responses.life_metrics,
    responses.notification_frequency,
    responses.notification_opt_in,
    responses.notification_time,
  ]);

  const notificationSummaryMessage = useMemo(() => {
    const resolveLabels = (key: StepKey, values: string[] | undefined) => {
      const labels = getMultiLabels(key, values);
      return labels?.map((label) => label.toLowerCase()) ?? [];
    };

    if (responses.notification_opt_in === "opt_in") {
      const times = resolveLabels("notification_time", ensureArray(responses.notification_time));
      const primaryFrequency = typeof responses.notification_frequency === "string"
        ? getSingleLabel("notification_frequency", responses.notification_frequency)?.toLowerCase()
        : undefined;
      const cadenceParts = [primaryFrequency, times.length > 0 ? `in the ${times.join(" & the ")}` : undefined]
        .filter(Boolean)
        .join(" ");
      return cadenceParts
        ? `We’ll email quick check-ins ${cadenceParts} so your coach can follow up when it matters.`
        : "We’ll email quick check-ins to keep you supported.";
    }

    if (existingProfile?.notificationEnabled) {
      const storedTimes = Array.isArray(existingProfile.preferredNotificationTime)
        ? existingProfile.preferredNotificationTime
        : parseDelimitedValues(existingProfile.preferredNotificationTime);
      const times = resolveLabels("notification_time", storedTimes);
      const frequencyLabel = existingProfile.notificationFrequency
        ? getSingleLabel("notification_frequency", existingProfile.notificationFrequency)?.toLowerCase()
        : undefined;
      const cadenceParts = [frequencyLabel, times.length > 0 ? `in the ${times.join(" & the ")}` : undefined]
        .filter(Boolean)
        .join(" ");
      return cadenceParts
        ? `Your coach will continue emailing gentle check-ins ${cadenceParts}.`
        : "Your coach will continue emailing gentle check-ins.";
    }

    return null;
  }, [
    existingProfile?.notificationEnabled,
    existingProfile?.notificationFrequency,
    existingProfile?.preferredNotificationTime,
    getMultiLabels,
    getSingleLabel,
    responses.notification_frequency,
    responses.notification_opt_in,
    responses.notification_time,
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

    navigate(`/${newThreadId}?welcome=1`);
  }, [navigate]);

  const saveOnboardingMutation = useMutation({
    mutationFn: async (payload: {
      goalSettingAbility: string | null;
      habitBuildingAbility: string | null;
      coachingStyle: string[];
      coachPersonality: string | null;
      focusLifeMetrics: string[];
      notificationEnabled: boolean | null;
      notificationFrequency: string | null;
      preferredNotificationTime: string | null;
    }) => {
      await apiRequest("/api/users/onboarding-profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      
      // Track profile saved
      analytics.trackOnboardingProfileSaved({
        goal_setting_ability: responses.goal_setting_ability,
        habit_building: responses.habit_building,
        coaching_style: responses.coach_personality,
        life_metrics: responses.life_metrics,
        notification_enabled: responses.notification_opt_in === "opt_in",
      });
      
      // Track onboarding completed
      analytics.trackOnboardingCompleted({
        total_steps_completed: displayTotalSteps,
        has_notifications: responses.notification_opt_in === "opt_in",
      });
      
      onComplete();
      try {
        await startWelcomeConversation();
      } catch (error: any) {
        console.error("[OnboardingFlow] Failed to launch welcome conversation", error);
        setSubmitError(
          error?.message ??
            "Saved your preferences, but we couldn't start the welcome chat automatically. You can open chat to continue.",
        );
        navigate("/");
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
    
    // Track step completed
    if (currentStep && !shouldSkipStep(currentStep.key)) {
      analytics.trackOnboardingStepCompleted(
        currentStep.key,
        displayStepIndex + 1,
        {
          step_title: currentStep.title,
          total_steps: displayTotalSteps,
          response: responses[currentStep.key],
        }
      );
    }
    
    setCurrentStepIndex((prev) => findNextStepIndex(prev, 1));
  };

  const handleBack = () => {
    setError(null);
    setSubmitError(null);
    setCurrentStepIndex((prev) => findNextStepIndex(prev, -1));
  };

  const handleSkip = () => {
    // Track step abandoned
    if (currentStep && !shouldSkipStep(currentStep.key)) {
      analytics.trackOnboardingStepAbandoned(
        currentStep.key,
        displayStepIndex + 1,
        {
          step_title: currentStep.title,
          total_steps: displayTotalSteps,
        }
      );
    }
    
    // Set bypass flag so user can access all screens without being forced back into onboarding
    localStorage.setItem('bypassOnboarding', 'true');
    
    // Navigate to chat screen when skipping onboarding
    navigate('/?new=1');
    onComplete();
  };

  const handleChoiceSelect = (stepKey: StepKey, value: string) => {
    if (stepKey === "notification_opt_in") {
      setResponses((prev) => {
        const next: OnboardingResponses = { ...prev, notification_opt_in: value };
        if (value === "opt_in") {
          const currentTimes = ensureArray(prev.notification_time);
          next.notification_time = currentTimes.length > 0 ? currentTimes : [DEFAULT_NOTIFICATION_TIME];
          if (typeof prev.notification_frequency !== "string") {
            next.notification_frequency = existingProfile?.notificationFrequency ?? "weekday";
          }
        } else {
          delete next.notification_time;
          delete next.notification_frequency;
        }
        return next;
      });
      setError(null);
      return;
    }

    setResponses((prev) => ({ ...prev, [stepKey]: value }));
    setError(null);
  };

  const handleMultiSelect = (stepKey: StepKey, value: string) => {
    setResponses((prev) => {
      const existing = ensureArray(prev[stepKey]);
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

    const notificationEnabled = responses.notification_opt_in === "opt_in"
      ? true
      : responses.notification_opt_in === "opt_out"
        ? false
        : null;
    const notificationFrequency = notificationEnabled
      ? (typeof responses.notification_frequency === "string" ? responses.notification_frequency : null)
      : null;
    const notificationTimeSelections = notificationEnabled ? ensureArray(responses.notification_time) : [];
    const coachPersonalitySelections = ensureArray(responses.coach_personality);

    const payload = {
      goalSettingAbility: typeof responses.goal_setting_ability === "string" ? responses.goal_setting_ability : null,
      habitBuildingAbility: typeof responses.habit_building === "string" ? responses.habit_building : null,
      coachingStyle: [],
      coachPersonality: coachPersonalitySelections.length > 0 ? coachPersonalitySelections.join(",") : null,
      focusLifeMetrics: Array.isArray(responses.life_metrics) ? (responses.life_metrics as string[]) : [],
      notificationEnabled,
      notificationFrequency,
      preferredNotificationTime:
        notificationEnabled && notificationTimeSelections.length > 0
          ? notificationTimeSelections.join(",")
          : null,
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
                    Step {displayStepIndex + 1} of {displayTotalSteps}
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
                      style={{
                        width: `${displayTotalSteps === 0 ? 0 : ((displayStepIndex + 1) / displayTotalSteps) * 100}%`,
                      }}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                      onClick={handleSubmit}
                      disabled={saveOnboardingMutation.isPending}
                      className="w-full sm:w-auto bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                    >
                      {saveOnboardingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        currentStep.actionLabel ?? "Start Chat"
                      )}
                    </Button>
                  </div>
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
                  {notificationSummaryMessage && (
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700 shadow-sm">
                      {notificationSummaryMessage}
                    </div>
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

                {currentStep.type === "action" && null}
              </div>
            
              {!isLastStep && (
                <Button 
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Skip - I'll customize later
                </Button>
              )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
