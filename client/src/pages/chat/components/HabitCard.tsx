import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";

interface Props {
  habit: { id?: string; title: string; description?: string };
  onAdd?: () => void;
}

export default function HabitCard({ habit, onAdd }: Props) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="font-medium text-gray-800">{habit.title}</div>
      {habit.description && <div className="text-sm text-gray-600 mt-0.5">{habit.description}</div>}
      <div className="mt-2">
        <Button size="sm" onClick={onAdd} className="bg-teal-600 hover:bg-teal-700">
          <CheckSquare className="w-4 h-4 mr-1" /> Add habit
        </Button>
      </div>
    </div>
  );
}


