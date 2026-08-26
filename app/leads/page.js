"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react";

const STATUS_ORDER = ["non_soumis", "en_attente", "soumis"];
const STATUS_META = {
  non_soumis: { label: "Non soumis", bg: "#2a1414", color: "var(--red)" },
  en_attente: { label: "En attente", bg: "#2a2113", color: "var(--yellow)" },
  soumis: { label: "Soumis", bg: "#132a1e", color: "var(--green)" },
};
function nextStatus(s) {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}
function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtMoney(n) {
  return `${(Number(n) || 0).toFixed(2).replace(/\.00$/, "")} $`;
}

/* ---------- Étape 1 : créer un nouveau plan (dealer + FNI + montant) ---------- */
function CreatePlanModal({ onClose, onCreate, dealerNames }) {
  const [dealerName, setDealerName] = useState("");
  const [fniName, setFniName] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!dealerName.trim() || !fniName.trim()) return;
    setBusy(true);
    await onCreate({ dealer_name: dealerName.trim(), fni_name: fniName.trim(), rate: Number(rate) || 0 });
    setBusy(false);
    onClose();
  }

  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><h2>Nouveau plan</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="panel-body">
          <p className="import-hint">Établis l'entente avec un FNI d'un dealer — tu pourras ensuite y ajouter des leads au fur et à mesure.</p>
          <label className="field-label">Dealer *</label>
          <input className="input" list="dealer-names" value={dealerName} onChange={(e) => setDealerName(e.target.value)} placeholder="Ex: Toyota Gatineau" />
          <datalist id="dealer-names">{dealerNames.map((n) => <option key={n} value={n} />)}</datalist>

          <label className="field-label">FNI *</label>
          <input className="input" autoFocus value={fniName} onChange={(e) => setFniName(e.target.value)} placeholder="Ex: Marc-André" />

          <label className="field-label">Montant par lead</label>
          <input className="input" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />

          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="spin-icon" size={15} /> : <Plus size={15} />} Créer le plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Étape 2 : ajouter un lead sous un plan existant ---------- */
function AddLeadModal({ group, onClose, onAdd }) {
  const [leadName, setLeadName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState("non_soumis");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!leadName.trim()) return;
    setBusy(true);
    await onAdd({ dealer_name: group.dealer_name, fni_name: group.fni_name, lead_name: leadName.trim(), lead_date: date, amount: group.rate, status });
    setBusy(false);
    onClose();
  }

  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="panel-eyebrow">{group.dealer_name} · FNI {group.fni_name}</div>
            <h2>Nouveau lead</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="panel-body">
          <label className="field-label">Nom du lead *</label>
          <input className="input" autoFocus value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Ex: Karine Boudreau" />

          <label className="field-label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label className="field-label">Statut</label>
          <div className="seg">
            {STATUS_ORDER.map((s) => (
              <button key={s} className={status === s ? "seg-active" : ""} style={status === s ? { "--sc": STATUS_META[s].color } : undefined} onClick={() => setStatus(s)}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="spin-icon" size={15} /> : <Plus size={15} />} Ajouter le lead
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Édition inline du montant ---------- */
function RateEditor({ value, onSave, onCancel }) {
  const [v, setV] = useState(String(value || ""));
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input className="input" type="number" step="0.01" autoFocus value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80, padding: "4px 8px", fontSize: 12 }} />
      <button className="icon-btn" style={{ width: 26, height: 26 }} disabled={busy} onClick={async () => { setBusy(true); await onSave(Number(v) || 0); setBusy(false); }}>
        {busy ? <Loader2 className="spin-icon" size={12} /> : "✓"}
      </button>
      <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onCancel}>✕</button>
    </div>
  );
}

