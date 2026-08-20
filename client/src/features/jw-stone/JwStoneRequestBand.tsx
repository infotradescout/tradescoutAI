import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { jw } from "./brand";

type JwStoneRequestBandProps = {
  onStartRequest: () => void;
};

/**
 * Restrained sticky Contact CTA — hides on scroll down, shows on scroll up.
 * Page root must add matching bottom padding so inventory is never covered.
 */
export function JwStoneRequestBand({ onStartRequest }: JwStoneRequestBandProps) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y < 24) {
          setVisible(true);
        } else if (delta > 8) {
          setVisible(false);
        } else if (delta < -8) {
          setVisible(true);
        }
        lastY.current = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="jw-request"
      data-testid="jw-marketplace-request"
      aria-label="Start a Request"
      className={`fixed inset-x-0 bottom-0 z-40 bg-[var(--jw-surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px] transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-4 px-5 py-2.5 sm:px-9 sm:py-3 lg:px-12">
        <button
          type="button"
          onClick={onStartRequest}
          data-testid="jw-marketplace-connect-cta"
          aria-label="Start a Request"
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm sm:w-auto sm:min-w-[11rem] sm:shrink-0 sm:px-5 ${jw.accentCta}`}
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Start a Request
        </button>
      </div>
    </section>
  );
}
