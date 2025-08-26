import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface GoalRow {
  goalId: string;
  goalTitle: string;
}

interface HabitTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitDefinitionId: string;
  goalRows: GoalRow[];
  defaultFrequency: "daily" | "weekly" | "monthly";
  defaultPerPeriodTarget: number;
  onSaved?: () => void;
  habitTitle?: string;
  habitDescription?: string;
}

type Frequency = "daily" | "weekly" | "monthly";

export default function HabitTargetsModal({ isOpen, onClose, habitDefinitionId, goalRows, defaultFrequency, defaultPerPeriodTarget, onSaved, habitTitle, habitDescription }: HabitTargetsModalProps) {
  const [rows, setRows] = useState<Array<{ goalId: string; goalTitle: string; frequency: Frequency; perPeriodTarget: number; periodsCount: number | "" }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initial = goalRows.map((g) => ({
      goalId: g.goalId,
      goalTitle: g.goalTitle,
      frequency: defaultFrequency,
      perPeriodTarget: defaultPerPeriodTarget || 1,
      periodsCount: "",
    }));
    setRows(initial);
  }, [isOpen, goalRows, defaultFrequency, defaultPerPeriodTarget]);

  const allValid = useMemo(() => rows.length > 0 && rows.every((r) => (r.perPeriodTarget || 0) >= 1 && Number(r.periodsCount) >= 1), [rows]);

  const applyToAll = (partial: Partial<{ frequency: Frequency; perPeriodTarget: number; periodsCount: number | "" }>) => {
    setRows((prev) => prev.map((r) => ({ ...r, ...partial })));
  };

  const handleSave = async () => {
    if (!allValid) return;
    setSaving(true);
    try {
      for (const r of rows) {
        const totalTarget = (r.perPeriodTarget || 1) * Number(r.periodsCount);
        await apiRequest(`/api/goals/${r.goalId}/habits`, {
          method: 'POST',
          body: JSON.stringify({
            habitDefinitionId,
            targetValue: totalTarget,
          }),
        });
      }
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error('Failed saving habit targets', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Set habit targets</DialogTitle>
          <DialogDescription>
            {habitTitle ? (
              <span>
                Targets for <span className="font-medium text-gray-900">{habitTitle}</span>. These settings define how this habit contributes to each selected goal.
              </span>
            ) : (
              'Choose cadence and number of periods for each goal. Total target is derived.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {habitDescription ? (
            <div className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
              {habitDescription}
            </div>
          ) : null}
          <div className="text-xs text-gray-600">{rows.length} goal{rows.length === 1 ? '' : 's'} selected • Per-goal plans for this habit</div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Button type="button" variant="outline" onClick={() => applyToAll({ frequency: "daily" })}>Daily to all</Button>
            <Button type="button" variant="outline" onClick={() => applyToAll({ frequency: "weekly" })}>Weekly to all</Button>
            <Button type="button" variant="outline" onClick={() => applyToAll({ frequency: "monthly" })}>Monthly to all</Button>
            <Button type="button" variant="outline" onClick={() => applyToAll({ perPeriodTarget: 1 })}>1 per period to all</Button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {rows.map((r, idx) => {
              const unit = r.frequency === 'daily' ? 'days' : r.frequency === 'weekly' ? 'weeks' : 'months';
              const total = (r.perPeriodTarget || 0) * (Number(r.periodsCount) || 0);
              return (
                <div key={r.goalId} className="rounded-md border p-3 bg-white">
                  <div className="font-medium mb-2">{r.goalTitle} <span className="ml-1 text-xs text-gray-500">(plan for this habit)</span></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Frequency</Label>
                      <Select value={r.frequency} onValueChange={(val: Frequency) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, frequency: val } : row))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Target per period</Label>
                      <Input type="number" min={1} value={r.perPeriodTarget} onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, perPeriodTarget: Number(e.target.value) } : row))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Number of {unit}</Label>
                      <Input type="number" min={1} value={r.periodsCount} onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, periodsCount: e.target.value === '' ? '' : Number(e.target.value) } : row))} />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">{r.perPeriodTarget || 0} per {r.frequency} × {Number(r.periodsCount) || 0} {unit} = <span className="font-medium">{total}</span> total</div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={!allValid || saving}>{saving ? 'Saving…' : 'Save targets and add habit to goals'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


