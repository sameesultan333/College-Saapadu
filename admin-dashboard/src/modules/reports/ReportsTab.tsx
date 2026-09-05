import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Banknote,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDot,
  CreditCard,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Landmark,
  Loader2,
  ShoppingBag,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Canteen } from "../canteens/canteenService";
import {
  DailyReport,
  CollegeReport,
  ItemSummaryRow,
  fetchDailyReport,
  fetchCollegeReport,
  downloadReportPdf,
  downloadReportExcel,
  downloadCollegeReportPdf,
  downloadCollegeReportExcel,
} from "./reportService";

interface ReportsTabProps {
  canteens: Canteen[];
}

const ALL = "ALL";

/* ------------------------------------------------------------------ */
/* Formatting — byte-identical to the original                         */
/* ------------------------------------------------------------------ */

const inr = (v: number): string =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inrCompact = (v: number): string =>
  `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const todayIso = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ */
/* Motion / responsive helpers — the established inline-style kit      */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useMediaQuery(query: string): boolean {
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

function Spin({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 900, iterations: Infinity, easing: "linear" }
    );
    return () => animation.cancel();
  }, []);
  return (
    <span ref={ref} style={{ display: "inline-flex" }} aria-hidden="true">
      {children}
    </span>
  );
}

function SkeletonBar({ width, delay }: { width: string; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const animation = ref.current.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], {
      duration: 1300,
      iterations: Infinity,
      delay,
      easing: "ease-in-out",
    });
    return () => animation.cancel();
  }, [delay]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height: 12,
        borderRadius: "var(--bc-radius-pill)",
        backgroundColor: "var(--bc-color-neutral-bg-strong)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Payment channel icons — same convention as OrderCard                */
/* ------------------------------------------------------------------ */

const PAYMENT_ICONS: Record<string, LucideIcon> = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
  WALLET: Wallet,
};

const paymentIcon = (mode: string): LucideIcon => PAYMENT_ICONS[mode] ?? CircleDot;

/* ------------------------------------------------------------------ */
/* Style factories — standalone (a CSSProperties Record cannot hold fns)*/
/* ------------------------------------------------------------------ */

const rowStyle = (hovered: boolean): CSSProperties => ({
  backgroundColor: hovered ? "var(--bc-color-surface-page-alt)" : "transparent",
  transition: "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const ghostButtonStyle = (hovered: boolean, disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 40,
  padding: "0 var(--bc-space-16)",
  border: `1px solid ${disabled ? "var(--bc-color-border-subtle)" : hovered ? "var(--bc-color-border-strong)" : "var(--bc-color-border-default)"}`,
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: disabled ? "var(--bc-color-surface-page-alt)" : hovered ? "var(--bc-color-surface-page-alt)" : "var(--bc-color-surface-raised)",
  color: "var(--bc-color-text-primary)",
  fontWeight: 600,
  fontSize: "var(--bc-font-size-secondary)",
  whiteSpace: "nowrap",
  cursor: disabled ? "not-allowed" : "pointer",
  transition:
    "background-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard), border-color var(--bc-motion-duration-fast) var(--bc-motion-easing-standard)",
});

const linkButtonStyle = (hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  minHeight: 32,
  border: 0,
  padding: "0 var(--bc-space-4)",
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "transparent",
  color: "var(--bc-color-brand-primary)",
  fontWeight: 600,
  fontSize: "var(--bc-font-size-secondary)",
  cursor: "pointer",
  textDecoration: hovered ? "underline" : "none",
});

const mixSegment = (grow: number, color: string): CSSProperties => ({
  flexGrow: grow,
  flexBasis: 0,
  minWidth: grow > 0 ? 4 : 0,
  background: color,
  transition: "flex-grow var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)",
});

/* Canteen-name cell renders a real button for drill-down */
const scopeButtonStyle = (hovered: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: 0,
  padding: 0,
  background: "transparent",
  color: "var(--bc-color-text-primary)",
  fontWeight: 600,
  font: "inherit",
  cursor: "pointer",
  color2: undefined,
} as CSSProperties);

const modeBarFill = (pct: number, color: string): CSSProperties => ({
  display: "block",
  height: "100%",
  width: `${Math.max(1.5, Math.min(100, pct))}%`,
  borderRadius: "inherit",
  backgroundColor: color,
  transition: "width var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)",
});

/* ------------------------------------------------------------------ */
/* Static styles — tokens from the shared --bc-* system                */
/* ------------------------------------------------------------------ */

const ROOT: CSSProperties = { display: "grid", gap: "var(--bc-space-20)", minWidth: 0 };

const BAR: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "var(--bc-space-16)",
  flexWrap: "wrap",
};
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-brand-accent-strong)",
};
const TITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-page-heading)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tight)",
  lineHeight: "var(--bc-line-height-tight)",
  color: "var(--bc-color-text-primary)",
};
const SUBTITLE: CSSProperties = {
  margin: "var(--bc-space-4) 0 0",
  fontSize: "var(--bc-font-size-secondary)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted)",
};

const CONTROLS: CSSProperties = {
  display: "flex",
  gap: "var(--bc-space-12)",
  alignItems: "flex-end",
  flexWrap: "wrap",
};
const FIELD: CSSProperties = { display: "grid", gap: "var(--bc-space-4)" };
const FIELD_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  color: "var(--bc-color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  fontWeight: 600,
};
const INPUT: CSSProperties = {
  minHeight: 40,
  padding: "0 var(--bc-space-12)",
  border: "1px solid var(--bc-color-border-default)",
  borderRadius: "var(--bc-radius-md)",
  background: "var(--bc-color-surface-raised)",
  color: "var(--bc-color-text-primary)",
  font: "inherit",
  fontSize: "var(--bc-font-size-secondary)",
  minWidth: 150,
};
const SELECT_WRAP: CSSProperties = { position: "relative" };
const SELECT: CSSProperties = {
  ...INPUT,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: "var(--bc-space-32)",
  cursor: "pointer",
};
const SELECT_CHEVRON: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "0.75rem",
  transform: "translateY(-50%)",
  color: "var(--bc-color-text-muted)",
  pointerEvents: "none",
};
const DOWNLOAD_GROUP: CSSProperties = { display: "flex", gap: "var(--bc-space-8)", flex: "0 0 auto" };

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

/* KPI hairline grid — the original construction, refined */
const KPIS: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 175px), 1fr))",
  gap: 1,
  background: "var(--bc-color-border-subtle)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  overflow: "hidden",
  boxShadow: "var(--bc-shadow-card)",
};
const KPI_CELL: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  padding: "var(--bc-space-16) var(--bc-space-20)",
  display: "grid",
  gap: "var(--bc-space-4)",
  alignContent: "start",
  minWidth: 0,
};
const KPI_TOP: CSSProperties = { display: "flex", alignItems: "center", gap: "var(--bc-space-8)", minWidth: 0 };
const KPI_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 26,
  height: 26,
  borderRadius: "var(--bc-radius-sm)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};
const KPI_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  color: "var(--bc-color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const KPI_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-metric)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-tighter, -0.02em)",
  lineHeight: "var(--bc-line-height-tight)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const KPI_HINT: CSSProperties = {
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-muted)",
};

const CARD_HEAD: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--bc-space-12)",
  padding: "var(--bc-space-12) var(--bc-space-20)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
};
const CARD_TITLE: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 700,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};
const CARD_BODY: CSSProperties = { padding: "var(--bc-space-4) var(--bc-space-20) var(--bc-space-16)" };

const TABLE: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "var(--bc-font-size-body)" };
const TH: CSSProperties = {
  textAlign: "right",
  padding: "var(--bc-space-12) var(--bc-space-8)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
  background: "var(--bc-color-surface-page-alt)",
  color: "var(--bc-color-text-muted)",
  fontWeight: 600,
  fontSize: "var(--bc-font-size-eyebrow)",
  textTransform: "uppercase",
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  whiteSpace: "nowrap",
};
const TH_L: CSSProperties = { ...TH, textAlign: "left" };
const TD: CSSProperties = {
  textAlign: "right",
  padding: "var(--bc-space-12) var(--bc-space-8)",
  borderBottom: "1px solid var(--bc-color-border-subtle)",
  color: "var(--bc-color-text-primary)",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
const TD_L: CSSProperties = { ...TD, textAlign: "left" };
const TOTAL_CELL: CSSProperties = {
  ...TD,
  fontWeight: 700,
  backgroundColor: "var(--bc-color-surface-page-alt)",
  borderBottom: 0,
};
const TOTAL_CELL_L: CSSProperties = { ...TOTAL_CELL, textAlign: "left" };

/* Payment mix bar */
const MIX: CSSProperties = { display: "grid", gap: "var(--bc-space-8)", marginBottom: "var(--bc-space-12)" };
const MIX_BAR: CSSProperties = {
  display: "flex",
  overflow: "hidden",
  width: "min(100%, 420px)",
  height: 8,
  borderRadius: "var(--bc-radius-pill)",
  background: "var(--bc-color-neutral-bg)",
};
const MIX_LEGEND: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--bc-space-4) var(--bc-space-16)",
  fontSize: "var(--bc-font-size-secondary)",
  color: "var(--bc-color-text-muted)",
};
const LEGEND_ITEM: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontVariantNumeric: "tabular-nums",
};
const LEGEND_DOT = (color: string): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: "var(--bc-radius-round)",
  background: color,
});

const PAY_MODE_BAR: CSSProperties = {
  height: 4,
  borderRadius: "var(--bc-radius-pill)",
  background: "var(--bc-color-neutral-bg)",
  overflow: "hidden",
  marginTop: 6,
};

/* Mobile cards */
const MOBILE_LIST: CSSProperties = { display: "grid", gap: "var(--bc-space-12)" };
const M_CARD: CSSProperties = { ...CARD, padding: "var(--bc-space-card-padding)" };
const M_HEAD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--bc-space-8)",
};
const M_STRONG: CSSProperties = {
  fontWeight: 600,
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const M_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "var(--bc-space-8) var(--bc-space-12)",
  marginTop: "var(--bc-space-8)",
};
const M_CELL: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };
const M_LABEL: CSSProperties = {
  fontSize: "var(--bc-font-size-eyebrow)",
  fontWeight: 600,
  letterSpacing: "var(--bc-letter-spacing-eyebrow)",
  textTransform: "uppercase",
  color: "var(--bc-color-text-muted)",
};
const M_VALUE: CSSProperties = {
  fontSize: "var(--bc-font-size-body)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--bc-color-text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const M_TOTAL: CSSProperties = {
  ...M_CARD,
  backgroundColor: "var(--bc-color-surface-page-alt)",
  borderColor: "var(--bc-color-border-default)",
};
const M_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  borderRadius: "var(--bc-radius-pill)",
  backgroundColor: "var(--bc-color-neutral-bg)",
  color: "var(--bc-color-neutral-text)",
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const NOTE: CSSProperties = {
  margin: 0,
  fontSize: "var(--bc-font-size-caption, 0.75rem)",
  color: "var(--bc-color-text-muted)",
  lineHeight: "var(--bc-line-height-relaxed, 1.65)",
};

const MESSAGE: CSSProperties = {
  ...CARD,
  display: "grid",
  justifyItems: "center",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-40) var(--bc-space-24)",
  textAlign: "center",
  color: "var(--bc-color-text-muted)",
};
const MESSAGE_ICON: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 48,
  height: 48,
  borderRadius: "var(--bc-radius-round)",
  backgroundColor: "var(--bc-color-brand-primary-faint)",
  color: "var(--bc-color-brand-primary)",
};

const ERROR_SURFACE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--bc-space-8)",
  padding: "var(--bc-space-12) var(--bc-space-16)",
  border: "1px solid var(--bc-color-danger-border)",
  borderRadius: "var(--bc-radius-md)",
  backgroundColor: "var(--bc-color-danger-bg)",
  color: "var(--bc-color-danger-strong)",
  fontSize: "var(--bc-font-size-secondary)",
  fontWeight: 600,
};

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={CARD}>
      <div style={CARD_HEAD}>
        <span style={CARD_TITLE}>{title}</span>
        {action}
      </div>
      <div style={CARD_BODY}>{children}</div>
    </section>
  );
}

const SKELETON_KPIS: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 175px), 1fr))",
  gap: "var(--bc-space-16)",
};

function LoadingCard() {
  return (
    <div style={MESSAGE} role="status" aria-live="polite">
      <span style={{ fontSize: "var(--bc-font-size-secondary)" }}>Loading report…</span>
      <div style={{ ...SKELETON_KPIS, width: "100%" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...KPI_CELL, border: "1px solid var(--bc-color-border-subtle)", borderRadius: "var(--bc-radius-md)" }}>
            <SkeletonBar width="55%" delay={i * 120} />
            <SkeletonBar width="80%" delay={i * 120 + 90} />
            <SkeletonBar width="40%" delay={i * 120 + 180} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Item table. Collapsed by default to Qty / Gross / GST -- the full
   taxable + CGST/SGST split is one click away, and always present in the
   PDF/Excel exports regardless of what's shown here. */
function ItemTable({ rows, detailed, hover, setHover }: {
  rows: ItemSummaryRow[];
  detailed: boolean;
  hover: string | null;
  setHover: (key: string | null) => void;
}) {
  if (rows.length === 0) {
    return <div style={{ ...NOTE, padding: "var(--bc-space-16) 0" }}>No sales recorded.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH_L}>Item</th>
            <th style={TH}>Qty</th>
            <th style={TH}>Gross</th>
            {detailed && <th style={TH}>GST %</th>}
            {detailed && <th style={TH}>Taxable</th>}
            {detailed && <th style={TH}>CGST</th>}
            {detailed && <th style={TH}>SGST</th>}
            <th style={TH}>GST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, index) => {
            const key = `item-${index}`;
            return (
              <tr
                key={`${it.name}-${it.gst_rate}`}
                style={rowStyle(hover === key)}
                onMouseEnter={() => setHover(key)}
                onMouseLeave={() => setHover(hover === key ? null : hover)}
              >
                <td style={{ ...TD_L, whiteSpace: "normal" }}>{it.name}</td>
                <td style={TD}>{it.quantity}</td>
                <td style={TD}>{inr(it.gross_amount)}</td>
                {detailed && <td style={TD}>{it.gst_rate}%</td>}
                {detailed && <td style={TD}>{inr(it.taxable_amount)}</td>}
                {detailed && <td style={TD}>{inr(it.cgst_amount)}</td>}
                {detailed && <td style={TD}>{inr(it.sgst_amount)}</td>}
                <td style={TD}>{inr(it.total_gst_amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function ReportsTab({ canteens }: ReportsTabProps) {
  const isCompact = useMediaQuery("(max-width: 760px)");

  const [scope, setScope] = useState<string>(ALL);
  const [reportDate, setReportDate] = useState<string>(todayIso());
  const [single, setSingle] = useState<DailyReport | null>(null);
  const [combined, setCombined] = useState<CollegeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [showTax, setShowTax] = useState(false);
  const [showTxns, setShowTxns] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (REDUCED_MOTION || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(0, 0, 0.2, 1)" }
    );
    return () => animation.cancel();
  }, []);

  const isAll = scope === ALL;

  const load = useCallback(async () => {
    if (!reportDate) return;
    setLoading(true);
    setError("");
    try {
      if (scope === ALL) {
        setCombined(await fetchCollegeReport(reportDate));
        setSingle(null);
      } else {
        setSingle(await fetchDailyReport(Number(scope), reportDate));
        setCombined(null);
      }
    } catch (err) {
      setSingle(null);
      setCombined(null);
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [scope, reportDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (kind: "pdf" | "excel") => {
    setDownloading(kind);
    setError("");
    try {
      if (isAll) {
        await (kind === "pdf" ? downloadCollegeReportPdf : downloadCollegeReportExcel)(reportDate);
      } else if (single) {
        await (kind === "pdf" ? downloadReportPdf : downloadReportExcel)(
          single.canteen.id, single.canteen.name, single.report_date
        );
      }
    } catch {
      setError(`Could not download the ${kind.toUpperCase()} report.`);
    } finally {
      setDownloading("");
    }
  };

  const totals = isAll ? combined?.grand_totals : single?.totals;
  const items = isAll ? combined?.combined_item_summary : single?.item_summary;
  const payments = isAll ? combined?.combined_payment_summary : single?.payment_summary;
  const collegeName = isAll ? combined?.college.name : single?.college.name;
  const generatedAt = isAll ? combined?.generated_at : single?.generated_at;
  const estimated = isAll ? combined?.contains_estimated_values : single?.contains_estimated_values;
  const ready = Boolean(totals);

  const transactions = useMemo(() => {
    if (isAll) {
      return (combined?.canteens ?? []).flatMap((s) =>
        s.transactions.map((t) => ({ ...t, canteenName: s.canteen.name })));
    }
    return single
      ? single.transactions.map((t) => ({ ...t, canteenName: single.canteen.name }))
      : [];
  }, [isAll, combined, single]);

  /* Cash vs digital mix — derived from the payment summary only */
  const mix = useMemo(() => {
    const list = payments ?? [];
    const cash = list.filter((p) => p.payment_mode === "CASH").reduce((s, p) => s + p.gross_amount, 0);
    const digital = list.filter((p) => p.payment_mode !== "CASH").reduce((s, p) => s + p.gross_amount, 0);
    const total = cash + digital;
    return { cash, digital, total };
  }, [payments]);

  const hoverProps = (key: string) => ({
    onMouseEnter: () => setHover(key),
    onMouseLeave: () => setHover((current) => (current === key ? null : current)),
  });

  /* ---------------- mobile representations ---------------- */

  const paymentsMobile = (
    <div style={MOBILE_LIST}>
      {(payments ?? []).map((p) => {
        const Icon = paymentIcon(p.payment_mode);
        const isCash = p.payment_mode === "CASH";
        const color = isCash ? "var(--bc-color-brand-secondary)" : "var(--bc-color-info)";
        return (
          <div key={p.payment_mode} style={M_CARD}>
            <div style={M_HEAD}>
              <span style={M_CHIP}>
                <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
                {p.payment_mode}
              </span>
              <span style={M_VALUE}>{inr(p.gross_amount)}</span>
            </div>
            <span style={{ ...M_LABEL, marginTop: "var(--bc-space-4)" }}>
              {p.order_count} {p.order_count === 1 ? "order" : "orders"}
            </span>
            <span style={PAY_MODE_BAR}>
              <span style={modeBarFill(mix.total > 0 ? (p.gross_amount / mix.total) * 100 : 0, color)} />
            </span>
          </div>
        );
      })}
      <div style={M_TOTAL}>
        <div style={M_HEAD}>
          <span style={M_STRONG}>Total</span>
          <span style={M_VALUE}>{inr(mix.total)}</span>
        </div>
      </div>
    </div>
  );

  const itemsMobile = (
    <div style={MOBILE_LIST}>
      {(items ?? []).length === 0 ? (
        <p style={NOTE}>No sales recorded.</p>
      ) : (
        (items ?? []).map((it, index) => (
          <div key={`${it.name}-${it.gst_rate}`} style={M_CARD}>
            <div style={M_HEAD}>
              <span style={M_STRONG}>{it.name}</span>
              <span style={M_CHIP}>×{it.quantity}</span>
            </div>
            <div style={M_GRID}>
              <div style={M_CELL}>
                <span style={M_LABEL}>Gross</span>
                <span style={M_VALUE}>{inr(it.gross_amount)}</span>
              </div>
              <div style={M_CELL}>
                <span style={M_LABEL}>GST</span>
                <span style={M_VALUE}>{inr(it.total_gst_amount)}</span>
              </div>
              {showTax && (
                <div style={M_CELL}>
                  <span style={M_LABEL}>Rate</span>
                  <span style={M_VALUE}>{it.gst_rate}%</span>
                </div>
              )}
              {showTax && (
                <>
                  <div style={M_CELL}>
                    <span style={M_LABEL}>Taxable</span>
                    <span style={M_VALUE}>{inr(it.taxable_amount)}</span>
                  </div>
                  <div style={M_CELL}>
                    <span style={M_LABEL}>CGST</span>
                    <span style={M_VALUE}>{inr(it.cgst_amount)}</span>
                  </div>
                  <div style={M_CELL}>
                    <span style={M_LABEL}>SGST</span>
                    <span style={M_VALUE}>{inr(it.sgst_amount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const canteenSummaryMobile = isAll && combined ? (
    <div style={MOBILE_LIST}>
      {combined.canteens.map((s) => (
        <div key={s.canteen.id} style={M_CARD}>
          <div style={M_HEAD}>
            <button
              type="button"
              style={scopeButtonStyle(hover === `scope-${s.canteen.id}`)}
              {...hoverProps(`scope-${s.canteen.id}`)}
              onClick={() => setScope(String(s.canteen.id))}
              aria-label={`Show report for ${s.canteen.name}`}
            >
              {s.canteen.name}
              <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
          <div style={M_GRID}>
            <div style={M_CELL}><span style={M_LABEL}>Orders</span><span style={M_VALUE}>{s.totals.order_count}</span></div>
            <div style={M_CELL}><span style={M_LABEL}>Items</span><span style={M_VALUE}>{s.totals.item_count}</span></div>
            <div style={M_CELL}><span style={M_LABEL}>GST</span><span style={M_VALUE}>{inr(s.totals.total_gst)}</span></div>
            <div style={M_CELL}><span style={M_LABEL}>Gross</span><span style={M_VALUE}>{inr(s.totals.gross_sales)}</span></div>
            <div style={M_CELL}><span style={M_LABEL}>Taxable</span><span style={M_VALUE}>{inr(s.totals.taxable_sales)}</span></div>
          </div>
        </div>
      ))}
      <div style={M_TOTAL}>
        <span style={M_STRONG}>All Canteens</span>
        <div style={M_GRID}>
          <div style={M_CELL}><span style={M_LABEL}>Orders</span><span style={M_VALUE}>{combined.grand_totals.order_count}</span></div>
          <div style={M_CELL}><span style={M_LABEL}>Items</span><span style={M_VALUE}>{combined.grand_totals.item_count}</span></div>
          <div style={M_CELL}><span style={M_LABEL}>GST</span><span style={M_VALUE}>{inr(combined.grand_totals.total_gst)}</span></div>
          <div style={M_CELL}><span style={M_LABEL}>Gross</span><span style={M_VALUE}>{inr(combined.grand_totals.gross_sales)}</span></div>
          <div style={M_CELL}><span style={M_LABEL}>Taxable</span><span style={M_VALUE}>{inr(combined.grand_totals.taxable_sales)}</span></div>
        </div>
      </div>
    </div>
  ) : null;

  const transactionsMobile = (
    <div style={MOBILE_LIST}>
      {transactions.map((txn) => {
        const Icon = paymentIcon(txn.payment_mode);
        return (
          <div key={`${txn.canteenName}-${txn.order_id}`} style={M_CARD}>
            <div style={M_HEAD}>
              <span style={M_STRONG}>#{txn.order_id} · {txn.time}</span>
              <span style={M_CHIP}>
                <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
                {txn.payment_mode}
              </span>
            </div>
            <div style={M_GRID}>
              <div style={M_CELL}>
                <span style={M_LABEL}>Customer</span>
                <span style={{ ...M_VALUE, whiteSpace: "normal" }}>{txn.customer}</span>
              </div>
              {isAll && (
                <div style={M_CELL}>
                  <span style={M_LABEL}>Canteen</span>
                  <span style={M_VALUE}>{txn.canteenName}</span>
                </div>
              )}
              <div style={M_CELL}>
                <span style={M_LABEL}>Items</span>
                <span style={M_VALUE}>{txn.items.reduce((n, i) => n + i.quantity, 0)}</span>
              </div>
              <div style={M_CELL}>
                <span style={M_LABEL}>Gross</span>
                <span style={M_VALUE}>{inr(txn.gross_amount)}</span>
              </div>
              <div style={M_CELL}>
                <span style={M_LABEL}>GST</span>
                <span style={M_VALUE}>{inr(txn.total_gst_amount)}</span>
              </div>
            </div>
          </div>
        );
      })}
      {transactions.length === 0 && <p style={NOTE}>No transactions recorded for this date.</p>}
    </div>
  );

  return (
    <div ref={rootRef} style={ROOT}>
      {/* Header + controls */}
      <header style={BAR}>
        <div>
          <p style={EYEBROW}>Reports</p>
          <h2 style={TITLE}>Sales &amp; GST</h2>
          <p style={SUBTITLE}>
            {collegeName ? `${collegeName} · ` : ""}
            {new Date(reportDate + "T00:00:00").toLocaleDateString("en-IN",
              { day: "2-digit", month: "long", year: "numeric" })}
            {generatedAt ? ` · generated ${generatedAt.slice(11, 16)} IST` : ""}
          </p>
        </div>

        <div style={CONTROLS}>
          <div style={FIELD}>
            <label htmlFor="report-scope" style={FIELD_LABEL}>Scope</label>
            <div style={SELECT_WRAP}>
              <select
                id="report-scope"
                style={SELECT}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value={ALL}>All Canteens</option>
                {canteens.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={2.25} style={SELECT_CHEVRON} aria-hidden="true" />
            </div>
          </div>
          <div style={FIELD}>
            <label htmlFor="report-date" style={FIELD_LABEL}>Date</label>
            <input
              id="report-date"
              type="date"
              style={INPUT}
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          <div style={DOWNLOAD_GROUP}>
            <button
              type="button"
              style={ghostButtonStyle(hover === "pdf", !ready || !!downloading)}
              {...hoverProps("pdf")}
              onClick={() => handleDownload("pdf")}
              disabled={!ready || !!downloading}
            >
              {downloading === "pdf" ? (
                <Spin><Loader2 size={14} strokeWidth={2.5} aria-hidden="true" /></Spin>
              ) : (
                <FileText size={14} strokeWidth={2.25} aria-hidden="true" />
              )}
              {downloading === "pdf" ? "Preparing…" : "PDF"}
            </button>
            <button
              type="button"
              style={ghostButtonStyle(hover === "excel", !ready || !!downloading)}
              {...hoverProps("excel")}
              onClick={() => handleDownload("excel")}
              disabled={!ready || !!downloading}
            >
              {downloading === "excel" ? (
                <Spin><Loader2 size={14} strokeWidth={2.5} aria-hidden="true" /></Spin>
              ) : (
                <FileSpreadsheet size={14} strokeWidth={2.25} aria-hidden="true" />
              )}
              {downloading === "excel" ? "Preparing…" : "Excel"}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div style={ERROR_SURFACE} role="alert">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {canteens.length === 0 ? (
        <div style={MESSAGE}>
          <span style={MESSAGE_ICON} aria-hidden="true"><Building2 size={20} strokeWidth={1.75} /></span>
          <p style={{ ...NOTE, fontSize: "var(--bc-font-size-body)" }}>Create a canteen first to generate reports.</p>
        </div>
      ) : loading ? (
        <LoadingCard />
      ) : !ready ? null : (
        <>
          {/* Four headline numbers. Everything else is a click away. */}
          <Reveal>
            <div style={KPIS}>
              <div style={KPI_CELL}>
                <div style={KPI_TOP}>
                  <span style={KPI_ICON} aria-hidden="true"><IndianRupee size={14} strokeWidth={2.25} /></span>
                  <span style={KPI_LABEL}>Gross Sales</span>
                </div>
                <span style={KPI_VALUE}>{inr(totals!.gross_sales)}</span>
                <span style={KPI_HINT}>GST inclusive</span>
              </div>
              <div style={KPI_CELL}>
                <div style={KPI_TOP}>
                  <span style={KPI_ICON} aria-hidden="true"><ShoppingBag size={14} strokeWidth={2.25} /></span>
                  <span style={KPI_LABEL}>Taxable Value</span>
                </div>
                <span style={KPI_VALUE}>{inr(totals!.taxable_sales)}</span>
                <span style={KPI_HINT}>excluding GST</span>
              </div>
              <div style={KPI_CELL}>
                <div style={KPI_TOP}>
                  <span style={KPI_ICON} aria-hidden="true"><Landmark size={14} strokeWidth={2.25} /></span>
                  <span style={KPI_LABEL}>Total GST</span>
                </div>
                <span style={KPI_VALUE}>{inr(totals!.total_gst)}</span>
                <span style={KPI_HINT}>
                  CGST {inrCompact(totals!.cgst_amount)} · SGST {inrCompact(totals!.sgst_amount)}
                </span>
              </div>
              <div style={KPI_CELL}>
                <div style={KPI_TOP}>
                  <span style={KPI_ICON} aria-hidden="true"><FileText size={14} strokeWidth={2.25} /></span>
                  <span style={KPI_LABEL}>Orders</span>
                </div>
                <span style={KPI_VALUE}>{totals!.order_count}</span>
                <span style={KPI_HINT}>{totals!.item_count} items sold</span>
              </div>
            </div>
          </Reveal>

          {/* Canteen-wise breakdown, only meaningful in combined view */}
          {isAll && combined && (
            <Reveal delay={60}>
              <Card
                title="Canteen-wise Summary"
                action={<span style={KPI_HINT}>Click a canteen to focus the report</span>}
              >
                {isCompact ? (
                  canteenSummaryMobile
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={TABLE}>
                      <thead>
                        <tr>
                          <th style={TH_L}>Canteen</th>
                          <th style={TH}>Orders</th>
                          <th style={TH}>Items</th>
                          <th style={TH}>Gross Sales</th>
                          <th style={TH}>Taxable</th>
                          <th style={TH}>GST</th>
                          <th style={TH}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Open</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {combined.canteens.map((s) => {
                          const key = `crow-${s.canteen.id}`;
                          return (
                            <tr
                              key={s.canteen.id}
                              style={rowStyle(hover === key)}
                              {...hoverProps(key)}
                            >
                              <td style={TD_L}>
                                <button
                                  type="button"
                                  style={scopeButtonStyle(hover === `scope-${s.canteen.id}`)}
                                  {...hoverProps(`scope-${s.canteen.id}`)}
                                  onClick={() => setScope(String(s.canteen.id))}
                                  aria-label={`Show report for ${s.canteen.name}`}
                                >
                                  {s.canteen.name}
                                  <ChevronRight size={13} strokeWidth={2.25} aria-hidden="true" />
                                </button>
                              </td>
                              <td style={TD}>{s.totals.order_count}</td>
                              <td style={TD}>{s.totals.item_count}</td>
                              <td style={TD}>{inr(s.totals.gross_sales)}</td>
                              <td style={TD}>{inr(s.totals.taxable_sales)}</td>
                              <td style={TD}>{inr(s.totals.total_gst)}</td>
                              <td style={TD}><ChevronRight size={14} strokeWidth={2} color="var(--bc-color-text-faint)" aria-hidden="true" /></td>
                            </tr>
                          );
                        })}
                        {combined.canteens.length === 0 && (
                          <tr><td style={{ ...TD_L }} colSpan={7}>No canteens yet.</td></tr>
                        )}
                        <tr>
                          <td style={TOTAL_CELL_L}>All Canteens</td>
                          <td style={TOTAL_CELL}>{combined.grand_totals.order_count}</td>
                          <td style={TOTAL_CELL}>{combined.grand_totals.item_count}</td>
                          <td style={TOTAL_CELL}>{inr(combined.grand_totals.gross_sales)}</td>
                          <td style={TOTAL_CELL}>{inr(combined.grand_totals.taxable_sales)}</td>
                          <td style={TOTAL_CELL}>{inr(combined.grand_totals.total_gst)}</td>
                          <td style={TOTAL_CELL} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Reveal>
          )}

          <Reveal delay={90}>
            <Card
              title={isAll ? "Items Sold · All Canteens" : "Items Sold"}
              action={
                <button
                  type="button"
                  style={linkButtonStyle(hover === "tax")}
                  {...hoverProps("tax")}
                  aria-expanded={showTax}
                  onClick={() => setShowTax((v) => !v)}
                >
                  {showTax ? "Hide tax breakdown" : "Show tax breakdown"}
                </button>
              }
            >
              {isCompact ? itemsMobile : <ItemTable rows={items ?? []} detailed={showTax} hover={hover} setHover={setHover} />}
            </Card>
          </Reveal>

          <Reveal delay={120}>
            <Card title="Payments">
              {/* Cash vs digital mix, derived from the same rows below */}
              {mix.total > 0 && (
                <div style={MIX}>
                  <div
                    style={MIX_BAR}
                    role="img"
                    aria-label={`Cash ${inr(mix.cash)}, digital ${inr(mix.digital)}, of ${inr(mix.total)} collected`}
                  >
                    <span style={mixSegment(mix.cash, "var(--bc-color-brand-secondary)")} />
                    <span style={mixSegment(mix.digital, "var(--bc-color-info)")} />
                  </div>
                  <div style={MIX_LEGEND}>
                    <span style={LEGEND_ITEM}>
                      <span style={LEGEND_DOT("var(--bc-color-brand-secondary)")} aria-hidden="true" />
                      Cash {inr(mix.cash)}
                    </span>
                    <span style={LEGEND_ITEM}>
                      <span style={LEGEND_DOT("var(--bc-color-info)")} aria-hidden="true" />
                      Digital {inr(mix.digital)}
                    </span>
                  </div>
                </div>
              )}

              {isCompact ? (
                paymentsMobile
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ ...TABLE, maxWidth: 480 }}>
                    <thead>
                      <tr>
                        <th style={TH_L}>Method</th>
                        <th style={TH}>Orders</th>
                        <th style={TH}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments ?? []).map((p) => {
                        const key = `pay-${p.payment_mode}`;
                        const Icon = paymentIcon(p.payment_mode);
                        return (
                          <tr key={p.payment_mode} style={rowStyle(hover === key)} {...hoverProps(key)}>
                            <td style={{ ...TD_L }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon size={14} strokeWidth={2.1} color="var(--bc-color-text-secondary)" aria-hidden="true" />
                                {p.payment_mode}
                              </span>
                            </td>
                            <td style={TD}>{p.order_count}</td>
                            <td style={TD}>{inr(p.gross_amount)}</td>
                          </tr>
                        );
                      })}
                      {(payments ?? []).length === 0 && (
                        <tr><td style={{ ...TD_L }} colSpan={3}>No payments recorded.</td></tr>
                      )}
                      <tr>
                        <td style={TOTAL_CELL_L}>Total</td>
                        <td style={TOTAL_CELL} />
                        <td style={TOTAL_CELL}>{inr((payments ?? []).reduce((s, p) => s + p.gross_amount, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </Reveal>

          <Reveal delay={150}>
            <Card
              title={`Transactions (${transactions.length})`}
              action={
                <button
                  type="button"
                  style={linkButtonStyle(hover === "txns")}
                  {...hoverProps("txns")}
                  aria-expanded={showTxns}
                  onClick={() => setShowTxns((v) => !v)}
                >
                  {showTxns ? "Hide" : "Show"}
                </button>
              }
            >
              {!showTxns ? (
                <p style={{ ...NOTE, marginTop: "var(--bc-space-4)" }}>
                  Line-by-line detail is hidden to keep this view readable. It is always included in
                  full in the PDF and Excel exports.
                </p>
              ) : isCompact ? (
                transactionsMobile
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={TABLE}>
                    <thead>
                      <tr>
                        <th style={TH_L}>Order</th>
                        <th style={TH_L}>Time</th>
                        {isAll && <th style={TH_L}>Canteen</th>}
                        <th style={TH_L}>Customer</th>
                        <th style={TH}>Items</th>
                        <th style={TH}>Gross</th>
                        <th style={TH}>GST</th>
                        <th style={TH_L}>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn, index) => {
                        const key = `txn-${index}`;
                        const Icon = paymentIcon(txn.payment_mode);
                        return (
                          <tr key={`${txn.canteenName}-${txn.order_id}`} style={rowStyle(hover === key)} {...hoverProps(key)}>
                            <td style={TD_L}>#{txn.order_id}</td>
                            <td style={TD_L}>{txn.time}</td>
                            {isAll && <td style={TD_L}>{txn.canteenName}</td>}
                            <td style={TD_L}>{txn.customer}</td>
                            <td style={TD}>{txn.items.reduce((n, i) => n + i.quantity, 0)}</td>
                            <td style={TD}>{inr(txn.gross_amount)}</td>
                            <td style={TD}>{inr(txn.total_gst_amount)}</td>
                            <td style={TD_L}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon size={14} strokeWidth={2.1} color="var(--bc-color-text-secondary)" aria-hidden="true" />
                                {txn.payment_mode}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {transactions.length === 0 && (
                        <tr><td style={{ ...TD_L }} colSpan={isAll ? 8 : 7}>
                          No transactions recorded for this date.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </Reveal>

          <Reveal delay={180}>
            <p style={NOTE}>
              Prices are GST inclusive; taxable value and GST are extracted from them. Each line uses the
              GST rate stored with that transaction, so changing an item&apos;s rate later never alters a past
              report.
              {estimated && " Some lines predate per-transaction tax capture and were reconstructed from current menu pricing."}
            </p>
          </Reveal>
        </>
      )}
    </div>
  );
}