import React from "react";
import { Calendar, MapPin, Users, Bookmark, Filter } from "lucide-react";

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  time: string;
  location: string;
  rating: number;
  imageUrl: string;
  tags: string[];
}

interface EventDiscoveryModuleProps {
  data: {
    title: string;
    locationLabel: string;
    events: CommunityEvent[];
  };
}

export const EventDiscoveryModule: React.FC<EventDiscoveryModuleProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-tsAccent" />
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-tsTextMuted leading-none">
              {data.title || "Event Discovery"}
            </h2>
            <p className="text-[10px] text-tsTextMuted mt-1">{data.locationLabel}</p>
          </div>
        </div>
        <button className="morphic-button-secondary min-h-0 py-1.5 px-3 text-[10px] gap-1.5">
          <Filter size={12} />
          Filter
        </button>
      </div>

      {data.events.map((event) => (
        <div key={event.id} className="morphic-card group cursor-pointer">
          <div className="relative h-40 overflow-hidden">
            <img 
              src={event.imageUrl || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80"} 
              alt={event.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-tsAccent" />
                <span className="text-[10px] font-bold text-white">{event.rating}</span>
              </div>
            </div>
            <button className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-tsAccent transition-colors">
              <Bookmark size={16} />
            </button>
          </div>
          
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-tsTextMain font-bold text-lg leading-tight flex-1">{event.title}</h4>
            </div>
            <p className="text-tsTextMuted text-xs mb-4 line-clamp-2">{event.description}</p>
            
            <div className="grid grid-cols-2 gap-4 border-t border-tsBorder pt-4">
               <div className="flex items-center gap-2 text-[11px] text-tsTextMuted">
                 <Clock size={14} className="text-tsAccent" />
                 <span>Time: <span className="text-tsTextMain font-medium">{event.time}</span></span>
               </div>
               <div className="flex items-center gap-2 text-[11px] text-tsTextMuted">
                 <MapPin size={14} className="text-tsAccent" />
                 <span>Location: <span className="text-tsTextMain font-medium">{event.location}</span></span>
               </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2">
              {event.tags.map((tag, i) => (
                <span key={i} className="morphic-status-badge success bg-tsAccent/5 text-tsAccent border-tsAccent/10">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Clock = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
