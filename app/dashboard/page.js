"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Search, Plus, X, Phone, Clock, User, Mail, LogOut, Download,
  AlertTriangle, TrendingUp, Check, Save, Loader2, Trash2,
} from "lucide-react";

/* ---------- Pomme system ---------- */
const ENGAGEMENT_META = {
  V: { label: "Verte", sub: "Intéressé", color: "var(--green)" },
  J: { label: "Jaune", sub: "Mitigé", color: "var(--yellow)" },
  R: { label: "Rouge", sub: "Pas intéressé", color: "var(--red)" },
  D: { label: "Dorée", sub: "Yes man — envoie des leads", color: "var(--gold)" },
  B: { label: "Brune", sub: "Ça s'est mal passé", color: "var(--brun)" },
  "": { label: "Non évaluée", sub: "", color: "var(--text-dim)" },
};
const ENGAGEMENT_ORDER = ["V", "J", "D", "B", "R"];
const TEAM = ["Gab", "PA", "Joe"];
const CALL_META = {
  R: { label: "Rejoint", color: "var(--green)" },
  PR: { label: "Pas rejoint", color: "var(--yellow)" },
  "": { label: "—", color: "var(--text-dim)" },
};

function normEngagement(v) { const u = (v || "").trim().toUpperCase(); return ["V", "J", "R", "D", "B"].includes(u) ? u : ""; }
function normCall(v) { const u = (v || "").trim().toUpperCase(); return ["R", "PR"].includes(u) ? u : ""; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(str) {
  const d = parseDate(str);
  if (!d) return "—";
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}
function daysUntil(str) {
  const d = parseDate(str);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function urgencyOf(dealer) {
  const du = daysUntil(dealer.date_prochain_suivi);
  if (du === null) return "sans-date";
  if (du < 0) return "retard";
  if (du <= 3) return "bientot";
  return "a-jour";
}
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function normName(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
// Recherche "intelligente" : ignore accents/tirets/points, et traite St/Ste/Saint/Sainte
// comme équivalents (peu importe lequel est tapé ou lequel est dans la base).
function normSearch(s) {
  let n = normName(s);
  const SAINT_WORDS = new Set(["st", "ste", "saint", "sainte"]);
  n = n
    .split(" ")
    .map((word) => (SAINT_WORDS.has(word) ? "st" : word))
    .join(" ");
  return n;
}

function AppleIcon({ color = "var(--text-dim)", size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9.2c-1-1.6-2.7-2.4-4.4-2.1C5.1 7.5 3.6 9.9 3.9 12.7c.4 3.6 3 7.8 5.4 7.8.9 0 1.3-.4 2.2-.4.9 0 1.3.4 2.2.4 2.1 0 4.4-3.3 5.1-6.2.7-3.1-.6-5.6-2.8-6.1-1.5-.3-3 .3-3.9 1.1-.1.1-.1-.1-.1-.1z" fill={color} />
      <path d="M11.6 8.1c-.3-1.6.3-3.2 1.6-4.3" stroke="#6b4a2f" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M13.1 4.3c.7-.6 1.7-.8 2.6-.5" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function AppleBadge({ code, showSub }) {
  const meta = ENGAGEMENT_META[code] || ENGAGEMENT_META[""];
  return (
    <span className="apple-badge">
      <AppleIcon color={meta.color} size={14} />
      <span>{meta.label}{showSub && meta.sub ? ` · ${meta.sub}` : ""}</span>
    </span>
  );
}
function Chip({ active, onClick, children, dot }) {
  return (
    <button className={`chip ${active ? "chip-active" : ""}`} onClick={onClick} type="button">
      {dot && <span className="chip-dot" style={{ background: dot }} />}
      {children}
    </button>
  );
}
function StatCard({ label, value, accent, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">{Icon && <Icon size={15} />}<span>{label}</span></div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

/* ---------- Dealer detail panel ---------- */
function DealerPanel({ dealer, me, onClose, onLogCall, onSaveInfo, onDelete }) {
  const [tab, setTab] = useState("call");
  const [form, setForm] = useState({ ...dealer });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState({ statut_appel: dealer.statut_appel || "R", engagement: dealer.engagement || "", note: "", nextDays: 7 });

  useEffect(() => { setForm({ ...dealer }); setConfirmingDelete(false); }, [dealer]);

  const history = dealer.history && dealer.history.length ? dealer.history : dealer.note ? [{ date: dealer.date_dernier_contact || "", note: dealer.note }] : [];

  async function submitCall() {
    setBusy(true);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Number(call.nextDays || 0));
    const nextISO = call.nextDays > 0
      ? `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`
      : null;
    await onLogCall(dealer, {
      // Champs "appel"
      statut_appel: call.statut_appel,
      engagement: call.engagement,
      note: call.note,
      date_dernier_contact: todayISO(),
      date_prochain_suivi: nextISO,
      // Champs "infos" embarqués au cas où l'onglet Infos n'a pas été sauvegardé séparément
      concession: form.concession,
      contact: form.contact,
      telephone: form.telephone,
      email: form.email,
      responsable: form.responsable,
    });
    setBusy(false);
  }

  async function submitInfo() {
    setBusy(true);
    await onSaveInfo(dealer.id, form);
    setBusy(false);
  }

  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="panel-eyebrow">{dealer.responsable || "Non assigné"}</div>
            <h2>{dealer.concession}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="panel-meta">
          <AppleBadge code={normEngagement(dealer.engagement)} showSub />
          {dealer.contact && <div className="meta-row"><User size={14} />{dealer.contact}</div>}
          {dealer.telephone && <div className="meta-row"><Phone size={14} /><a href={`tel:${dealer.telephone}`}>{dealer.telephone}</a></div>}
          {dealer.email && <div className="meta-row"><Mail size={14} /><a href={`mailto:${dealer.email}`}>{dealer.email}</a></div>}
        </div>

        <div className="panel-tabs">
          <button className={tab === "call" ? "tab-active" : ""} onClick={() => setTab("call")}>Logger un appel</button>
          <button className={tab === "info" ? "tab-active" : ""} onClick={() => setTab("info")}>Infos</button>
          <button className={tab === "hist" ? "tab-active" : ""} onClick={() => setTab("hist")}>Historique ({history.length})</button>
        </div>

        {tab === "call" && (
          <div className="panel-body">
            <label className="field-label">Résultat de l'appel</label>
            <div className="seg">
              {["R", "PR"].map((k) => (
                <button key={k} className={call.statut_appel === k ? "seg-active" : ""} onClick={() => setCall((c) => ({ ...c, statut_appel: k }))}>{CALL_META[k].label}</button>
              ))}
            </div>
            <label className="field-label">La pomme</label>
            <div className="seg" style={{ flexWrap: "wrap" }}>
              {ENGAGEMENT_ORDER.map((k) => (
                <button key={k} className={`apple-seg-btn ${call.engagement === k ? "seg-active" : ""}`} style={{ flexBasis: "17%", ...(call.engagement === k ? { "--sc": ENGAGEMENT_META[k].color } : {}) }} onClick={() => setCall((c) => ({ ...c, engagement: k }))}>
                  <AppleIcon color={ENGAGEMENT_META[k].color} size={17} />{ENGAGEMENT_META[k].label}
                </button>
              ))}
            </div>
            <label className="field-label">Note</label>
            <textarea className="textarea" rows={3} placeholder="Ce qui s'est dit, prochaine étape..." value={call.note} onChange={(e) => setCall((c) => ({ ...c, note: e.target.value }))} />
            <label className="field-label">Prochain suivi</label>
            <div className="seg" style={{ flexWrap: "wrap" }}>
              {[0, 3, 7, 14, 30, 90, 180].map((n) => (
                <button key={n} style={{ flexBasis: "22%" }} className={call.nextDays === n ? "seg-active" : ""} onClick={() => setCall((c) => ({ ...c, nextDays: n }))}>
                  {n === 0 ? "Aucun" : n >= 90 ? `${n / 30}mo` : `${n}j`}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--text-dim)" }}>
              <span>Ou dans</span>
              <input type="number" min="0" className="input" style={{ width: 70, textAlign: "center" }} value={call.nextDays} onChange={(e) => setCall((c) => ({ ...c, nextDays: Number(e.target.value) || 0 }))} />
              <span>jours</span>
            </div>
            <button className="btn-primary" onClick={submitCall} disabled={busy}>
              {busy ? <Loader2 className="spin-icon" size={15} /> : <Check size={15} />} Enregistrer l'appel
            </button>
          </div>
        )}

        {tab === "info" && (
          <div className="panel-body">
            {[["concession", "Concession"], ["contact", "Contact / FNI"], ["telephone", "Téléphone"], ["email", "Courriel"]].map(([key, label]) => (
              <div key={key}>
                <label className="field-label">{label}</label>
                <input className="input" value={form[key] || ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <label className="field-label">Responsable</label>
            <div className="seg">
              {TEAM.map((name) => (
                <button key={name} className={form.responsable === name ? "seg-active" : ""} onClick={() => setForm((f) => ({ ...f, responsable: name }))}>{name}</button>
              ))}
              <button className={!form.responsable ? "seg-active" : ""} onClick={() => setForm((f) => ({ ...f, responsable: "" }))}>Non assigné</button>
            </div>
            <button className="btn-primary" onClick={submitInfo} disabled={busy}>
              {busy ? <Loader2 className="spin-icon" size={15} /> : <Save size={15} />} Sauvegarder les infos
            </button>

            <div className="danger-zone">
              {!confirmingDelete ? (
                <button className="btn-danger-outline" onClick={() => setConfirmingDelete(true)}><Trash2 size={14} /> Supprimer ce dealer</button>
              ) : (
                <div className="danger-confirm">
                  <span>Supprimer définitivement {dealer.concession} ?</span>
                  <div className="danger-confirm-actions">
                    <button className="btn-cancel" onClick={() => setConfirmingDelete(false)}>Annuler</button>
                    <button className="btn-danger" onClick={() => onDelete(dealer.id)}>Oui, supprimer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "hist" && (
          <div className="panel-body">
            {history.length === 0 && <div className="empty-hint">Aucun historique pour l'instant.</div>}
            <div className="hist-list">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="hist-item">
                  <div className="hist-date">{fmtDate(h.date)}{h.by ? ` · ${h.by}` : ""}</div>
                  <div className="hist-note">{h.note || "(pas de note)"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Personal call history panel ---------- */
function CallHistoryPanel({ dealers, me, onClose, onOpenDealer }) {
  const entries = useMemo(() => {
    const out = [];
    for (const d of dealers) {
      if (!d.history) continue;
      for (const h of d.history) {
        if (h.by === me) out.push({ ...h, dealer: d });
      }
    }
    return out
      .filter((e) => e.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 150);
  }, [dealers, me]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const label = fmtDate(e.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(e);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="panel-eyebrow">{me}</div>
            <h2>Mes appels récents</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {entries.length === 0 && (
          <div className="empty-hint">
            Aucun appel loggé sous ton identité pour l'instant. Les appels que tu logues à partir de maintenant apparaîtront ici.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 10 }}>
          {groups.map(([dateLabel, items]) => (
            <div key={dateLabel} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="panel-eyebrow" style={{ marginBottom: 2 }}>{dateLabel}</div>
              {items.map((e, i) => {
                const eng = normEngagement(e.engagement);
                const call = normCall(e.statut_appel);
                return (
                  <button
                    key={i}
                    className="dealer-row"
                    style={{ padding: "10px 12px" }}
                    onClick={() => onOpenDealer(e.dealer)}
                  >
                    <AppleIcon color={ENGAGEMENT_META[eng].color} size={15} />
                    <div className="dealer-main">
                      <div className="dealer-name" style={{ fontSize: 14 }}>{e.dealer.concession}</div>
                      {e.note && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{e.note}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: CALL_META[call].color, flexShrink: 0 }}>
                      {CALL_META[call].label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Add dealer modal ---------- */
function AddDealerModal({ onClose, onAdd, me }) {
  const [form, setForm] = useState({ concession: "", contact: "", telephone: "", email: "", responsable: "" });
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!form.concession.trim()) return;
    setBusy(true);
    await onAdd(form);
    setBusy(false);
    onClose();
  }
  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><h2>Nouveau dealer</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="panel-body">
          <label className="field-label">Concession *</label>
          <input className="input" autoFocus value={form.concession} onChange={(e) => setForm((f) => ({ ...f, concession: e.target.value }))} />
          <label className="field-label">Contact / FNI</label>
          <input className="input" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
          <label className="field-label">Téléphone</label>
          <input className="input" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
          <label className="field-label">Courriel</label>
          <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <label className="field-label">Responsable</label>
          <div className="seg">
            {TEAM.map((name) => (
              <button key={name} className={form.responsable === name ? "seg-active" : ""} onClick={() => setForm((f) => ({ ...f, responsable: name }))}>{name}</button>
            ))}
            <button className={!form.responsable ? "seg-active" : ""} onClick={() => setForm((f) => ({ ...f, responsable: "" }))}>Non assigné</button>
          </div>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? <Loader2 className="spin-icon" size={15} /> : <Plus size={15} />} Ajouter le dealer</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main dashboard ---------- */
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [dealers, setDealers] = useState(null);
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState(() => (typeof window !== "undefined" && localStorage.getItem("filter-resp")) || "tous");
  const [urgencyFilter, setUrgencyFilter] = useState(() => (typeof window !== "undefined" && localStorage.getItem("filter-urgency")) || "tous");
  const [engFilter, setEngFilter] = useState(() => (typeof window !== "undefined" && localStorage.getItem("filter-eng")) || "tous");
  const [callFilter, setCallFilter] = useState(() => (typeof window !== "undefined" && localStorage.getItem("filter-call")) || "tous");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState("");

  const me = user?.user_metadata?.display_name || user?.email || "";

  // Auth guard + load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setUser(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const loadDealers = useCallback(async () => {
    const { data, error } = await supabase.from("dealers").select("*").order("concession");
    if (!error) setDealers(data || []);
  }, []);

  useEffect(() => { loadDealers(); }, [loadDealers]);

  // Realtime sync — everyone sees changes instantly, no refresh button needed
  useEffect(() => {
    const channel = supabase
      .channel("dealers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dealers" }, () => {
        loadDealers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadDealers]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  useEffect(() => { localStorage.setItem("filter-resp", respFilter); }, [respFilter]);
  useEffect(() => { localStorage.setItem("filter-urgency", urgencyFilter); }, [urgencyFilter]);
  useEffect(() => { localStorage.setItem("filter-eng", engFilter); }, [engFilter]);
  useEffect(() => { localStorage.setItem("filter-call", callFilter); }, [callFilter]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function addDealer(form) {
    const newRow = {
      concession: form.concession.trim(),
      contact: form.contact.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      responsable: form.responsable || "",
      history: [],
    };
    const { data, error } = await supabase.from("dealers").insert(newRow).select().single();
    if (!error && data) {
      setToast(`${form.concession} ajouté`);
      setDealers((prev) => [data, ...prev]);
    }
  }

  async function saveInfo(id, form) {
    const patch = {
      concession: form.concession, contact: form.contact, telephone: form.telephone,
      email: form.email, responsable: form.responsable,
    };
    const { error } = await supabase.from("dealers").update(patch).eq("id", id);
    if (!error) {
      setToast("Infos sauvegardées");
      setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      setDealers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    }
  }

  async function logCall(dealer, payload) {
    const hist = dealer.history && dealer.history.length ? [...dealer.history] : dealer.note ? [{ date: dealer.date_dernier_contact || "", note: dealer.note }] : [];
    hist.push({ date: payload.date_dernier_contact, note: payload.note || "", by: me, statut_appel: payload.statut_appel, engagement: payload.engagement });
    const wasUnassigned = !dealer.responsable;
    // payload.responsable vient de l'onglet Infos — s'il n'a pas été touché, il vaut déjà dealer.responsable.
    const resolvedResponsable = payload.responsable || (wasUnassigned ? me : dealer.responsable);
    const fullPatch = { ...payload, responsable: resolvedResponsable, history: hist };
    const { error } = await supabase.from("dealers").update(fullPatch).eq("id", dealer.id);
    if (!error) {
      setToast(wasUnassigned && resolvedResponsable === me ? `Appel enregistré · attribué à ${me}` : "Appel enregistré");
      setSelected(null);
      setDealers((prev) => prev.map((d) => (d.id === dealer.id ? { ...d, ...fullPatch } : d)));
    }
  }

  async function deleteDealer(id) {
    const target = dealers.find((d) => d.id === id);
    const { error } = await supabase.from("dealers").delete().eq("id", id);
    if (!error) {
      setToast(`${target ? target.concession : "Dealer"} supprimé`);
      setSelected(null);
      setDealers((prev) => prev.filter((d) => d.id !== id));
    }
  }

  function exportCSV() {
    const cols = ["responsable", "concession", "contact", "telephone", "email", "statut_appel", "engagement", "date_dernier_contact", "date_prochain_suivi", "note"];
    const rows = [cols.join(",")].concat(dealers.map((d) => cols.map((c) => csvEscape(d[c])).join(",")));
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prospection-dealers-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    if (!dealers) return [];
    const q = normSearch(search);
    return dealers.filter((d) => {
      if (q) {
        const hay = normSearch(`${d.concession} ${d.contact || ""} ${d.telephone || ""} ${d.email || ""}`);
        if (!hay.includes(q)) return false;
      }
      if (respFilter === "moi" && d.responsable !== me) return false;
      if (respFilter === "none" && d.responsable) return false;
      if (respFilter !== "tous" && respFilter !== "moi" && respFilter !== "none" && d.responsable !== respFilter) return false;
      if (urgencyFilter !== "tous" && urgencyOf(d) !== urgencyFilter) return false;
      if (engFilter !== "tous") {
        const e = normEngagement(d.engagement);
        if (engFilter === "none" ? e !== "" : e !== engFilter) return false;
      }
      if (callFilter !== "tous") {
        const c = normCall(d.statut_appel);
        if (callFilter === "none" ? c !== "" : c !== callFilter) return false;
      }
      return true;
    });
  }, [dealers, search, respFilter, urgencyFilter, engFilter, callFilter, me]);

  const sorted = useMemo(() => {
    const rank = { retard: 0, bientot: 1, "a-jour": 2, "sans-date": 3 };
    return [...filtered].sort((a, b) => {
      const ra = rank[urgencyOf(a)], rb = rank[urgencyOf(b)];
      if (ra !== rb) return ra - rb;
      const da = daysUntil(a.date_prochain_suivi), db = daysUntil(b.date_prochain_suivi);
      if (da !== null && db !== null) return da - db;
      return a.concession.localeCompare(b.concession);
    });
  }, [filtered]);

  const stats = useMemo(() => {
    if (!dealers) return null;
    const scoped = respFilter === "moi" ? dealers.filter((d) => d.responsable === me) : dealers;
    return {
      total: scoped.length,
      retard: scoped.filter((d) => urgencyOf(d) === "retard").length,
      bientot: scoped.filter((d) => urgencyOf(d) === "bientot").length,
      cetteSemaine: scoped.filter((d) => { const du = daysUntil(d.date_dernier_contact); return du !== null && du <= 0 && du >= -7; }).length,
    };
  }, [dealers, respFilter, me]);

  if (!user || !dealers) {
    return <div className="auth-shell"><Loader2 className="spin-icon" size={22} /></div>;
  }

  return (
    <div className="page">

      <div className="header-top">
        <div>
          <div className="eyebrow">Prospecting Fanatical</div>
          <h1>Prime Cartel</h1>
        </div>
        <div className="header-actions">
          <span className="who-pill"><User size={13} /> {me}</span>
          <button className="icon-btn" onClick={() => setShowHistory(true)} title="Mes appels récents"><Clock size={16} /></button>
          <button className="icon-btn" onClick={exportCSV} title="Exporter en CSV"><Download size={17} /></button>
          <button className="icon-btn" onClick={logout} title="Se déconnecter"><LogOut size={16} /></button>
          <button className="btn-primary" style={{ width: "auto", marginTop: 0, padding: "9px 14px" }} onClick={() => setShowAdd(true)}><Plus size={15} /> Dealer</button>
        </div>
      </div>

      <div className="stat-strip">
        <StatCard label={respFilter === "moi" ? "Mes dossiers" : "Concessions"} value={stats.total} icon={TrendingUp} />
        <StatCard label="En retard" value={stats.retard} accent="var(--red)" icon={AlertTriangle} />
        <StatCard label="D'ici 3 jours" value={stats.bientot} accent="var(--yellow)" icon={Clock} />
        <StatCard label="Contactés (7j)" value={stats.cetteSemaine} accent="var(--accent)" icon={Phone} />
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Chercher une concession, un contact, un numéro…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="chip-row">
          <span className="chip-row-label">Qui</span>
          <Chip active={respFilter === "tous"} onClick={() => setRespFilter("tous")}>Tous</Chip>
          <Chip active={respFilter === "moi"} onClick={() => setRespFilter("moi")}>Mes dossiers</Chip>
          {TEAM.filter((r) => r !== me).map((r) => (
            <Chip key={r} active={respFilter === r} onClick={() => setRespFilter(r)}>{r}</Chip>
          ))}
          <Chip active={respFilter === "none"} onClick={() => setRespFilter("none")}>Non assigné</Chip>
        </div>

        <div className="chip-row">
          <span className="chip-row-label">Urgence</span>
          <Chip active={urgencyFilter === "tous"} onClick={() => setUrgencyFilter("tous")}>Toutes</Chip>
          <Chip active={urgencyFilter === "retard"} onClick={() => setUrgencyFilter("retard")} dot="var(--red)">En retard</Chip>
          <Chip active={urgencyFilter === "bientot"} onClick={() => setUrgencyFilter("bientot")} dot="var(--yellow)">Bientôt</Chip>
          <Chip active={urgencyFilter === "a-jour"} onClick={() => setUrgencyFilter("a-jour")} dot="var(--green)">À jour</Chip>
          <Chip active={urgencyFilter === "sans-date"} onClick={() => setUrgencyFilter("sans-date")}>Sans date</Chip>
        </div>

        <div className="chip-row">
          <span className="chip-row-label">Pomme</span>
          <Chip active={engFilter === "tous"} onClick={() => setEngFilter("tous")}>Toutes</Chip>
          {ENGAGEMENT_ORDER.map((k) => (
            <Chip key={k} active={engFilter === k} onClick={() => setEngFilter(k)} dot={ENGAGEMENT_META[k].color}>{ENGAGEMENT_META[k].label}</Chip>
          ))}
        </div>

        <div className="chip-row">
          <span className="chip-row-label">Statut d'appel</span>
          <Chip active={callFilter === "tous"} onClick={() => setCallFilter("tous")}>Tous</Chip>
          <Chip active={callFilter === "R"} onClick={() => setCallFilter("R")} dot={CALL_META.R.color}>Rejoint</Chip>
          <Chip active={callFilter === "PR"} onClick={() => setCallFilter("PR")} dot="var(--yellow)">Pas rejoint</Chip>
        </div>
      </div>

      <div className="list-meta">{sorted.length} résultat{sorted.length !== 1 ? "s" : ""}</div>

      <div className="dealer-list">
        {sorted.map((d) => {
          const urg = urgencyOf(d);
          const eng = normEngagement(d.engagement);
          return (
            <button key={d.id} className="dealer-row" onClick={() => setSelected(d)}>
              <span className="urg-bar" style={{ background: ENGAGEMENT_META[eng].color }} />
              <div className="dealer-main">
                <div className="dealer-line1">
                  <span className="dealer-name">{d.concession}</span>
                  {d.responsable && <span className="badge" style={{ "--bc": "var(--text-dim)" }}>{d.responsable}</span>}
                </div>
                <div className="dealer-line2">
                  {d.contact && <span>{d.contact}</span>}
                  {d.telephone && <span className="mono">{d.telephone}</span>}
                </div>
              </div>
              <div className="dealer-side">
                <AppleBadge code={eng} />
                <span className={`due due-${urg}`}>{d.date_prochain_suivi ? fmtDate(d.date_prochain_suivi) : "Aucun suivi"}</span>
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && <div className="empty-hint">Aucun dealer ne correspond à ces filtres.</div>}
      </div>

      {selected && (
        <DealerPanel dealer={selected} me={me} onClose={() => setSelected(null)} onLogCall={logCall} onSaveInfo={saveInfo} onDelete={deleteDealer} />
      )}
      {showAdd && <AddDealerModal onClose={() => setShowAdd(false)} onAdd={addDealer} me={me} />}
      {showHistory && (
        <CallHistoryPanel
          dealers={dealers}
          me={me}
          onClose={() => setShowHistory(false)}
          onOpenDealer={(d) => { setShowHistory(false); setSelected(d); }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