/* ---------- Page principale ---------- */
export default function LeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState(null);
  const [rates, setRates] = useState(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [addLeadFor, setAddLeadFor] = useState(null);
  const [editingRateId, setEditingRateId] = useState(null);
  const [toast, setToast] = useState("");
  const [dealerNames, setDealerNames] = useState([]);

  const me = user?.user_metadata?.display_name || user?.email || "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setUser(data.session.user);
    });
  }, [router]);

  const load = useCallback(async () => {
    const [leadsRes, ratesRes, dealersRes] = await Promise.all([
      supabase.from("paid_leads").select("*").order("lead_date", { ascending: false }),
      supabase.from("fni_rates").select("*"),
      supabase.from("dealers").select("concession"),
    ]);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    if (!ratesRes.error) setRates(ratesRes.data || []);
    if (!dealersRes.error) setDealerNames([...new Set((dealersRes.data || []).map((d) => d.concession))].sort());
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  async function createPlan(form) {
    const { data, error } = await supabase.from("fni_rates").upsert(
      { dealer_name: form.dealer_name, fni_name: form.fni_name, rate: form.rate, updated_at: new Date().toISOString() },
      { onConflict: "user_id,dealer_name,fni_name" }
    ).select().single();
    if (!error && data) {
      setRates((prev) => [...prev.filter((r) => !(r.dealer_name === form.dealer_name && r.fni_name === form.fni_name)), data]);
      setToast(`Plan créé — ${form.dealer_name} / ${form.fni_name}`);
    }
  }

  async function addLead(form) {
    const { data, error } = await supabase.from("paid_leads").insert(form).select().single();
    if (!error && data) {
      setLeads((prev) => [data, ...prev]);
      setToast(`${form.lead_name} ajouté`);
    }
  }

  async function cycleStatus(lead) {
    const status = nextStatus(lead.status);
    const { error } = await supabase.from("paid_leads").update({ status }).eq("id", lead.id);
    if (!error) setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
  }

  async function deleteLead(id) {
    const { error } = await supabase.from("paid_leads").delete().eq("id", id);
    if (!error) { setLeads((prev) => prev.filter((l) => l.id !== id)); setToast("Lead supprimé"); }
  }

  async function saveRate(rateRow, newRate) {
    const { data, error } = await supabase.from("fni_rates").update({ rate: newRate, updated_at: new Date().toISOString() }).eq("id", rateRow.id).select().single();
    if (!error && data) {
      setRates((prev) => prev.map((r) => (r.id === rateRow.id ? data : r)));
      setToast("Montant mis à jour");
    }
    setEditingRateId(null);
  }

  const groups = useMemo(() => {
    if (!rates || !leads) return [];
    return rates
      .map((r) => {
        const items = leads.filter((l) => l.dealer_name === r.dealer_name && l.fni_name === r.fni_name);
        const soumis = items.filter((i) => i.status === "soumis");
        return { ...r, items, soumisCount: soumis.length, total: items.length, totalAmount: soumis.reduce((s, i) => s + Number(i.amount || 0), 0) };
      })
      .sort((a, b) => a.dealer_name.localeCompare(b.dealer_name) || a.fni_name.localeCompare(b.fni_name));
  }, [rates, leads]);

  if (!user || !rates || !leads) {
    return <div className="auth-shell"><Loader2 className="spin-icon" size={22} /></div>;
  }

  return (
    <div className="page">
      <div className="header-top">
        <button className="icon-btn" onClick={() => router.push("/dashboard")}><ArrowLeft size={17} /></button>
        <div>
          <div className="eyebrow">Mes leads payants</div>
          <h1 style={{ fontSize: 22 }}>{me}</h1>
        </div>
        <div />
      </div>

      <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCreatePlan(true)}>
        <Plus size={15} /> Nouveau plan (dealer + FNI)
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        {groups.length === 0 && <div className="empty-hint">Aucun plan encore. Commence par en créer un ci-dessus.</div>}
        {groups.map((g) => (
          <div key={g.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {g.dealer_name} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· FNI {g.fni_name}</span>
                </div>
                {editingRateId === g.id ? (
                  <div style={{ marginTop: 4 }}>
                    <RateEditor value={g.rate} onSave={(v) => saveRate(g, v)} onCancel={() => setEditingRateId(null)} />
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                    {fmtMoney(g.rate)} / lead
                    <button className="icon-btn" style={{ width: 20, height: 20, padding: 0 }} onClick={() => setEditingRateId(g.id)}><Pencil size={11} /></button>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{g.soumisCount} soumis sur {g.total}</div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>{fmtMoney(g.totalAmount)}</div>
              </div>
            </div>

            {g.items.length === 0 && <div className="empty-hint" style={{ padding: "6px 0" }}>Aucun lead encore sous ce plan.</div>}
            {g.items.map((lead) => {
              const meta = STATUS_META[lead.status] || STATUS_META.non_soumis;
              return (
                <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
                  <span className="mono" style={{ color: "var(--text-dim)", width: 52, flexShrink: 0 }}>{fmtDate(lead.lead_date)}</span>
                  <span style={{ flex: 1 }}>{lead.lead_name}</span>
                  <span style={{ color: "var(--text-dim)" }}>{fmtMoney(lead.amount)}</span>
                  <button onClick={() => cycleStatus(lead)} style={{ background: meta.bg, color: meta.color, border: "none", borderRadius: 999, padding: "3px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                    {meta.label}
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }} onClick={() => deleteLead(lead.id)}><Trash2 size={12} /></button>
                </div>
              );
            })}

            <button
              onClick={() => setAddLeadFor(g)}
              style={{ marginTop: 10, width: "100%", background: "var(--surface-2)", border: "1px dashed var(--border)", borderRadius: 8, padding: "8px", fontSize: 12, color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Plus size={13} /> Ajouter un lead ici
            </button>
          </div>
        ))}
      </div>

      {showCreatePlan && <CreatePlanModal onClose={() => setShowCreatePlan(false)} onCreate={createPlan} dealerNames={dealerNames} />}
      {addLeadFor && <AddLeadModal group={addLeadFor} onClose={() => setAddLeadFor(null)} onAdd={addLead} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
