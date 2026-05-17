import { useState } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase config ──────────────────────────────────────────
// Replace these with your actual Supabase project values
const SUPABASE_URL  = "https://xrxrrimuxjufpaguejfi.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyeHJyaW11eGp1ZnBhZ3VlamZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODUyMjUsImV4cCI6MjA5NDU2MTIyNX0.sxZ19RlxpVstZrDGCP-0AYlIXdpyp4nCr7VQ87Eq8Y8";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Role definitions ─────────────────────────────────────────
const ROLES = [
  {
    id: "doctor",
    label: "Doctor",
    icon: "⚕",
    desc: "View your consultation scores",
    color: "#0a6640",
    bg: "#e6f4ed",
  },
  {
    id: "owner",
    label: "Clinic Owner",
    icon: "🏥",
    desc: "Manage your clinic's performance",
    color: "#1a4fa0",
    bg: "#e8eef8",
  },
  {
    id: "admin",
    label: "Admin",
    icon: "⚙",
    desc: "Full platform access",
    color: "#7a3800",
    bg: "#fdf0e6",
  },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green:  #0a6640;
    --green2: #0d7f50;
    --light:  #f7faf8;
    --white:  #ffffff;
    --border: #dde8e2;
    --text:   #0f1f16;
    --muted:  #6b8070;
    --error:  #c0392b;
  }
  body { background: var(--light); font-family: 'DM Sans', sans-serif; color: var(--text); min-height: 100vh; }
  input { font-family: 'DM Sans', sans-serif; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  .fade-up  { animation: fadeUp  0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-in  { animation: fadeIn  0.3s ease both; }
  .shake    { animation: shake   0.4s ease; }
`;

export default function App() {
  const [step, setStep]         = useState("role");       // role | login | signup | success
  const [role, setRole]         = useState(null);
  const [mode, setMode]         = useState("login");      // login | signup
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);

  const selectedRole = ROLES.find(r => r.id === role);

  function triggerError(msg) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function selectRole(r) {
    setRole(r.id);
    setStep("login");
    setError("");
    setEmail(""); setPassword(""); setName("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { triggerError("Please fill in all fields."); return; }
    setLoading(true); setError("");

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setLoading(false);
      if (err.message.includes("Invalid")) triggerError("Email or password is incorrect.");
      else triggerError(err.message);
      return;
    }

    // Check role matches
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", data.user.id)
      .single();

    if (profile && profile.role !== role) {
      await supabase.auth.signOut();
      setLoading(false);
      triggerError(`This account is registered as a ${profile.role}, not a ${role}.`);
      return;
    }

    setLoading(false);
    setStep("success");
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!name || !email || !password) { triggerError("Please fill in all fields."); return; }
    if (password.length < 6) { triggerError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");

    const { data, error: err } = await supabase.auth.signUp({ email, password });

    if (err) {
      setLoading(false);
      triggerError(err.message);
      return;
    }

    // Create profile row
    if (data.user) {
      await supabase.from("profiles").insert({
        id:        data.user.id,
        full_name: name,
        role:      role,
      });
    }

    setLoading(false);
    setStep("success");
  }

  return (
    <>
      <style>{CSS}</style>

      {/* Background pattern */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: "var(--light)",
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(10,102,64,0.06) 0%, transparent 50%),
                          radial-gradient(circle at 80% 80%, rgba(10,102,64,0.04) 0%, transparent 50%)`,
      }}/>

      {/* Cross pattern top-right */}
      <div style={{position:"fixed",top:0,right:0,width:300,height:300,opacity:0.04,zIndex:0,
        backgroundImage:`repeating-linear-gradient(0deg,#0a6640 0,#0a6640 1px,transparent 1px,transparent 24px),
                         repeating-linear-gradient(90deg,#0a6640 0,#0a6640 1px,transparent 1px,transparent 24px)`}}/>

      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 20px", position: "relative", zIndex: 1,
      }}>

        {/* Logo */}
        <div className="fade-up" style={{textAlign:"center", marginBottom: 40}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{
              width:38,height:38,borderRadius:10,background:"var(--green)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,color:"#fff",
            }}>⚕</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:600,letterSpacing:"-0.01em"}}>DocRate</span>
          </div>
          <p style={{fontSize:13,color:"var(--muted)"}}>Healthcare consultation quality platform</p>
        </div>

        {/* ── STEP: ROLE SELECTION ── */}
        {step === "role" && (
          <div className="fade-up" style={{animationDelay:"80ms",width:"100%",maxWidth:440}}>
            <div style={{
              background:"var(--white)",borderRadius:20,
              border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",
              overflow:"hidden",
            }}>
              <div style={{padding:"28px 28px 20px"}}>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,marginBottom:6}}>
                  Sign in to DocRate
                </h1>
                <p style={{fontSize:14,color:"var(--muted)"}}>Select your role to continue</p>
              </div>

              <div style={{padding:"0 20px 24px",display:"flex",flexDirection:"column",gap:10}}>
                {ROLES.map((r, i) => (
                  <button
                    key={r.id}
                    className="fade-up"
                    onClick={() => selectRole(r)}
                    style={{
                      animationDelay: `${120 + i * 60}ms`,
                      display:"flex",alignItems:"center",gap:16,
                      padding:"16px 18px",borderRadius:12,
                      border:`1px solid ${r.color}22`,
                      background: r.bg,
                      cursor:"pointer",textAlign:"left",
                      transition:"all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = r.color+"66"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${r.color}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = r.color+"22"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{
                      width:44,height:44,borderRadius:12,
                      background:"#fff",border:`1px solid ${r.color}22`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:20,flexShrink:0,
                    }}>{r.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:500,color:r.color,marginBottom:2}}>{r.label}</div>
                      <div style={{fontSize:12,color:"var(--muted)"}}>{r.desc}</div>
                    </div>
                    <div style={{color:r.color,fontSize:18,opacity:0.5}}>›</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: LOGIN / SIGNUP FORM ── */}
        {(step === "login" || step === "signup") && selectedRole && (
          <div className={`fade-up ${shake ? "shake" : ""}`}
            style={{width:"100%",maxWidth:400}}>
            <div style={{
              background:"var(--white)",borderRadius:20,
              border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",
              overflow:"hidden",
            }}>
              {/* Role pill */}
              <div style={{
                padding:"20px 24px 0",
                display:"flex",alignItems:"center",justifyContent:"space-between",
              }}>
                <button onClick={() => { setStep("role"); setError(""); }}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:13,display:"flex",alignItems:"center",gap:4}}>
                  ← Back
                </button>
                <div style={{
                  display:"flex",alignItems:"center",gap:6,
                  padding:"5px 12px",borderRadius:99,
                  background: selectedRole.bg,
                  border:`1px solid ${selectedRole.color}22`,
                }}>
                  <span style={{fontSize:14}}>{selectedRole.icon}</span>
                  <span style={{fontSize:12,fontWeight:500,color:selectedRole.color}}>{selectedRole.label}</span>
                </div>
              </div>

              <div style={{padding:"18px 24px 8px"}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,marginBottom:4}}>
                  {mode === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p style={{fontSize:13,color:"var(--muted)"}}>
                  {mode === "login"
                    ? `Sign in as ${selectedRole.label}`
                    : `Register as ${selectedRole.label}`}
                </p>
              </div>

              <form
                onSubmit={mode === "login" ? handleLogin : handleSignup}
                style={{padding:"16px 24px 24px",display:"flex",flexDirection:"column",gap:14}}
              >
                {/* Full name — signup only */}
                {mode === "signup" && (
                  <div className="fade-in">
                    <label style={{fontSize:12,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:6}}>
                      Full name
                    </label>
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Dr. Priya Sharma"
                      style={{
                        width:"100%",padding:"11px 14px",borderRadius:10,
                        border:`1px solid ${error && !name ? "var(--error)" : "var(--border)"}`,
                        fontSize:14,outline:"none",background:"var(--light)",
                        transition:"border 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = selectedRole.color}
                      onBlur={e  => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:6}}>
                    Email address
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="doctor@hospital.com"
                    style={{
                      width:"100%",padding:"11px 14px",borderRadius:10,
                      border:`1px solid ${error && !email ? "var(--error)" : "var(--border)"}`,
                      fontSize:14,outline:"none",background:"var(--light)",
                      transition:"border 0.2s",
                    }}
                    onFocus={e => e.target.style.borderColor = selectedRole.color}
                    onBlur={e  => e.target.style.borderColor = "var(--border)"}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:6}}>
                    Password
                  </label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min. 6 characters" : "Enter password"}
                    style={{
                      width:"100%",padding:"11px 14px",borderRadius:10,
                      border:`1px solid ${error && !password ? "var(--error)" : "var(--border)"}`,
                      fontSize:14,outline:"none",background:"var(--light)",
                      transition:"border 0.2s",
                    }}
                    onFocus={e => e.target.style.borderColor = selectedRole.color}
                    onBlur={e  => e.target.style.borderColor = "var(--border)"}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="fade-in" style={{
                    padding:"10px 14px",borderRadius:8,
                    background:"#fdf0f0",border:"1px solid #f5c6c6",
                    fontSize:13,color:"var(--error)",
                  }}>
                    {error}
                    {error.includes("incorrect") && (
                      <span
                        onClick={() => setMode("signup")}
                        style={{display:"block",marginTop:4,color:selectedRole.color,cursor:"pointer",fontWeight:500}}>
                        → Create a new account instead
                      </span>
                    )}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding:"13px",borderRadius:10,border:"none",
                    background: loading ? "#a0c4b4" : selectedRole.color,
                    color:"#fff",fontSize:15,fontWeight:500,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition:"all 0.2s",marginTop:2,
                    fontFamily:"'DM Sans',sans-serif",
                  }}
                  onMouseEnter={e => { if(!loading) e.currentTarget.style.background = selectedRole.color+"dd"; }}
                  onMouseLeave={e => { if(!loading) e.currentTarget.style.background = selectedRole.color; }}
                >
                  {loading ? "Please wait..." : mode === "login" ? `Sign in as ${selectedRole.label}` : "Create account"}
                </button>

                {/* Toggle login / signup */}
                <p style={{textAlign:"center",fontSize:13,color:"var(--muted)"}}>
                  {mode === "login" ? "No account yet? " : "Already have an account? "}
                  <span
                    onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
                    style={{color:selectedRole.color,cursor:"pointer",fontWeight:500}}
                  >
                    {mode === "login" ? "Create one" : "Sign in"}
                  </span>
                </p>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP: SUCCESS ── */}
        {step === "success" && (
          <div className="fade-up" style={{width:"100%",maxWidth:400,textAlign:"center"}}>
            <div style={{
              background:"var(--white)",borderRadius:20,
              border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",
              padding:"40px 32px",
            }}>
              <div style={{
                width:64,height:64,borderRadius:"50%",
                background:"#e6f4ed",border:"2px solid var(--green)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:28,margin:"0 auto 20px",
              }}>✓</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,marginBottom:8}}>
                You're in!
              </h2>
              <p style={{fontSize:14,color:"var(--muted)",marginBottom:24,lineHeight:1.6}}>
                Signed in as <strong>{selectedRole?.label}</strong>.<br/>
                Dashboard coming in the next step.
              </p>
              <button
                onClick={() => { setStep("role"); setRole(null); setEmail(""); setPassword(""); setName(""); setMode("login"); }}
                style={{
                  padding:"11px 28px",borderRadius:10,border:"1px solid var(--border)",
                  background:"var(--light)",fontSize:14,cursor:"pointer",color:"var(--muted)",
                  fontFamily:"'DM Sans',sans-serif",
                }}>
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="fade-up" style={{animationDelay:"400ms",marginTop:32,fontSize:12,color:"var(--muted)"}}>
          DocRate MVP · Built with React + Supabase · Portfolio project
        </p>
      </div>
    </>
  );
}
