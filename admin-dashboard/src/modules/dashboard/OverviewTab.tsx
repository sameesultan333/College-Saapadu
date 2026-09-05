import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IndianRupee, ShoppingBag, Smartphone, Store } from "lucide-react";

interface OverviewStats {
  today_orders?: number;
  today_revenue?: number;
  total_revenue?: number;
}

interface OverviewTabProps {
  stats: OverviewStats | null;
  activeOrdersCount: number;
  counterOrdersCount: number;
  onlineOrdersCount: number;
  menuItemsCount: number;
  completedTodayCount: number;
  formatCurrency: (value: number) => string;
}

/* ------------------------------------------------------------------ */
/* Motion helpers use WAAPI and respect the user's reduced-motion setting. */
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
/* Botanical echo of the Header motif — one sprig, brass, faint.       */
/* ------------------------------------------------------------------ */

function HeroSprig() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={150}
      height={150}
      aria-hidden="true"
      focusable="false"
      style={HERO.sprig}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21V5" />
        <path d="M12 12C8.7 12 6.6 9.9 6.2 6.6 9.5 6.6 11.6 8.7 12 12Z" />
        <path d="M12 12c3.3 0 5.4-2.1 5.8-5.4C14.5 6.6 12.4 8.7 12 12Z" />
        <path d="M12 17.5c-2.6 0-4.2-1.6-4.6-4.2 2.6 0 4.2 1.6 4.6 4.2Z" />
        <path d="M12 17.5c2.6 0 4.2-1.6 4.6-4.2-2.6 0-4.2 1.6-4.6 4.2Z" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Style factories — standalone, like Header's photoWrap/motif.        */
/* Kept OUTSIDE the Record-typed groups below: an index signature of   */
/* CSSProperties cannot hold functions.                                */
/* ------------------------------------------------------------------ */

const heroSegment = (grow: number, color: string): CSSProperties => ({
  flexGrow: grow,
  flexBasis: 0,
  minWidth: grow > 0 ? 6 : 0,
  background: color,
  transition: "flex-grow var(--bc-motion-duration-normal) var(--bc-motion-easing-standard)",
});

const heroLegendDot = (color: string): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: "var(--bc-radius-round)",
  background: color,
});

const kpiIcon = (bg: string, color: string): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  borderRadius: "var(--bc-radius-md)",
  background: bg,
  color,
});

/* ------------------------------------------------------------------ */
/* Styles — token-only. Channel colors are a closed semantic set       */
/* reused in both the KPI tiles and the split bar:                     */
/* brass = money, sage = counter/physical, info = online/digital.      */
/* ------------------------------------------------------------------ */

const CARD: CSSProperties = {
  background: "var(--bc-color-surface-raised)",
  border: "1px solid var(--bc-color-border-subtle)",
  borderRadius: "var(--bc-radius-lg)",
  boxShadow: "var(--bc-shadow-card)",
  minWidth: 0,
};

const HERO: Record<string, CSSProperties> = {
  band: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--bc-space-24)",
    padding: "clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.25rem, 3vw, 2rem)",
    background: "var(--bc-color-brand-primary)",
    color: "var(--bc-color-text-inverse)",
    borderRadius: "var(--bc-radius-lg)",
    boxShadow: "var(--bc-shadow-card)",
  },
  photo: {
    position: "absolute",
    inset: 0,
    left: "38%",
    width: "62%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center center",
    opacity: 0.3,
    pointerEvents: "none",
    WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 48%)",
    maskImage: "linear-gradient(90deg, transparent 0%, #000 48%)",
  },
  photoTint: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, var(--bc-color-brand-primary) 20%, transparent 78%)",
    pointerEvents: "none",
  },
  sprig: {
    position: "absolute",
    right: "-28px",
    bottom: "-34px",
    color: "var(--bc-color-brand-accent)",
    opacity: 0.12,
    pointerEvents: "none",
  },
  copy: { position: "relative", flex: "1 1 260px", minWidth: 0 },
  eyebrow: {
    margin: 0,
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    /* accent-soft on green: the brass *feeling* at AA contrast */
    color: "var(--bc-color-brand-accent-soft)",
  },
  greeting: {
    margin: "var(--bc-space-8) 0 0",
    fontSize: "var(--bc-font-size-page-heading)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tight)",
    lineHeight: "var(--bc-line-height-tight)",
    color: "var(--bc-color-text-inverse)",
  },
  sub: {
    margin: "var(--bc-space-8) 0 0",
    fontSize: "var(--bc-font-size-body)",
    color: "var(--bc-color-white-alpha-80)",
  },
  now: {
    position: "relative",
    flex: "0 1 auto",
    minWidth: "min(100%, 250px)",
    display: "grid",
    gap: "var(--bc-space-8)",
    justifyItems: "start",
  },
  nowLabel: {
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    color: "var(--bc-color-white-alpha-80)",
  },
  nowValue: {
    fontSize: "clamp(2rem, 1.6rem + 1.2vw, 2.6rem)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tighter)",
    lineHeight: "var(--bc-line-height-tight)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-inverse)",
  },
  nowCalm: {
    margin: 0,
    fontSize: "var(--bc-font-size-body)",
    fontWeight: 500,
    color: "var(--bc-color-white-alpha-80)",
  },
  bar: {
    display: "flex",
    overflow: "hidden",
    width: "min(100%, 280px)",
    height: 8,
    borderRadius: "var(--bc-radius-pill)",
    background: "var(--bc-color-white-alpha-10)",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--bc-space-8) var(--bc-space-16)",
    fontSize: "var(--bc-font-size-secondary)",
    color: "var(--bc-color-white-alpha-80)",
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" },
};

