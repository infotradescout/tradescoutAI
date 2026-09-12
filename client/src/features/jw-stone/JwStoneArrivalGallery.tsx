import { useState } from "react";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";

export function JwStoneArrivalGallery({ item }: { item: PublicStoneInventoryItem }) {
  const [selected, setSelected] = useState(0);
  const image = item.imageUrls[selected] || item.imageUrls[0];
  if (!image) return null;
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden bg-[var(--jw-dark)]">
        <img src={image} alt={`${item.materialName}, lot photo ${selected + 1}`} loading="lazy" decoding="async" className="h-full w-full object-contain" />
      </div>
      {item.imageUrls.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3" role="group" aria-label={`${item.materialName} lot photos`}>
          {item.imageUrls.map((url, index) => (
            <button key={url} type="button" aria-label={`Show photo ${index + 1} of ${item.imageUrls.length}`} aria-pressed={index === selected} onClick={() => setSelected(index)} className="h-16 min-w-16 shrink-0 rounded border-2 border-transparent p-1 aria-pressed:border-[var(--jw-accent)]">
              <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
