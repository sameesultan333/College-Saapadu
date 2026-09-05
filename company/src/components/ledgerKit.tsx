/**
 * Shared motion primitives for the ledger-themed console pages
 * (ManagersPage, CollegePage, Layout). Extracted so each page stops
 * redeclaring its own copy of the same three things.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { HAIR_SOFT } from "../theme/ledger";

export const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Spins its icon child — used on the one loading button per form. */
export function Spin({ children }: { children: ReactElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const a = ref.current.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: 900,
      iterations: Infinity,
      easing: "linear",
    });
    return () => a.cancel();
  }, []);
  return (
    <span ref={ref} style={{ display: "inline-flex" }} aria-hidden="true">
      {children}
    </span>
  );
}

/** One shimmering ledger line — used in every boot skeleton. */
export function SkeletonLine({ width, delay }: { width: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const a = ref.current.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
      duration: 1400,
      iterations: Infinity,
      delay,
      easing: "ease-in-out",
    });
    return () => a.cancel();
  }, [delay]);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ width, height: 10, backgroundColor: HAIR_SOFT, borderRadius: 0 }}
    />
  );
}
