import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { listColleges, createCollege, toggleCollege } from "./collegeService";
import { useMediaQuery, Spin, SkeletonLine } from "../../../components/ledgerKit";
import {
  INK_3,
  dot,
  textAction,
  TITLE,
  TITLE_ROW,
  TALLY,
  TALLY_STRONG,
  SUB,
  HEAVY_RULE,
  BODY_GRID,
  BODY_STACK,
  REGION_LABEL,
  FORM_COL,
  LIST_COL,
  LIST_COL_STACKED,
  FORM,
  GROUP,
  LABEL,
  field,
  primaryCta,
  DANGER,
  REG_HEAD,
  FILTER_WRAP,
  filterField,
  ROWS,
  ledgerRow,
  INDEX,
  ROW_MAIN,
  ROW_NAME,
  NAME,
  LEADER,
  STATUS,
  ROW_ACTIONS,
  EMPTY_BLOCK,
  EMPTY_TITLE,
  EMPTY_SUB,
} from "../../../theme/ledger";

interface College {
  id: number;
  name: string;
  is_active: boolean;
}

/**
 * Company Admin's college registry: provision a new tenant college and
 * activate/deactivate existing ones. Rebuilt in the same ledger style as
 * ManagersPage.tsx (colleges.js -> .tsx, no more app-shell CSS classes) —
 * it used to be the only screen still on the old plain-table look, with
 * its own duplicate masthead layered under the shared one.
 */
export default function CollegePage() {
  const twoCol = useMediaQuery("(min-width: 900px)");

  const [colleges, setColleges] = useState<College[]>([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [ui, setUi] = useState<{ hover: string | null }>({ hover: null });
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const data = await listColleges();
    setColleges(data);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load colleges"))
      .finally(() => setBooting(false));
  }, [refresh]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("College name is required");
      return;
    }

    setCreating(true);
    try {
      await createCollege(name.trim());
      setName("");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create college");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (collegeId: number) => {
    try {
      await toggleCollege(collegeId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update college");
    }
  };

  const visibleColleges = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colleges;
    return colleges.filter((c) => c.name.toLowerCase().includes(q));
  }, [colleges, query]);

  const activeCount = colleges.filter((c) => c.is_active).length;
  const hoverProps = (key: string) => ({
    onMouseEnter: () => setUi({ hover: key }),
    onMouseLeave: () => setUi({ hover: ui.hover === key ? null : ui.hover }),
  });

  return (
    <>
      {/* ── Title + tally ────────────────────────────────────── */}
      <div style={TITLE_ROW}>
        <h1 style={TITLE}>Colleges</h1>
        <div style={TALLY} aria-live="polite">
          <span style={TALLY_STRONG}>{String(activeCount).padStart(2, "0")}</span>
          <span>active</span>
          <span style={{ color: INK_3 }}>/</span>
          <span>{String(colleges.length).padStart(2, "0")}</span>
          <span>onboarded</span>
        </div>
      </div>
      <p style={SUB}>Onboard tenant colleges and control whether their registration/login is live.</p>
      <hr style={HEAVY_RULE} />

      {error && (
        <p style={{ ...DANGER, marginTop: 20 }} role="alert">
          {error}
        </p>
      )}

      {booting ? (
        <div style={{ display: "grid", gap: 26, paddingTop: 26 }} role="status" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <SkeletonLine width="24px" delay={i * 100} />
              <SkeletonLine width={`${34 - i * 3}%`} delay={i * 100 + 70} />
              <SkeletonLine width="18%" delay={i * 100 + 140} />
              <SkeletonLine width="12%" delay={i * 100 + 210} />
            </div>
          ))}
        </div>
      ) : (
        <div style={twoCol ? BODY_GRID : BODY_STACK}>
          {/* ── Provision ──────────────────────────────────────── */}
          <div style={FORM_COL}>
            <p style={REGION_LABEL}>Provision</p>
            <form onSubmit={handleCreate} autoComplete="off" style={FORM}>
              <div style={GROUP}>
                <label htmlFor="college-name" style={LABEL}>College name</label>
                <input
                  id="college-name"
                  style={field(focusedField === "name", true)}
                  placeholder="e.g. Crescent Institute"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              {formError && (
                <p style={DANGER} role="alert">{formError}</p>
              )}

              <button
                type="submit"
                disabled={creating}
                style={primaryCta(ui.hover === "submit", creating)}
                {...hoverProps("submit")}
              >
                {creating ? (
                  <Spin>
                    <Loader2 size={15} strokeWidth={2.5} aria-hidden="true" />
                  </Spin>
                ) : (
                  "Add college"
                )}
                <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* ── Registry ───────────────────────────────────────── */}
          <div style={twoCol ? LIST_COL : LIST_COL_STACKED}>
            <div style={REG_HEAD}>
              <p style={{ ...REGION_LABEL, padding: "22px 0 10px" }}>Registry</p>
              <div style={FILTER_WRAP}>
                <input
                  type="text"
                  placeholder="Filter college name"
                  aria-label="Filter colleges"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocusedField("filter")}
                  onBlur={() => setFocusedField(null)}
                  style={filterField(focusedField === "filter")}
                />
              </div>
            </div>

            {colleges.length === 0 ? (
              <div style={EMPTY_BLOCK}>
                <p style={EMPTY_TITLE}>No colleges onboarded.</p>
                <p style={EMPTY_SUB}>Use the provision form to add the first one.</p>
              </div>
            ) : visibleColleges.length === 0 ? (
              <div style={EMPTY_BLOCK}>
                <p style={EMPTY_TITLE}>Nothing matches "{query}".</p>
                <p style={EMPTY_SUB}>Clear the filter to see all entries.</p>
              </div>
            ) : (
              <div style={ROWS}>
                {visibleColleges.map((c, index) => {
                  const rowHover = ui.hover === `row-${c.id}`;
                  return (
                    <div key={c.id} style={ledgerRow(rowHover, "44px minmax(0, 1fr) auto")} {...hoverProps(`row-${c.id}`)}>
                      <span style={INDEX}>{String(index + 1).padStart(2, "0")}</span>

                      <div style={ROW_MAIN}>
                        <div style={ROW_NAME}>
                          <span style={NAME} title={c.name}>{c.name}</span>
                          <span style={LEADER} aria-hidden="true" />
                          <span style={STATUS}>
                            <span style={dot(c.is_active)} aria-hidden="true" />
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div style={ROW_ACTIONS}>
                        <button
                          type="button"
                          style={textAction("neutral", ui.hover === `t-${c.id}`)}
                          {...hoverProps(`t-${c.id}`)}
                          onClick={() => handleToggle(c.id)}
                        >
                          {c.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
