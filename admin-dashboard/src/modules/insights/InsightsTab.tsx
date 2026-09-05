import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChefHat, ClipboardList, IndianRupee, Info, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";

interface Prediction {
  name: string;
  confidence: string;
  currentStock: number;
  recommendedStock: number;
  avgDailySales: number;
  estimatedWaste: number;
  potentialLoss: number;
}

interface InsightsTabProps {
  predictions: Prediction[];
  performanceMetrics: unknown;
  formatCurrency: (value: number) => string;
}

/* ------------------------------------------------------------------ */
/* Motion — WAAPI replaces @keyframes; guarded because the theme-wide  */
/* prefers-reduced-motion rule only reaches CSS @keyframes animations, */
/* not JS-driven WAAPI ones like Reveal below.                         */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Reveal({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 280, delay, easing: "cubic-bezier(0, 0, 0.2, 1)", fill: "backwards" }
    );
    return () => animation.cancel();
  }, [delay]);

  return <div ref={ref} style={{ minWidth: 0 }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Confidence — original logic lowercased the label; unknown values    */
/* fall back to a neutral badge instead of an unstyled one.            */
/* ------------------------------------------------------------------ */

type ConfidenceTone = "high" | "medium" | "low" | "neutral";

const CONFIDENCE_TONES: Record<string, ConfidenceTone> = {
  high: "high",
  medium: "medium",
  low: "low",
};

const confidenceTone = (confidence: string): ConfidenceTone =>
  CONFIDENCE_TONES[confidence.toLowerCase()] ?? "neutral";

const confidenceBadgeStyle = (tone: ConfidenceTone): CSSProperties => ({
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: "var(--bc-radius-pill)",
  fontSize: "var(--bc-font-size-caption)",
  fontWeight: 600,
  whiteSpace: "nowrap",
  backgroundColor:
    tone === "high"
      ? "var(--bc-color-success-bg)"
      : tone === "medium"
        ? "var(--bc-color-warning-bg)"
        : tone === "low"
          ? "var(--bc-color-danger-bg)"
          : "var(--bc-color-neutral-bg)",
  color:
    tone === "high"
      ? "var(--bc-color-success-strong)"
      : tone === "medium"
        ? "var(--bc-color-warning)"
        : tone === "low"
          ? "var(--bc-color-danger)"
          : "var(--bc-color-neutral-text)",
});
const confidenceDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "currentColor",
  opacity: 0.85,
};

/* ------------------------------------------------------------------ */
/* Stock-gap bars — normalize against the larger of the two values so  */
/* the pair is always comparable (and divide-by-zero is impossible).   */
/* ------------------------------------------------------------------ */

const barTrack: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};
const barRowHead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
};
const barLabel: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  color: "var(--bc-color-text-muted)",
};
const barValue = (strong: boolean): CSSProperties => ({
  fontSize: strong ? "var(--bc-font-size-body)" : "var(--bc-font-size-secondary)",
  fontWeight: strong ? 700 : 600,
  fontVariantNumeric: "tabular-nums",
  color: strong ? "var(--bc-color-brand-primary)" : "var(--bc-color-text-primary)",
});
const barRail: CSSProperties = {
  height: 8,
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-surface-sunken)",
  overflow: "hidden",
};
const barFill = (pct: number, color: string): CSSProperties => ({
  display: "block",
  height: "100%",
  width: `${Math.max(2, Math.min(100, pct))}%`,
  borderRadius: "inherit",
  backgroundColor: color,
  transition: "width var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)",
});

/* ------------------------------------------------------------------ */
/* Alert rows — same two conditions as the original, refined surface   */
/* ------------------------------------------------------------------ */

const alertStyle = (tone: "warn" | "idea"): CSSProperties => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-8) var(--bc-space-12)",
  borderRadius: "var(--bc-radius-md)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
  lineHeight: "var(--bc-line-height-normal)",
  backgroundColor: tone === "warn" ? "var(--bc-color-warning-bg)" : "var(--bc-color-brand-accent-soft)",
  borderLeft: `3px solid ${tone === "warn" ? "var(--bc-color-warning-light)" : "var(--bc-color-brand-accent)"}`,
  color: tone === "warn" ? "var(--bc-color-warning)" : "var(--bc-color-brand-accent-strong)",
});
const alertIcon: CSSProperties = { flex: "none", marginTop: 1 };

