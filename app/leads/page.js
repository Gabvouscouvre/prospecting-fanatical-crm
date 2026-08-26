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

/* ---------- Add lead modal ---------- */
function AddLeadModal({ onClose, onAdd, dealerNames, defaultRateFor }) {
  const [dealerName, setDealerName] = useState("");
  const [fniName, setFniName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  useEffect(() => {
    if (amountTouched) return;
    const rate = defaultRateFor(dealerName.trim(), fniName.trim());
    if (rate) setAmount(String(rate));
  }, [dealerName, fniName, amountTouched, defaultRateFor]);

  async function submit() {
    if (!dealerName.trim() || !fniName.trim() || !leadName.trim()) return;
    setBusy(true);
    await onAdd({
      dealer_name: dealerName.trim(),
      fni_name: fniName.trim(),
      lead_name: leadName.trim(),
      lead_date: date,
      amount: Number(amount) || 0,
    });
    setBusy(false);
    onClose();
  }

  return (
    <div className="panel-overlay">
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><h2>Ajouter un lead</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="panel-body">
          <label className="field-label">Dealer *</label>
          <input className="input" list="dealer-names" value={dealerName} onChange={(e) => setDealerName(e.target.value)} placeholder="Ex: Toyota Gatineau" />
          <datalist id="dealer-names">{dealerNames.map((n) => <option key={n} value={n} />)}</datalist>

          <label className="field-label">FNI *</label>
          <input className="input" value={fniName} onChange={(e) => setFniName(e.target.value)} placeholder="Ex: Marc-André" />

          <label className="field-label">Nom du lead *</label>
          <input className="input" autoFocus value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Ex: Karine Boudreau" />

          <label className="field-label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label className="field-label">Montant du lead</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }}
            placeholder="0.00"
          />

          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="spin-icon" size={15} /> : <Plus size={15} />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Edit rate inline ---------- */
function RateEditor({ value, onSave, onCancel }) {
  const [v, setV] = useState(String(value || ""));
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        className="input"
        type="number"
        step="0.01"
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        style={{ width: 80, padding: "4px 8px", fontSize: 12 }}
      />
      <button
        className="icon-btn"
        style={{ width: 26, height: 26 }}
        disabled={busy}
        onClick={async () => { setBusy(true); await onSave(Number(v) || 0); setBusy(false); }}
      >
        {busy ? <Loader2 className="spin-icon" size={12} /> : "✓"}
      </button>
      <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onCancel}>✕</button>
    </div>
  );
}

/* ---------- Main page ---------- */
export default function LeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState(null);
  const [rates, setRates] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRateKey, setEditingRateKey] = useState(null);
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

  function rateFor(dealerName, fniName) {
    const r = rates.find((r) => r.dealer_name === dealerName && r.fni_name === fniName);
    return r ? r.rate : 0;
  }

  async function addLead(form) {
    const { data, error } = await supabase.from("paid_leads").insert({ ...form, status: "non_soumis" }).select().single();
    if (!error && data) {
      setLeads((prev) => [data, ...prev]);
      setToast(`${form.lead_name} ajouté`);
      const existing = rates.find((r) => r.dealer_name === form.dealer_name && r.fni_name === form.fni_name);
      if (!existing) {
        const { data: rateRow } = await supabase.from("fni_rates").upsert(
          { dealer_name: form.dealer_name, fni_name: form.fni_name, rate: form.amount },
          { onConflict: "user_id,dealer_name,fni_name" }
        ).select().single();
        if (rateRow) setRates((prev) => [...prev, rateRow]);
      }
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

  async function saveRate(dealerName, fniName, newRate) {
    const { data, error } = await supabase.from("fni_rates").upsert(
      { dealer_name: dealerName, fni_name: fniName, rate: newRate, updated_at: new Date().toISOString() },
      { onConflict: "user_id,dealer_name,fni_name" }
    ).select().single();
    if (!error && data) {
      setRates((prev) => {
        const others = prev.filter((r) => !(r.dealer_name === dealerName && r.fni_name === fniName));
        return [...others, data];
      });
      setToast("Taux mis à jour");
    }
    setEditingRateKey(null);
  }

  const groups = useMemo(() => {
    if (!leads) return [];
    const map = new Map();
    for (const l of leads) {
      const key = `${l.dealer_name}|||${l.fni_name}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return [...map.entries()]
      .map(([key, items]) => {
        const [dealer_name, fni_name] = key.split("|||");
        const soumis = items.filter((i) => i.status === "soumis");
        return {
          key, dealer_name, fni_name, items,
          soumisCount: soumis.length,
          total: items.length,
          totalAmount: soumis.reduce((s, i) => s + Number(i.amount || 0), 0),
        };
      })
      .sort((a, b) => a.dealer_name.localeCompare(b.dealer_name) || a.fni_name.localeCompare(b.fni_name));
  }, [leads]);

  if (!user || !leads) {
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

      <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setShowAdd(true)}>
        <Plus size={15} /> Ajouter un lead
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        {groups.length === 0 && <div className="empty-hint">Aucun lead payant enregistré pour l'instant.</div>}
        {groups.map((g) => {
          const rateKey = g.key;
          const rate = rateFor(g.dealer_name, g.fni_name);
          return (
            <div key={g.key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {g.dealer_name} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· FNI {g.fni_name}</span>
                  </div>
                  {editingRateKey === rateKey ? (
                    <div style={{ marginTop: 4 }}>
                      <RateEditor value={rate} onSave={(v) => saveRate(g.dealer_name, g.fni_name, v)} onCancel={() => setEditingRateKey(null)} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                      {fmtMoney(rate)} / lead
                      <button className="icon-btn" style={{ width: 20, height: 20, padding: 0 }} onClick={() => setEditingRateKey(rateKey)}>
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{g.soumisCount} soumis sur {g.total}</div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>{fmtMoney(g.totalAmount)}</div>
                </div>
              </div>

              {g.items.map((lead) => {
                const meta = STATUS_META[lead.status] || STATUS_META.non_soumis;
                return (
                  <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
                    <span className="mono" style={{ color: "var(--text-dim)", width: 52, flexShrink: 0 }}>{fmtDate(lead.lead_date)}</span>
                    <span style={{ flex: 1 }}>{lead.lead_name}</span>
                    <span style={{ color: "var(--text-dim)" }}>{fmtMoney(lead.amount)}</span>
                    <button
                      onClick={() => cycleStatus(lead)}
                      style={{ background: meta.bg, color: meta.color, border: "none", borderRadius: 999, padding: "3px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                    >
                      {meta.label}
                    </button>
                    <button className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }} onClick={() => deleteLead(lead.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onAdd={addLead} dealerNames={dealerNames} defaultRateFor={rateFor} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
