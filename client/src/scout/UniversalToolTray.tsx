import React from "react";
import { Phone, MapPin, Calendar, Search, BookOpen, PlusCircle } from "lucide-react";

export interface ActionConfig {
  label: string;
  icon: string;
  action: string;
  primary?: boolean;
}

interface UniversalToolTrayProps {
  actions: ActionConfig[];
  onAction: (action: string) => void;
}

const IconMap: Record<string, React.ReactNode> = {
  phone: <Phone size={18} />,
  map: <MapPin size={18} />,
  calendar: <Calendar size={18} />,
  search: <Search size={18} />,
  book: <BookOpen size={18} />,
  plus: <PlusCircle size={18} />,
};

export const UniversalToolTray: React.FC<UniversalToolTrayProps> = ({ actions, onAction }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-widest text-tsTextMuted">
        <span className="w-4 h-px bg-tsTextMuted/30" />
        Universal Tool Tray
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onAction(action.action)}
            className={
              action.primary
                ? "morphic-button-primary w-full gap-2"
                : "morphic-button-secondary w-full gap-2"
            }
          >
            {IconMap[action.icon] || <PlusCircle size={18} />}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] text-tsTextMuted font-medium">
          Results curated from verified providers and the <span className="text-tsAccent">Trade Scout Community</span>
        </p>
      </div>
    </div>
  );
};
