import React from "react";
import { ShieldCheck, MapPin, Clock, ChevronRight } from "lucide-react";

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  status: "OPEN" | "CLOSED";
  statusText: string;
  distance: string;
  features: string[];
  isTopRecommendation?: boolean;
}

interface ServiceDirectoryModuleProps {
  data: {
    title: string;
    services: ServiceItem[];
  };
}

export const ServiceDirectoryModule: React.FC<ServiceDirectoryModuleProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-tsAccent rounded-sm" />
            ))}
          </div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-tsTextMuted">
            {data.title || "Service Directory"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-tsAccent animate-pulse" />
          <span className="text-[10px] font-bold text-tsAccent uppercase tracking-tighter">
            Live Results
          </span>
        </div>
      </div>

      {data.services.map((service) => (
        <div
          key={service.id}
          className={`morphic-card p-4 flex gap-4 items-center group cursor-pointer ${service.isTopRecommendation ? "border-tsAccent/30 ring-1 ring-tsAccent/10" : ""}`}
        >
          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-tsSurface border border-tsBorder flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-tsAccent/40 rounded-lg flex items-center justify-center">
              <div className="w-4 h-0.5 bg-tsAccent/60 rotate-45" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {service.isTopRecommendation && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-tsAccent uppercase tracking-widest mb-1">
                <ShieldCheck size={10} />
                Top Recommendation
              </div>
            )}
            <h4 className="text-tsTextMain font-bold text-base truncate mb-0.5">{service.name}</h4>
            <p className="text-tsTextMuted text-xs mb-2">{service.category}</p>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`morphic-status-badge ${service.status === "OPEN" ? "success" : "warning"}`}
              >
                {service.statusText}
              </div>
              <div className="flex items-center gap-1 text-xs text-tsTextMuted">
                <ShieldCheck size={12} className="text-tsAccent" />
                <span className="font-bold text-tsTextMain">{service.reviewCount}</span>
                <span>recommendations</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-tsTextMuted border-t border-tsBorder pt-3">
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                {service.distance}
              </div>
              {service.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-tsTextMuted/50" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-tsSurface border border-tsBorder flex items-center justify-center group-hover:border-tsAccent/50 transition-colors">
            <ChevronRight size={18} className="text-tsTextMuted group-hover:text-tsAccent" />
          </div>
        </div>
      ))}
    </div>
  );
};
