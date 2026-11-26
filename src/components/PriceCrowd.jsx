import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function PriceCrowd({ priceId, enabled }) {
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!enabled || !hostRef.current || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !visible || !supabase) return undefined;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc("track_price_view", { p_price_id: Number(priceId) });
      if (error) {
        console.warn("Could not update live price viewers:", error);
        return;
      }
      if (active) setCount(Number(data));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, priceId, visible]);

  if (!enabled) return null;
  return <p ref={hostRef} className="mt-2 text-xs text-gray-600" aria-live="polite">
    {count === null ? "Live viewers appear here for signed-in users." : `${count} ${count === 1 ? "person" : "people"} dey check this price now`}
  </p>;
}