/* ------------------------------------------------------------------ */
/* Static styles                                                       */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-24)", minWidth: 0 };

const HEAD: CSSProperties = { display: "grid", gap: "var(--bc-space-4)" };
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-brand-accent-strong)",
};
const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-page-heading)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-primary)",
};
const SUBTITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
};

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

/* Action strip — the tab's answer to "what do I do today?" */
const STRIP: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
  gap: "var(--bc-space-card-gap)",
};
const STRIP_ITEM: CSSProperties = {
  ...CARD,
  display: "grid",
  gap: "var(--bc-space-8)",
  alignContent: "start",
  padding: "var(--bc-space-card-padding)",
};
const STRIP_TOP: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 };
const STRIP_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 30,
  height: 30,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const STRIP_ICON_ALERT: CSSProperties = {
  backgroundColor: "var(--bc-color-warning-bg)",
  color: "var(--bc-color-warning)",
};
const STRIP_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 500,
  color: "var(--bc-color-text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const STRIP_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-metric)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tighter)",
  lineHeight: "var(--bc-line-height-tight)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 330px), 1fr))",
  gap: "var(--bc-space-card-gap)",
  alignItems: "start",
};

const PRED_CARD: CSSProperties = {
  ...CARD,
  display: "grid",
  gap: "var(--bc-space-16)",
  padding: "var(--bc-space-card-padding)",
};
const CARD_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
};
const CARD_TITLE: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const BARS: CSSProperties = { display: "grid", gap: "var(--bc-space-8)" };
const SALES_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
  paddingTop: "var(--bc-space-8)",
  borderTop: "1px dashed var(--bc-color-border-subtle)",
};
const SALES_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
};
const CARD_ALERTS: CSSProperties = { display: "grid", gap: "var(--bc-space-8)" };

/* Empty / methodology */
const EMPTY: CSSProperties = {
  ...CARD,
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-56) var(--bc-space-24)",
  textAlign: "center",
};
const EMPTY_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const EMPTY_TITLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-section-heading)",
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
};
const EMPTY_BODY: CSSProperties = {
  margin: 0,
  maxWidth: "42ch",
  fontSize: "var(--bc-font-size-body)",
  color: "var(--bc-color-text-muted)",
};
const NOTE: CSSProperties = {
  ...CARD,
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-12) var(--bc-space-16)",
  backgroundColor: "var(--bc-color-surface-page-alt)",
  color: "var(--bc-color-text-muted)",
  fontSize: "var(--bc-font-size-secondary)",
  lineHeight: "var(--bc-line-height-normal)",
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

// Extracted verbatim from the activeTab === "insights" block in
// AdminDashboard.jsx; presentation rebuilt, derivation rules unchanged.
export default function InsightsTab({ predictions, performanceMetrics, formatCurrency }: InsightsTabProps) {
  if (!performanceMetrics) return null;

  return <Insights predictions={predictions} formatCurrency={formatCurrency} />;
}

