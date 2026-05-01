import React, { useRef, useEffect } from 'react';

const CircleAreaDemo = ({ r, s, isMoved }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const progressRef = useRef(isMoved ? 1 : 0);
  const targetRef = useRef(isMoved ? 1 : 0);

  // View transform (user pan/zoom on top of fit transform)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const lastPinchRef = useRef(null);

  useEffect(() => {
    targetRef.current = isMoved ? 1 : 0;
  }, [isMoved]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const getCSSVar = (name) => {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // ===== Pan & Zoom handlers =====
    const getCanvasPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onWheel = (e) => {
      e.preventDefault();
      const pos = getCanvasPos(e.clientX, e.clientY);
      const view = viewRef.current;

      // Pinch-zoom on trackpad sends ctrlKey
      if (e.ctrlKey) {
        const zoomFactor = Math.exp(-e.deltaY * 0.01);
        const newScale = Math.max(0.1, Math.min(20, view.scale * zoomFactor));
        // Zoom around cursor: keep point under cursor stationary
        view.x = pos.x - (pos.x - view.x) * (newScale / view.scale);
        view.y = pos.y - (pos.y - view.y) * (newScale / view.scale);
        view.scale = newScale;
      } else {
        // Two-finger pan
        view.x -= e.deltaX;
        view.y -= e.deltaY;
      }
    };

    const onPointerDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        lastPinchRef.current = {
          dist: Math.hypot(dx, dy),
          mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        };
      }
    };

    const onPointerMove = (e) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      const prev = pointersRef.current.get(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const view = viewRef.current;

      if (pointersRef.current.size === 1) {
        // Pan
        view.x += e.clientX - prev.x;
        view.y += e.clientY - prev.y;
      } else if (pointersRef.current.size === 2) {
        // Pinch zoom + pan
        const pts = Array.from(pointersRef.current.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const midCanvas = getCanvasPos(mid.x, mid.y);

        if (lastPinchRef.current) {
          const zoomFactor = dist / lastPinchRef.current.dist;
          const newScale = Math.max(0.1, Math.min(20, view.scale * zoomFactor));
          view.x = midCanvas.x - (midCanvas.x - view.x) * (newScale / view.scale);
          view.y = midCanvas.y - (midCanvas.y - view.y) * (newScale / view.scale);
          view.scale = newScale;

          // Pan by midpoint movement
          const lastMidCanvas = getCanvasPos(lastPinchRef.current.mid.x, lastPinchRef.current.mid.y);
          view.x += midCanvas.x - lastMidCanvas.x;
          view.y += midCanvas.y - lastMidCanvas.y;
        }
        lastPinchRef.current = { dist, mid };
      }
    };

    const onPointerUp = (e) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) lastPinchRef.current = null;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    const draw = () => {
      const accent = getCSSVar('--accent');
      const accentDim = getCSSVar('--accent-dim');

      // Smooth animation
      const diff = targetRef.current - progressRef.current;
      if (Math.abs(diff) > 0.001) {
        progressRef.current += diff * 0.08;
      } else {
        progressRef.current = targetRef.current;
      }

      const t = progressRef.current;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;

      ctx.clearRect(0, 0, cssW, cssH);

      const rectW = Math.PI * r;
      const rectH = r;

      const padding = 20;
      const neededW = Math.max(2 * r, rectW) + padding * 2;
      const neededH = 2 * r + padding * 2;

      const fitScale = Math.min(cssW / neededW, cssH / neededH);
      const view = viewRef.current;

      ctx.save();
      // Apply user pan/zoom
      ctx.translate(view.x, view.y);
      ctx.scale(view.scale, view.scale);
      // Apply fit centering
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(fitScale, fitScale);

      const totalScale = fitScale * view.scale;
      const segAngle = (Math.PI * 2) / s;


      for (let i = 0; i < s; i++) {
        const angleStart = i * segAngle - Math.PI / 2;
        const angleMid = angleStart + segAngle / 2;

        const baseLen = r * segAngle;
        const isFlipped = i % 2 === 1;

        const rectX = -rectW / 2 + (i * baseLen) / 2;

        const c_apex = { x: 0, y: 0 };
        const c_bl = { x: r * Math.cos(angleStart), y: r * Math.sin(angleStart) };
        const c_br = { x: r * Math.cos(angleStart + segAngle), y: r * Math.sin(angleStart + segAngle) };

        let r_apex, r_bl, r_br;
        if (!isFlipped) {
          r_bl = { x: rectX, y: rectH / 2 };
          r_br = { x: rectX + baseLen, y: rectH / 2 };
          r_apex = { x: rectX + baseLen / 2, y: -rectH / 2 };
        } else {
          r_bl = { x: rectX + baseLen, y: -rectH / 2 };
          r_br = { x: rectX, y: -rectH / 2 };
          r_apex = { x: rectX + baseLen / 2, y: rectH / 2 };
        }

        const lerp = (a, b, t) => a + (b - a) * t;
        const lerpPt = (p1, p2, t) => ({ x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) });

        const apex = lerpPt(c_apex, r_apex, eased);
        const bl = lerpPt(c_bl, r_bl, eased);
        const br = lerpPt(c_br, r_br, eased);

        ctx.fillStyle = accent;
        ctx.strokeStyle = accentDim;
        ctx.lineWidth = 2 / totalScale;

        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        ctx.lineTo(bl.x, bl.y);

        if (eased < 0.01) {
          ctx.arc(0, 0, r, angleStart, angleStart + segAngle);
        } else if (eased > 0.99) {
          ctx.lineTo(br.x, br.y);
        } else {
          const arcMid_c = { x: r * Math.cos(angleMid), y: r * Math.sin(angleMid) };
          const lineMid_r = { x: (r_bl.x + r_br.x) / 2, y: (r_bl.y + r_br.y) / 2 };
          const mid = lerpPt(arcMid_c, lineMid_r, eased);
          const cp = { x: 2 * mid.x - (bl.x + br.x) / 2, y: 2 * mid.y - (bl.y + br.y) / 2 };
          ctx.quadraticCurveTo(cp.x, cp.y, br.x, br.y);
        }

        ctx.lineTo(apex.x, apex.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
        if (eased > 0) {
        ctx.save();
        ctx.globalAlpha = eased;
        ctx.strokeStyle = accentDim;
        ctx.lineWidth = 2 / totalScale;
        ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
        ctx.restore();
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [r, s]);

  return <canvas ref={canvasRef} className="w-full h-full block touch-none cursor-grab active:cursor-grabbing absolute top-0 left-0" />;
};

export default CircleAreaDemo;