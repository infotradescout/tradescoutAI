import React from "react";
import { Home, LayoutGrid, Bookmark, User, Plus, Search } from "lucide-react";

interface SystemAnchorProps {
  currentMode: string;
  onNavigate: (view: string) => void;
}

export const SystemAnchor: React.FC<SystemAnchorProps> = ({ currentMode, onNavigate }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-10 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <div className="max-w-2xl mx-auto relative pointer-events-auto">
        {/* Command Bar */}
        <div className="morphic-glass rounded-2xl p-2 flex items-center gap-3 shadow-2xl mb-4 border-tsAccent/20">
          <div className="w-10 h-10 rounded-xl bg-tsSurface border border-tsBorder flex items-center justify-center text-tsAccent">
            <img src="/tradescout-logo.png" alt="Scout" className="w-6 h-6 opacity-80" />
          </div>
          <div className="flex-1 text-tsTextMuted text-sm font-medium px-2">
            Open Scout and ask anything...
          </div>
          <div className="flex items-center gap-2 pr-1">
            <button className="p-2 text-tsTextMuted hover:text-tsTextMain transition-colors">
              <Search size={20} />
            </button>
            <button className="w-10 h-10 rounded-xl bg-tsAccent text-white flex items-center justify-center shadow-lg shadow-tsAccent/20">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="morphic-glass rounded-2xl px-6 py-3 flex items-center justify-between border-tsBorder/50">
          <NavItem
            icon={<Home size={20} />}
            label="Home"
            active={currentMode === "home"}
            onClick={() => onNavigate("home")}
          />
          <NavItem
            icon={<LayoutGrid size={20} />}
            label="Directory"
            active={currentMode === "directory"}
            onClick={() => onNavigate("directory")}
          />

          <div className="flex flex-col items-center -mt-8">
            <div className="w-12 h-12 rounded-full bg-tsBg border-2 border-tsAccent flex items-center justify-center shadow-lg shadow-tsAccent/20">
              <div className="w-6 h-6 rounded-full border-2 border-tsAccent flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-tsAccent" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-tsAccent uppercase tracking-tighter mt-1">
              Scout OS
            </span>
          </div>

          <NavItem
            icon={<Bookmark size={20} />}
            label="Saved"
            active={currentMode === "saved"}
            onClick={() => onNavigate("saved")}
          />
          <NavItem
            icon={<User size={20} />}
            label="Profile"
            active={currentMode === "profile"}
            onClick={() => onNavigate("profile")}
          />
        </div>

        <div className="mt-4 flex justify-center">
          <div className="w-32 h-1 bg-tsAccent/20 rounded-full overflow-hidden">
            <div className="w-1/3 h-full bg-tsAccent rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${active ? "text-tsAccent" : "text-tsTextMuted hover:text-tsTextMain"}`}
  >
    {icon}
    <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);
