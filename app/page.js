"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/dashboard" : "/login");
      setChecking(false);
    });
  }, [router]);

  return (
    <div className="auth-shell">
      {checking && <Loader2 className="spin-icon" size={22} />}
    </div>
  );
}
