import React from "react";
import { Fuel, Navigation, History, AlertTriangle } from "lucide-react";

export interface GasStation {
  id: string;
  name: string;
  address: string;
  price: string;
  distance: string;
  rating: number;
  reportCount: number;
  isCheapest?: boolean;
}

interface GasTrackerModuleProps {
  data: {
    title: string;
    trend: string;
    stations: GasStation[];
  };
}

export const GasTrackerModule: React.FC<GasTrackerModuleProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-tsAccent" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-tsTextMuted">
            {data.title || "Price Comparison"}
          </h2>
        </div>
        <div className="text-[10px] font-bold text-tsTextMuted uppercase tracking-tighter">
          Sort by: <span className="text-tsTextMain">Price</span>
        </div>
      </div>

      <div className="morphic-card p-4 bg-tsAccent/5 border-tsAccent/20 flex items-center gap-4 mb-4">
         <div className="p-2 rounded-lg bg-tsAccent/10 text-tsAccent">
           <AlertTriangle size={20} />
         </div>
         <p className="text-sm text-tsTextMain font-medium leading-snug">
           {data.trend}
         </p>
      </div>

      {data.stations.map((station) => (
        <div key={station.id} className="morphic-card p-4 flex justify-between items-center group cursor-pointer">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-tsSurface border border-tsBorder flex items-center justify-center font-bold text-tsAccent">
              {station.name[0]}
            </div>
            <div>
              <h4 className="text-tsTextMain font-bold text-base">{station.name}</h4>
              <p className="text-tsTextMuted text-[11px] mb-1">{station.address}</p>
              <div className="flex items-center gap-3 text-[10px] text-tsTextMuted">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= station.rating ? 'bg-tsAccent' : 'bg-tsSurface border border-tsBorder'}`} />
                  ))}
                </div>
                <span>{station.reportCount} reports this week</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {station.isCheapest && (
              <div className="morphic-status-badge success mb-2">
                Cheapest
              </div>
            )}
            <div className="text-[10px] text-tsTextMuted uppercase font-bold tracking-wider">Regular</div>
            <div className="text-2xl font-display font-bold text-tsTextMain">${station.price}</div>
            <div className="text-[11px] text-tsTextMuted flex items-center justify-end gap-1 mt-1">
               <Navigation size={10} />
               {station.distance}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
