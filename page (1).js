"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedUpMsg, setSignedUpMsg] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError("Courriel ou mot de passe incorrect.");
      router.replace("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() || email.split("@")[0] } },
      });
      setBusy(false);
      if (error) return setError(error.message);
      setSignedUpMsg(true);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Prospecting Fanatical</div>
        <h1>Rats d'Égouts</h1>
        <p className="sub">
          {mode === "login" ? "Connecte-toi avec ton compte d'équipe." : "Crée ton compte (une seule fois)."}
        </p>

        {signedUpMsg ? (
          <p style={{ color: "var(--green)", fontSize: 13.5 }}>
            Compte créé ! Selon la configuration, tu devras peut-être confirmer ton courriel avant de te connecter — sinon, connecte-toi directement.
          </p>
        ) : (
          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <label className="field-label">Ton nom (G, P, J, ou ce que tu préfères)</label>
                <input className="input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex: Gab" />
              </>
            )}
            <label className="field-label">Courriel</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="field-label">Mot de passe</label>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary" disabled={busy} type="submit">
              {mode === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        )}

        <div className="auth-switch">
          {mode === "login" ? (
            <>Pas encore de compte ? <button onClick={() => { setMode("signup"); setError(""); }}>En créer un</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => { setMode("login"); setError(""); setSignedUpMsg(false); }}>Se connecter</button></>
          )}
        </div>
      </div>
    </div>
  );
}
