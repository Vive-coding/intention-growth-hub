import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface ReinforcementBadgeProps {
  kind: 'new' | 'reinforce';
  relatedType?: 'insight' | 'goal' | 'habit';
  relatedTitle?: string;
  className?: string;
}

export function ReinforcementBadge({ 
  kind, 
  relatedType, 
  relatedTitle, 
  className = "" 
}: ReinforcementBadgeProps) {
  if (kind !== 'reinforce') {
    return null;
  }

  const typeLabel = relatedType ? relatedType.charAt(0).toUpperCase() + relatedType.slice(1) : 'Item';

  return (
    <div className={`flex items-center gap-2 text-xs text-gray-600 ${className}`}>
      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
        <RefreshCw className="w-3 h-3 mr-1" />
        Reinforces {typeLabel}
        {relatedTitle ? (
          <>
            : <em className="ml-1 italic">{relatedTitle}</em>
          </>
        ) : null}
      </Badge>
    </div>
  );
}
