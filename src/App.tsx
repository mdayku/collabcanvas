import { useEffect, useState } from "react";
import Canvas from "./Canvas";
import { supabase } from "./lib/supabaseClient";
import { useCanvas, randomColor } from "./state/store";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) await supabase.auth.signInAnonymously();
      const name = localStorage.getItem("cc_name") || prompt("Enter display name") || "Guest";
      localStorage.setItem("cc_name", name);
      useCanvas.setState((s) => { s.me.name = name; s.me.color = s.me.color || randomColor(); });
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="h-screen grid place-items-center">Loading…</div>;
  return <Canvas/>;
}
