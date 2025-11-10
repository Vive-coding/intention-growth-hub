import { clsx } from "clsx";
import { BookOpen, MessageCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className = "" }: ModeToggleProps) {
  const [loc] = useLocation();
  const [path] = loc.split("?");
  const currentPath = path || "/";
  const isJournal = currentPath.startsWith("/journal");
  const isChat = !isJournal;

  const baseClasses =
    "w-9 h-9 flex items-center justify-center rounded-full border transition-colors";

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Link href="/?new=1">
        <div
          className={clsx(
            baseClasses,
            isChat
              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
              : "border-gray-200 text-gray-500 hover:bg-gray-100"
          )}
          title="Chat"
        >
          <MessageCircle className="w-5 h-5" />
        </div>
      </Link>
      <Link href="/journal">
        <div
          className={clsx(
            baseClasses,
            isJournal
              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
              : "border-gray-200 text-gray-500 hover:bg-gray-100"
          )}
          title="Journal"
        >
          <BookOpen className="w-5 h-5" />
        </div>
      </Link>
    </div>
  );
}