const KPI: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 165px), 1fr))",
    gap: "var(--bc-space-card-gap)",
  },
  card: {
    ...CARD,
    position: "relative",
    display: "grid",
    gap: "var(--bc-space-12)",
    alignContent: "start",
    padding: "var(--bc-space-card-padding)",
    overflow: "hidden",
  },
  /* Brass rail marks the flagship metric — same rail motif as OrderCard */
  flagship: { boxShadow: "inset 3px 0 0 var(--bc-color-brand-accent)" },
  label: {
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 500,
    color: "var(--bc-color-text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  value: {
    fontSize: "var(--bc-font-size-metric)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tighter)",
    lineHeight: "var(--bc-line-height-tight)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

const GLANCE: Record<string, CSSProperties> = {
  card: { ...CARD, padding: "var(--bc-space-card-padding)" },
  title: {
    margin: 0,
    fontSize: "var(--bc-font-size-eyebrow)",
    fontWeight: 600,
    letterSpacing: "var(--bc-letter-spacing-eyebrow)",
    textTransform: "uppercase",
    color: "var(--bc-color-text-muted)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: "var(--bc-space-16) var(--bc-space-24)",
    marginTop: "var(--bc-space-16)",
  },
  cell: { display: "grid", gap: "var(--bc-space-4)", minWidth: 0 },
  label: {
    fontSize: "var(--bc-font-size-secondary)",
    fontWeight: 500,
    color: "var(--bc-color-text-muted)",
  },
  value: {
    fontSize: "clamp(1.25rem, 1.1rem + .5vw, 1.5rem)",
    fontWeight: 700,
    letterSpacing: "var(--bc-letter-spacing-tight)",
    lineHeight: "var(--bc-line-height-tight)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--bc-color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

/* Channel color roles — shared by tiles and the split bar */
const CHANNEL = {
  counter: { bg: "var(--bc-color-brand-secondary-soft)", color: "var(--bc-color-brand-secondary-strong)", bar: "var(--bc-color-brand-secondary)" },
  online: { bg: "var(--bc-color-info-icon-bg)", color: "var(--bc-color-info-strong)", bar: "var(--bc-color-info-light)" },
  revenue: { bg: "var(--bc-color-brand-accent-soft)", color: "var(--bc-color-brand-accent-strong)" },
  orders: { bg: "var(--bc-color-brand-primary-soft)", color: "var(--bc-color-brand-primary)" },
} as const;

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export default function OverviewTab({
  stats,
  activeOrdersCount,
  counterOrdersCount,
  onlineOrdersCount,
  menuItemsCount,
  completedTodayCount,
  formatCurrency,
}: OverviewTabProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  /* Derived — only ever from props/stats that actually exist. */
  const todayOrders = stats?.today_orders ?? 0;
  const todayRevenue = stats?.today_revenue ?? 0;
  const avgOrderValue =
    stats != null && todayOrders > 0 ? formatCurrency(todayRevenue / todayOrders) : null;

  const hasLiveOrders = activeOrdersCount > 0;

  return (
    <div style={{ display: "grid", gap: "var(--bc-space-24)" }}>
      {/* 1 — Right now */}
      <Reveal>
        <section style={HERO.band} aria-label="Live kitchen status">
          <img
            src={`${process.env.PUBLIC_URL}/brand/admin-header.png`}
            alt=""
            decoding="async"
            style={HERO.photo}
            aria-hidden="true"
          />
          <span style={HERO.photoTint} aria-hidden="true" />
          <HeroSprig />
          <div style={HERO.copy}>
            <p style={HERO.eyebrow}>{today}</p>
            <h2 style={HERO.greeting}>{greeting}</h2>
            <p style={HERO.sub}>Here&apos;s how your kitchen is running today.</p>
          </div>

          <div style={HERO.now}>
            <span style={HERO.nowLabel}>In the kitchen now</span>
            {hasLiveOrders ? (
              <>
                <span style={HERO.nowValue}>{activeOrdersCount}</span>
                <div
                  style={HERO.bar}
                  role="img"
                  aria-label={`Counter orders ${counterOrdersCount}, online orders ${onlineOrdersCount}, of ${activeOrdersCount} active`}
                >
                  <span style={heroSegment(counterOrdersCount, CHANNEL.counter.bar)} />
                  <span style={heroSegment(onlineOrdersCount, CHANNEL.online.bar)} />
                </div>
                <div style={HERO.legend}>
                  <span style={HERO.legendItem}>
                    <span style={heroLegendDot(CHANNEL.counter.bar)} aria-hidden="true" />
                    {counterOrdersCount} counter
                  </span>
                  <span style={HERO.legendItem}>
                    <span style={heroLegendDot(CHANNEL.online.bar)} aria-hidden="true" />
                    {onlineOrdersCount} online
                  </span>
                </div>
              </>
            ) : (
              <p style={HERO.nowCalm}>All caught up — no active orders.</p>
            )}
          </div>
        </section>
      </Reveal>

      {/* 2 — Today's production */}
      <Reveal delay={60}>
        <div style={KPI.grid}>
          <section style={{ ...KPI.card, ...KPI.flagship }} aria-label="Today's revenue">
            <span style={kpiIcon(CHANNEL.revenue.bg, CHANNEL.revenue.color)} aria-hidden="true">
              <IndianRupee size={17} strokeWidth={2.25} />
            </span>
            <span style={KPI.label}>Today&apos;s Revenue</span>
            <span style={KPI.value}>{stats != null ? formatCurrency(todayRevenue) : "—"}</span>
          </section>

          <section style={KPI.card} aria-label="Today's orders">
            <span style={kpiIcon(CHANNEL.orders.bg, CHANNEL.orders.color)} aria-hidden="true">
              <ShoppingBag size={17} strokeWidth={2.25} />
            </span>
            <span style={KPI.label}>Today&apos;s Orders</span>
            <span style={KPI.value}>{stats != null ? todayOrders : "—"}</span>
          </section>

          <section style={KPI.card} aria-label="Active counter orders">
            <span style={kpiIcon(CHANNEL.counter.bg, CHANNEL.counter.color)} aria-hidden="true">
              <Store size={17} strokeWidth={2.25} />
            </span>
            <span style={KPI.label}>Counter Orders</span>
            <span style={KPI.value}>{counterOrdersCount}</span>
          </section>

          <section style={KPI.card} aria-label="Active online orders">
            <span style={kpiIcon(CHANNEL.online.bg, CHANNEL.online.color)} aria-hidden="true">
              <Smartphone size={17} strokeWidth={2.25} />
            </span>
            <span style={KPI.label}>Online Orders</span>
            <span style={KPI.value}>{onlineOrdersCount}</span>
          </section>
        </div>
      </Reveal>

      {/* 3 — Context, typographically quiet */}
      <Reveal delay={120}>
        <section style={GLANCE.card} aria-label="Today at a glance">
          <h3 style={GLANCE.title}>Today at a glance</h3>
          <div style={GLANCE.grid}>
            <div style={GLANCE.cell}>
              <span style={GLANCE.label}>Avg order value</span>
              <span style={GLANCE.value}>{avgOrderValue ?? "—"}</span>
            </div>
            <div style={GLANCE.cell}>
              <span style={GLANCE.label}>Completed today</span>
              <span style={GLANCE.value}>{completedTodayCount}</span>
            </div>
            <div style={GLANCE.cell}>
              <span style={GLANCE.label}>Total revenue</span>
              <span style={GLANCE.value}>{stats?.total_revenue != null ? formatCurrency(stats.total_revenue) : "—"}</span>
            </div>
            <div style={GLANCE.cell}>
              <span style={GLANCE.label}>Menu items</span>
              <span style={GLANCE.value}>{menuItemsCount}</span>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}