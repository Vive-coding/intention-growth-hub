import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface NotificationSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const FREQUENCY_OPTIONS: Array<{ value: "daily" | "every_2_days" | "weekly"; label: string; description: string }> = [
  { value: "daily", label: "Daily check-ins", description: "Quick encouragement every day" },
  { value: "every_2_days", label: "Every 2 days", description: "Balanced reminders to stay on track" },
  { value: "weekly", label: "Weekly review", description: "A gentle nudge once a week" },
];

const TIME_OPTIONS: Array<{ value: "morning" | "afternoon" | "evening"; label: string }> = [
  { value: "morning", label: "Morning (8-10 AM)" },
  { value: "afternoon", label: "Afternoon (2-4 PM)" },
  { value: "evening", label: "Evening (6-8 PM)" },
];

export function NotificationSetupModal({ open, onClose, onSaved }: NotificationSetupModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "every_2_days" | "weekly">("daily");
  const [preferredTime, setPreferredTime] = useState<"morning" | "afternoon" | "evening">("morning");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [prefillApplied, setPrefillApplied] = useState(false);

  const { data: onboardingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/users/onboarding-profile"],
    queryFn: async () => {
      const resp = await apiRequest("/api/users/onboarding-profile");
      return resp || {};
    },
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setPrefillApplied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !onboardingProfile || prefillApplied) {
      return;
    }

    const isEnabled = Boolean(onboardingProfile.notificationEnabled);
    setEnabled(isEnabled);

    const savedFrequency = (onboardingProfile.notificationFrequency || "daily") as "daily" | "every_2_days" | "weekly";
    setFrequency(FREQUENCY_OPTIONS.some((option) => option.value === savedFrequency) ? savedFrequency : "daily");

    const rawPreferredTime = Array.isArray(onboardingProfile.preferredNotificationTime)
      ? onboardingProfile.preferredNotificationTime[0] ?? "morning"
      : typeof onboardingProfile.preferredNotificationTime === "string"
        ? onboardingProfile.preferredNotificationTime.split(",")[0]?.trim() || "morning"
        : "morning";
    const savedTime = rawPreferredTime as "morning" | "afternoon" | "evening";
    setPreferredTime(TIME_OPTIONS.some((option) => option.value === savedTime) ? savedTime : "morning");

    setPhoneNumber(onboardingProfile.phoneNumber ?? "");
    setPrefillApplied(true);
  }, [open, onboardingProfile, prefillApplied]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/users/notification-preferences", {
        method: "POST",
        body: JSON.stringify({
          enabled,
          frequency,
          preferredTime,
          phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        }),
      });
    },
    onSuccess: async () => {
      toast({
        title: enabled ? "Reminders enabled" : "Reminders skipped for now",
        description: enabled
          ? "We'll check in based on the schedule you picked."
          : "All set. You can turn reminders on anytime from settings.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/users/onboarding-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onSaved?.();
    },
    onError: (error: any) => {
      toast({
        title: "Could not save preferences",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (mutation.isPending) return;
    mutation.mutate();
  };

  const saveLabel = useMemo(() => (enabled ? "Save preferences" : "Skip for now"), [enabled]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stay on track</DialogTitle>
          <DialogDescription>
            Pick how you’d like your coach to nudge you. We’ll only send thoughtful reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Enable reminders</p>
              <p className="text-sm text-slate-600">Turn on gentle check-ins from your coach.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isLoadingProfile || mutation.isPending} />
          </div>

          {enabled && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">How often?</Label>
                <RadioGroup value={frequency} onValueChange={(value: "daily" | "every_2_days" | "weekly") => setFrequency(value)}>
                  <div className="grid gap-3">
                    {FREQUENCY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-emerald-400"
                      >
                        <RadioGroupItem value={option.value} />
                        <div>
                          <p className="font-medium text-slate-900">{option.label}</p>
                          <p className="text-sm text-slate-500">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Preferred time of day</Label>
                <Select value={preferredTime} onValueChange={(value: "morning" | "afternoon" | "evening") => setPreferredTime(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time window" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Phone number (optional)</Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  disabled={mutation.isPending}
                />
                <p className="text-xs text-slate-500">We’ll text you to start a check-in conversation.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Maybe later
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

