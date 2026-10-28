import { useEffect, useRef } from "react";
import { mountBackground } from "../effects/cardscape-runtime";
import { mosaic, gradient, network, configurations } from "../effects/cardscape-templates";
import { silk, silkConfig } from "../effects/silk";

const effects = { mosaic, gradient, network, silk };
export default function ServiceCardEffect({ type }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const controller = mountBackground(canvas, effects[type], { ...(type === "silk" ? silkConfig : configurations[type]), animate: false }, { pixelRatio: Math.min(devicePixelRatio || 1, 1.5) });
    const sync = () => controller.update({ animate: visible && !document.hidden && !motion.matches });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      observer.disconnect(); controller.destroy();
      document.removeEventListener("visibilitychange", sync); motion.removeEventListener("change", sync);
    };
  }, [type]);
  return <canvas ref={ref} className="service-effect" aria-hidden="true" />;
}
