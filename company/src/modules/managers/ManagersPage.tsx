import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import {
  listManagers,
  createManager,
  toggleManager,
  deleteManager,
  type Manager,
} from "./managerService";
import { listColleges } from "../canteens/college/collegeService";
import { useMediaQuery, Spin, SkeletonLine } from "../../components/ledgerKit";
import {
  INK,
  INK_3,
  FOREST,
  MONO,
  field,
  textAction,
  dot,
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
  PASSWORD_WRAP,
  EYE,
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
  META,
  META_SEP,
  ROW_ACTIONS,
  EMPTY_BLOCK,
  EMPTY_TITLE,
  EMPTY_SUB,
} from "../../theme/ledger";

interface College {
  id: number;
  name: string;
  is_active: boolean;
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export default function ManagersPage() {
  const twoCol = useMediaQuery("(min-width: 900px)");

  const [colleges, setColleges] = useState<College[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [ui, setUi] = useState<{ hover: string | null }>({ hover: null });
  const [query, setQuery] = useState("");

  const loadAll = useCallback(async () => {
    const [collegeList, managerList] = await Promise.all([listColleges(), listManagers()]);
    setColleges(collegeList);
    setManagers(managerList);
  }, []);

  useEffect(() => {
    loadAll()
      .catch(() => undefined)
      .finally(() => setBooting(false));
  }, [loadAll]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (collegeId === "") {
      setError("Select a college");
      return;
    }

    setLoading(true);
    try {
      await createManager({ name, phone, password, college_id: Number(collegeId) });
      setName("");
      setPhone("");
      setPassword("");
      setCollegeId("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create manager");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (managerId: number) => {
    await toggleManager(managerId);
    await loadAll();
  };

  const handleDelete = async (manager: Manager) => {
    const confirmed = window.confirm(
      `Permanently delete manager "${manager.name}"? This cannot be undone. Their canteens and staff are not affected.`
    );
    if (!confirmed) return;

    try {
      await deleteManager(manager.id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete manager");
    }
  };

  const collegeName = (id: number) => colleges.find((c) => c.id === id)?.name || `College ${id}`;

  const visibleManagers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        collegeName(m.college_id).toLowerCase().includes(q)
    );
  }, [managers, query, colleges]);

  const activeCount = managers.filter((m) => m.is_active).length;
  const hoverProps = (key: string) => ({
    onMouseEnter: () => setUi({ hover: key }),
    onMouseLeave: () => setUi({ hover: ui.hover === key ? null : ui.hover }),
  });

  return (
    <>
      {/* ── Title + tally ────────────────────────────────────── */}
      <div style={TITLE_ROW}>
        <h1 style={TITLE}>Managers</h1>
        <div style={TALLY} aria-live="polite">
          <span style={TALLY_STRONG}>{String(activeCount).padStart(2, "0")}</span>
          <span>active</span>
          <span style={{ color: INK_3 }}>/</span>
          <span>{String(managers.length).padStart(2, "0")}</span>
          <span>provisioned</span>
        </div>
      </div>
      <p style={SUB}>Provision college managers, review their accounts, and control portal access.</p>
      <hr style={HEAVY_RULE} />

      {error && (
        <p style={{ ...DANGER, marginTop: 20 }} role="alert">
          {error}
        </p>
      )}

      {booting ? (
        /* ── Boot skeleton: ledger lines ── */
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
                <label htmlFor="mgr-name" style={LABEL}>Manager name</label>
                <input
                  id="mgr-name"
                  style={field(focusedField === "name", true)}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              <div style={GROUP}>
                <label htmlFor="mgr-phone" style={LABEL}>Phone</label>
                <input
                  id="mgr-phone"
                  style={{ ...field(focusedField === "phone", true), fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}
                  type="tel"
                  inputMode="numeric"
                  placeholder="10 digits"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  required
                  autoComplete="tel"
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              <div style={GROUP}>
                <label htmlFor="mgr-password" style={LABEL}>Password</label>
                <div style={PASSWORD_WRAP}>
                  <input
                    id="mgr-password"
                    style={{ ...field(focusedField === "password", true), paddingRight: "2.4rem" }}
                    type={showPassword ? "text" : "password"}
                    placeholder="Initial password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    style={{ ...EYE, color: showPassword || focusedField === "password" ? FOREST : INK_3 }}
                    onFocus={() => setFocusedField("eye")}
                    onBlur={() => setFocusedField(null)}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={15} strokeWidth={2} aria-hidden="true" /> : <Eye size={15} strokeWidth={2} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div style={GROUP}>
                <label htmlFor="mgr-college" style={LABEL}>College</label>
                <select
                  id="mgr-college"
                  style={{ ...field(focusedField === "college", true), cursor: "pointer" }}
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                >
                  <option value="">Select college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={primaryCta(ui.hover === "submit", loading)}
                {...hoverProps("submit")}
              >
                {loading ? (
                  <Spin>
                    <Loader2 size={15} strokeWidth={2.5} aria-hidden="true" />
                  </Spin>
                ) : (
                  "Create manager"
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
                  placeholder="Filter name, phone, college"
                  aria-label="Filter managers"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocusedField("filter")}
                  onBlur={() => setFocusedField(null)}
                  style={filterField(focusedField === "filter")}
                />
              </div>
            </div>

            {managers.length === 0 ? (
              <div style={EMPTY_BLOCK}>
                <p style={EMPTY_TITLE}>No managers provisioned.</p>
                <p style={EMPTY_SUB}>Use the provision form to add the first one.</p>
              </div>
            ) : visibleManagers.length === 0 ? (
              <div style={EMPTY_BLOCK}>
                <p style={EMPTY_TITLE}>Nothing matches "{query}".</p>
                <p style={EMPTY_SUB}>Clear the filter to see all entries.</p>
              </div>
            ) : (
              <div style={ROWS}>
                {visibleManagers.map((m, index) => {
                  const rowHover = ui.hover === `row-${m.id}`;
                  return (
                    <div key={m.id} style={ledgerRow(rowHover)} {...hoverProps(`row-${m.id}`)}>
                      <span style={INDEX}>{String(index + 1).padStart(2, "0")}</span>

                      <div style={ROW_MAIN}>
                        <div style={ROW_NAME}>
                          <span style={NAME} title={m.name}>{m.name}</span>
                          <span style={LEADER} aria-hidden="true" />
                          <span style={STATUS}>
                            <span style={dot(m.is_active)} aria-hidden="true" />
                            {m.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div style={META}>
                          {m.phone}
                          <span style={META_SEP}>·</span>
                          {collegeName(m.college_id)}
                        </div>
                      </div>

                      <div style={ROW_ACTIONS}>
                        <button
                          type="button"
                          style={textAction("neutral", ui.hover === `t-${m.id}`)}
                          {...hoverProps(`t-${m.id}`)}
                          onClick={() => handleToggle(m.id)}
                        >
                          {m.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          style={textAction("danger", ui.hover === `d-${m.id}`)}
                          {...hoverProps(`d-${m.id}`)}
                          onClick={() => handleDelete(m)}
                        >
                          Delete
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