function Insights({ predictions, formatCurrency }: { predictions: Prediction[]; formatCurrency: (value: number) => string }) {
  /* Aggregates derived only from Prediction fields the backend sends. */
  const { unitsToPrepare, itemsToReview, wasteValue } = useMemo(() => {
    let units = 0;
    let review = 0;
    let waste = 0;
    for (const pred of predictions) {
      const deficit = Math.max(0, pred.recommendedStock - pred.currentStock);
      if (deficit > 0) {
        units += deficit;
        review += 1;
      } else if (pred.estimatedWaste > 0) {
        review += 1;
      }
      if (pred.estimatedWaste > 0) waste += pred.potentialLoss;
    }
    return { unitsToPrepare: units, itemsToReview: review, wasteValue: waste };
  }, [predictions]);

  return (
    <div style={ROOT}>
      <header style={HEAD}>
        <p style={EYEBROW}>Forecast</p>
        <h2 style={TITLE}>Kitchen Insights</h2>
        <p style={SUBTITLE}>Smart recommendations for better planning</p>
      </header>

      {predictions.length === 0 ? (
        <div style={EMPTY}>
          <span style={EMPTY_ICON} aria-hidden="true">
            <Sparkles size={22} strokeWidth={1.75} />
          </span>
          <h3 style={EMPTY_TITLE}>No recommendations yet</h3>
          <p style={EMPTY_BODY}>
            Insights appear here as sales history builds up. Check back after a few days of orders.
          </p>
        </div>
      ) : (
        <>
          {/* What to do today — derived, never invented */}
          <Reveal>
            <div style={STRIP} aria-label="Recommended actions summary">
              <div style={STRIP_ITEM}>
                <div style={STRIP_TOP}>
                  <span style={STRIP_ICON} aria-hidden="true">
                    <ChefHat size={16} strokeWidth={2} />
                  </span>
                  <span style={STRIP_LABEL}>Units to prepare</span>
                </div>
                <span style={STRIP_VALUE}>{unitsToPrepare}</span>
              </div>

              <div style={STRIP_ITEM}>
                <div style={STRIP_TOP}>
                  <span style={{ ...STRIP_ICON, ...STRIP_ICON_ALERT }} aria-hidden="true">
                    <ClipboardList size={16} strokeWidth={2} />
                  </span>
                  <span style={STRIP_LABEL}>Items to review</span>
                </div>
                <span style={STRIP_VALUE}>{itemsToReview}</span>
              </div>

              <div style={STRIP_ITEM}>
                <div style={STRIP_TOP}>
                  <span style={STRIP_ICON} aria-hidden="true">
                    <IndianRupee size={16} strokeWidth={2} />
                  </span>
                  <span style={STRIP_LABEL}>Value at waste risk</span>
                </div>
                <span style={STRIP_VALUE}>{formatCurrency(wasteValue)}</span>
              </div>
            </div>
          </Reveal>

          {/* Per-item forecast cards */}
          <Reveal delay={60}>
            <div style={GRID}>
              {predictions.map((pred, idx) => {
                const deficit = Math.max(0, pred.recommendedStock - pred.currentStock);
                const scale = Math.max(pred.currentStock, pred.recommendedStock, 1);

                return (
                  <article key={`${pred.name}-${idx}`} style={PRED_CARD}>
                    <div style={CARD_HEAD}>
                      <h4 style={CARD_TITLE} title={pred.name}>
                        {pred.name}
                      </h4>
                      <span style={confidenceBadgeStyle(confidenceTone(pred.confidence))}>
                        <span style={confidenceDot} aria-hidden="true" />
                        {pred.confidence} confidence
                      </span>
                    </div>

                    {/* Stock gap — see the shortfall instead of reading it */}
                    <div style={BARS}>
                      <div style={barTrack}>
                        <div style={barRowHead}>
                          <span style={barLabel}>Current stock</span>
                          <span style={barValue(false)}>{pred.currentStock} units</span>
                        </div>
                        <div style={barRail}>
                          <span style={barFill((pred.currentStock / scale) * 100, "var(--bc-color-brand-secondary)")} />
                        </div>
                      </div>

                      <div style={barTrack}>
                        <div style={barRowHead}>
                          <span style={barLabel}>Suggested</span>
                          <span style={barValue(true)}>{pred.recommendedStock} units</span>
                        </div>
                        <div style={barRail}>
                          <span
                            style={barFill((pred.recommendedStock / scale) * 100, "var(--bc-color-brand-primary)")}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={SALES_ROW}>
                      <span style={barLabel}>Avg daily sales</span>
                      <span style={SALES_VALUE}>{pred.avgDailySales} units</span>
                    </div>

                    {(pred.estimatedWaste > 0 || deficit > 0) && (
                      <div style={CARD_ALERTS}>
                        {pred.estimatedWaste > 0 && (
                          <p style={alertStyle("warn")}>
                            <TriangleAlert size={15} strokeWidth={2.25} style={alertIcon} aria-hidden="true" />
                            <span>
                              Possible excess: {pred.estimatedWaste} units ({formatCurrency(pred.potentialLoss)})
                            </span>
                          </p>
                        )}
                        {deficit > 0 && (
                          <p style={alertStyle("idea")}>
                            <Lightbulb size={15} strokeWidth={2.25} style={alertIcon} aria-hidden="true" />
                            <span>Consider preparing {deficit} more units</span>
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Reveal>

          {/* Methodology — same sentence, quiet surface */}
          <Reveal delay={120}>
            <p style={NOTE}>
              <Info size={15} strokeWidth={2} style={{ flex: "none", marginTop: 1 }} aria-hidden="true" />
              <span>
                These suggestions are based on historical sales patterns and help reduce food waste while ensuring
                availability.
              </span>
            </p>
          </Reveal>
        </>
      )}
    </div>
  );
}