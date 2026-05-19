import { useEffect, useEffectEvent, useRef, useState } from "react";

const SWIPE_THRESHOLD = 120;
const EXIT_DURATION_MS = 220;
const RETURN_DURATION_MS = 180;

export function useSwipeDeck({ onVote, disabled = false }) {
  const pointerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const pendingRef = useRef({ x: 0, y: 0, phase: "idle" });
  const frameRef = useRef(0);
  const settleTimeoutRef = useRef(0);
  const swipeTimeoutRef = useRef(0);
  const animatingRef = useRef(false);
  const voteEvent = useEffectEvent(onVote);
  const [drag, setDrag] = useState({ x: 0, y: 0, phase: "idle" });

  function flushDrag() {
    frameRef.current = 0;
    setDrag(pendingRef.current);
  }

  function scheduleDrag(nextDrag) {
    pendingRef.current = nextDrag;
    if (frameRef.current) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(flushDrag);
  }

  function clearTimers() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = 0;
    }

    if (swipeTimeoutRef.current) {
      window.clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = 0;
    }
  }

  function resetImmediately() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    const idleDrag = { x: 0, y: 0, phase: "idle" };
    dragRef.current = { x: 0, y: 0 };
    pendingRef.current = idleDrag;
    setDrag(idleDrag);
  }

  function resetCard() {
    clearTimers();
    animatingRef.current = true;
    dragRef.current = { x: 0, y: 0 };
    scheduleDrag({ x: 0, y: 0, phase: "settling" });

    settleTimeoutRef.current = window.setTimeout(() => {
      animatingRef.current = false;
      scheduleDrag({ x: 0, y: 0, phase: "idle" });
    }, RETURN_DURATION_MS);
  }

  function swipe(direction) {
    if (disabled || animatingRef.current) {
      return;
    }

    clearTimers();
    animatingRef.current = true;
    pointerRef.current = null;

    const exitDistance = Math.max(window.innerWidth * 0.95, 520);
    const exitX = direction === "like" ? exitDistance : -exitDistance;
    const exitY = dragRef.current.y * 0.08;

    dragRef.current = { x: exitX, y: exitY };
    scheduleDrag({ x: exitX, y: exitY, phase: "exit" });

    swipeTimeoutRef.current = window.setTimeout(() => {
      resetImmediately();
      animatingRef.current = false;
      voteEvent(direction);
    }, EXIT_DURATION_MS);
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!pointerRef.current || disabled || animatingRef.current) {
        return;
      }

      const deltaX = (event.clientX - pointerRef.current.startX) * 0.96;
      const deltaY = (event.clientY - pointerRef.current.startY) * 0.16;

      dragRef.current = { x: deltaX, y: deltaY };
      scheduleDrag({ x: deltaX, y: deltaY, phase: "dragging" });
    }

    function handlePointerUp() {
      if (!pointerRef.current || disabled || animatingRef.current) {
        return;
      }

      const finalX = dragRef.current.x;
      pointerRef.current = null;

      if (finalX >= SWIPE_THRESHOLD) {
        swipe("like");
        return;
      }

      if (finalX <= -SWIPE_THRESHOLD) {
        swipe("pass");
        return;
      }

      resetCard();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      clearTimers();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [disabled]);

  function handlePointerDown(event) {
    const target = event.target;
    const isInteractiveControl =
      target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label"));

    if (disabled || animatingRef.current || event.button > 0 || isInteractiveControl) {
      return;
    }

    pointerRef.current = {
      startX: event.clientX,
      startY: event.clientY,
    };

    dragRef.current = { x: 0, y: 0 };
    scheduleDrag({ x: 0, y: 0, phase: "dragging" });
  }

  return {
    drag,
    likeStrength: Math.max(0, drag.x / SWIPE_THRESHOLD),
    passStrength: Math.max(0, (drag.x * -1) / SWIPE_THRESHOLD),
    handlePointerDown,
    triggerSwipe: swipe,
  };
}
