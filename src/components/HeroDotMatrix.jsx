import { useEffect, useRef } from "react";

// Adapted from the supplied dot-matrix template: traveling waves and pointer glow.
export default function HeroDotMatrix() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, points = [], frame = 0, last = 0, time = 0;
    let visible = true, disposed = false;
    const pointer = { x: 0, y: 0, active: false };

    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        const wave = Math.sin((p.x * .8 + p.y * .6) * .0214 - time * 1.25) * .5 + .5;
        const distance = pointer.active ? Math.hypot(p.x - pointer.x, p.y - pointer.y) : 9999;
        let glow = Math.max(0, 1 - distance / 160);
        glow = glow * glow * (3 - 2 * glow);
        const radius = 1.35 * (.51 + .49 * wave) * (1 + glow * 1.6);
        const alpha = ((.25 + .75 * wave) * .34 + glow * .48) * p.fade;
        const r = Math.round(161 + (212 - 161) * glow);
        const g = Math.round(172 + (255 - 172) * glow);
        const b = Math.round(157 + (86 - 157) * glow);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    function loop(now) {
      if (disposed) return;
      if (now - last >= 32) {
        time += Math.min((now - last) / 1000, .1);
        last = now; draw();
      }
      frame = requestAnimationFrame(loop);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0;
      if (!visible || document.hidden || disposed) return;
      draw();
      if (!media.matches) { last = performance.now(); frame = requestAnimationFrame(loop); }
    }
    function resize() {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spacing = width < 640 ? 20 : 18;
      points = [];
      for (let y = (height % spacing) / 2; y < height; y += spacing) {
        for (let x = (width % spacing) / 2; x < width; x += spacing) {
          const edges = Math.min(1, x / 65, (width - x) / 65, y / 65, (height - y) / 65);
          // Keep the left copy quiet; the lower-right carries the decoration.
          points.push({ x, y, fade: Math.max(0, edges) * (.25 + .75 * Math.pow(x / width, .8)) });
        }
      }
      sync();
    }
    function move(e) {
      if (media.matches || e.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      pointer.x = e.clientX - rect.left; pointer.y = e.clientY - rect.top; pointer.active = true;
    }
    function leave() { pointer.active = false; }
    function motionChange() { leave(); sync(); }
    const resizeObserver = new ResizeObserver(resize);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resizeObserver.observe(host); observer.observe(host);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", motionChange);
    resize();
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      resizeObserver.disconnect(); observer.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync); media.removeEventListener("change", motionChange);
    };
  }, []);
  return <canvas ref={ref} className="hero-dot-matrix" aria-hidden="true" />;
}
