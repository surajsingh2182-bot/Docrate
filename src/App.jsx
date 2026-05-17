import { useState, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config — replace with your real values ───────────────────
const SUPABASE_URL  = "https://xrxrrimuxjufpaguejfi.supabase.co/rest/v1/";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyeHJyaW11eGp1ZnBhZ3VlamZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODUyMjUsImV4cCI6MjA5NDU2MTIyNX0.sxZ19RlxpVstZrDGCP-0AYlIXdpyp4nCr7VQ87Eq8Y8";
const GEMINI_KEY    = "AIzaSyBPs9Idz5KAFhogLMgw3MrC1-obDgiQuqI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Quality parameters (based on medical consultation best practices) ──
const PARAMETERS = [
  {
    key: "empathy",
    label: "Empathy & Patient-Centeredness",
    icon: "🤝",
    desc: "Did the doctor show compassion, listen actively, and acknowledge patient concerns?",
  },
  {
    key: "clinical_accuracy",
    label: "Clinical Accuracy & Knowledge",
    icon: "🧠",
    desc: "Were diagnoses, medications, and medical advice accurate and evidence-based?",
  },
  {
    key: "communication",
    label: "Communication Clarity",
    icon: "💬",
    desc: "Was the doctor clear, free of jargon, and easy for the patient to understand?",
  },
  {
    key: "history_taking",
    label: "History Taking",
    icon: "📋",
    desc: "Did the doctor gather a thorough patient history including symptoms, duration, and past conditions?",
  },
  {
    key: "safety",
    label: "Safety & Risk Awareness",
    icon: "🛡️",
    desc: "Were red flags, allergies, drug interactions, and contraindications properly addressed?",
  },
  {
    key: "followup",
    label: "Follow-up & Action Plan",
    icon: "📅",
    desc: "Were next steps, follow-up instructions, referrals, and tests clearly communicated?",
  },
  {
    key: "patient_education",
    label: "Patient Education",
    icon: "📚",
    desc: "Did the doctor explain the diagnosis, condition, and treatment plan in a way patients can act on?",
  },
  {
    key: "professionalism",
    label: "Professionalism & Ethics",
    icon: "⚖️",
    desc: "Was the consultation conducted with respect, appropriate boundaries, and ethical standards?",
  },
];

// ── Roles ─────────────────────────────────────────────────────
const ROLES = [
  { id:"doctor", label:"Doctor",       icon:"⚕",  desc:"View your consultation scores",    color:"#0a6640", bg:"#e6f4ed" },
  { id:"owner",  label:"Clinic Owner", icon:"🏥", desc:"Manage your clinic's performance", color:"#1a4fa0", bg:"#e8eef8" },
  { id:"admin",  label:"Admin",        icon:"⚙",  desc:"Full platform access",             color:"#7a3800", bg:"#fdf0e6" },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green:    #0a6640;
    --light:    #f7faf8;
    --white:    #ffffff;
    --border:   #dde8e2;
    --text:     #0f1f16;
    --muted:    #6b8070;
    --error:    #c0392b;
    --amber:    #b45309;
    --amber-bg: #fffbea;
  }
  body { background: var(--light); font-family: 'DM Sans', sans-serif; color: var(--text); min-height: 100vh; }
  input { font-family: 'DM Sans', sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .fade-up  { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-in  { animation: fadeIn 0.35s ease both; }
  .shake    { animation: shake  0.4s ease; }
  .spinner  { width:36px; height:36px; border:3px solid #d1e8dc; border-top-color:var(--green); border-radius:50%; animation:spin 0.9s linear infinite; }
  .pulse-dot{ width:8px; height:8px; border-radius:50%; background:var(--green); animation:pulse 1.4s infinite; }
`;

function scoreColor(n) {
  if (n >= 8) return "#0a6640";
  if (n >= 6) return "#b45309";
  return "#c0392b";
}
function scoreBg(n) {
  if (n >= 8) return "#e6f4ed";
  if (n >= 6) return "#fffbea";
  return "#fdf0f0";
}

async function analyseWithGemini(transcript) {
  const paramList = PARAMETERS.map(
    (p, i) => `${i + 1}. ${p.label}: ${p.desc}`
  ).join("\n");

  const prompt = `You are an expert medical consultation quality reviewer.

Analyse the following doctor-patient consultation transcript and score it on each of these 8 parameters from 1 to 10:

${paramList}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON object in exactly this format (no markdown, no extra text):
{
  "overall_score": <number 1-100>,
  "summary": "<2-3 sentence overall assessment>",
  "parameters": {
    "empathy":           { "score": <1-10>, "feedback": "<one sentence>" },
    "clinical_accuracy": { "score": <1-10>, "feedback": "<one sentence>" },
    "communication":     { "score": <1-10>, "feedback": "<one sentence>" },
    "history_taking":    { "score": <1-10>, "feedback": "<one sentence>" },
    "safety":            { "score": <1-10>, "feedback": "<one sentence>" },
    "followup":          { "score": <1-10>, "feedback": "<one sentence>" },
    "patient_education": { "score": <1-10>, "feedback": "<one sentence>" },
    "professionalism":   { "score": <1-10>, "feedback": "<one sentence>" }
  },
  "strengths":    ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} — check your API key`);

  const data = await res.json();
  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(raw);
}

export default function App() {
  const [step, setStep]         = useState("role");
  const [role, setRole]         = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState("");
  const [shake, setShake]               = useState(false);

  const [uploadState, setUploadState]   = useState("idle"); // idle | analysing | done | error
  const [transcript, setTranscript]     = useState("");
  const [fileName, setFileName]         = useState("");
  const [result, setResult]             = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [savedId, setSavedId]           = useState(null);

  const fileRef = useRef();
  const selectedRole = ROLES.find(r => r.id === role);

  function triggerLoginError(msg) {
    setLoginError(msg); setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function selectRole(r) {
    setRole(r.id); setStep("login");
    setLoginError(""); setUsername(""); setPassword("");
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!username.trim()) { triggerLoginError("Please enter a username."); return; }
    if (!password.trim()) { triggerLoginError("Please enter a password."); return; }
    setLoginLoading(true);
    setTimeout(() => { setLoginLoading(false); setStep("dashboard"); }, 800);
  }

  function handleSignOut() {
    setStep("role"); setRole(null);
    setUsername(""); setPassword(""); setLoginError("");
    setUploadState("idle"); setTranscript(""); setFileName("");
    setResult(null); setShowFeedback(false); setSavedId(null); setAnalysisError("");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      setAnalysisError("Please upload a .txt file only."); return;
    }
    setAnalysisError(""); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setTranscript(ev.target.result);
    reader.readAsText(file);
  }

  async function handleAnalyse() {
    if (!transcript.trim()) return;
    setUploadState("analysing");
    setShowFeedback(false); setResult(null); setAnalysisError("");

    try {
      // 1. Save transcript to Supabase
      let dbId = null;
      try {
        const { data } = await supabase.from("consultations").insert({
          doctor_username: username,
          role:            role,
          file_name:       fileName,
          transcript:      transcript,
          status:          "analysing",
        }).select("id").single();
        dbId = data?.id;
        setSavedId(dbId);
      } catch (_) {
        console.warn("Supabase save skipped — continuing with analysis");
      }

      // 2. Analyse with Gemini
      const analysis = await analyseWithGemini(transcript);
      setResult(analysis);

      // 3. Update Supabase with score
      if (dbId) {
        await supabase.from("consultations").update({
          overall_score: analysis.overall_score,
          ai_feedback:   JSON.stringify(analysis),
          status:        "scored",
        }).eq("id", dbId);
      }

      setUploadState("done");
    } catch (err) {
      console.error(err);
      setAnalysisError(err.message);
      setUploadState("error");
    }
  }

  function resetUpload() {
    setUploadState("idle"); setTranscript(""); setFileName("");
    setResult(null); setShowFeedback(false); setSavedId(null); setAnalysisError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <style>{CSS}</style>

      <div style={{position:"fixed",inset:0,zIndex:0,background:"var(--light)",
        backgroundImage:`radial-gradient(circle at 15% 15%,rgba(10,102,64,0.06) 0%,transparent 50%),
                         radial-gradient(circle at 85% 85%,rgba(10,102,64,0.04) 0%,transparent 50%)`}}/>
      <div style={{position:"fixed",top:0,right:0,width:280,height:280,opacity:0.04,zIndex:0,
        backgroundImage:`repeating-linear-gradient(0deg,#0a6640 0,#0a6640 1px,transparent 1px,transparent 24px),
                         repeating-linear-gradient(90deg,#0a6640 0,#0a6640 1px,transparent 1px,transparent 24px)`}}/>

      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",padding:"40px 20px",position:"relative",zIndex:1}}>

        {/* Logo */}
        <div className="fade-up" style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:36,height:36,borderRadius:10,background:"var(--green)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#fff"}}>⚕</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:23,fontWeight:600,letterSpacing:"-0.01em"}}>DocRate</span>
          </div>
          <p style={{fontSize:12,color:"var(--muted)"}}>Healthcare consultation quality platform</p>
        </div>

        {/* ── ROLE SELECTION ── */}
        {step === "role" && (
          <div className="fade-up" style={{animationDelay:"80ms",width:"100%",maxWidth:440}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"26px 26px 18px"}}>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:600,marginBottom:5}}>Sign in to DocRate</h1>
                <p style={{fontSize:13,color:"var(--muted)"}}>Select your role to continue</p>
              </div>
              <div style={{padding:"0 18px 20px",display:"flex",flexDirection:"column",gap:10}}>
                {ROLES.map((r,i) => (
                  <button key={r.id} className="fade-up" onClick={() => selectRole(r)}
                    style={{animationDelay:`${120+i*60}ms`,display:"flex",alignItems:"center",gap:14,
                      padding:"15px 16px",borderRadius:12,border:`1px solid ${r.color}22`,
                      background:r.bg,cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color+"55";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 14px ${r.color}16`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=r.color+"22";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{width:42,height:42,borderRadius:11,background:"#fff",border:`1px solid ${r.color}22`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{r.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500,color:r.color,marginBottom:2}}>{r.label}</div>
                      <div style={{fontSize:12,color:"var(--muted)"}}>{r.desc}</div>
                    </div>
                    <div style={{color:r.color,fontSize:17,opacity:0.4}}>›</div>
                  </button>
                ))}
              </div>
              <div style={{margin:"0 18px 18px",padding:"9px 13px",borderRadius:9,
                background:"var(--amber-bg)",border:"1px solid #f0d060",fontSize:12,color:"var(--amber)"}}>
                🧪 <strong>Testing mode</strong> — any username and password will work
              </div>
            </div>
          </div>
        )}

        {/* ── LOGIN ── */}
        {step === "login" && selectedRole && (
          <div className={`fade-up ${shake?"shake":""}`} style={{width:"100%",maxWidth:400}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"18px 22px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button onClick={()=>{setStep("role");setLoginError("");}}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:13}}>← Back</button>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 11px",borderRadius:99,
                  background:selectedRole.bg,border:`1px solid ${selectedRole.color}22`}}>
                  <span>{selectedRole.icon}</span>
                  <span style={{fontSize:11,fontWeight:500,color:selectedRole.color}}>{selectedRole.label}</span>
                </div>
              </div>
              <div style={{padding:"16px 22px 6px"}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:600,marginBottom:3}}>Welcome back</h2>
                <p style={{fontSize:13,color:"var(--muted)"}}>Signing in as <strong>{selectedRole.label}</strong></p>
              </div>
              <form onSubmit={handleLogin} style={{padding:"14px 22px 22px",display:"flex",flexDirection:"column",gap:13}}>
                {[["Username","text",username,setUsername,"Enter any username"],
                  ["Password","password",password,setPassword,"Enter any password"]].map(([lbl,type,val,set,ph])=>(
                  <div key={lbl}>
                    <label style={{fontSize:12,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:5}}>{lbl}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                      style={{width:"100%",padding:"10px 13px",borderRadius:9,border:"1px solid var(--border)",
                        fontSize:13,outline:"none",background:"var(--light)",transition:"border 0.2s"}}
                      onFocus={e=>e.target.style.borderColor=selectedRole.color}
                      onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  </div>
                ))}
                {loginError && (
                  <div className="fade-in" style={{padding:"9px 13px",borderRadius:8,background:"#fdf0f0",
                    border:"1px solid #f5c6c6",fontSize:12,color:"var(--error)"}}>{loginError}</div>
                )}
                <div style={{padding:"9px 13px",borderRadius:8,background:"var(--amber-bg)",
                  border:"1px solid #f0d060",fontSize:12,color:"var(--amber)"}}>
                  🧪 Testing mode — any credentials work
                </div>
                <button type="submit" disabled={loginLoading}
                  style={{padding:"12px",borderRadius:9,border:"none",
                    background:loginLoading?"#a0c4b4":selectedRole.color,
                    color:"#fff",fontSize:14,fontWeight:500,cursor:loginLoading?"not-allowed":"pointer",
                    fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                  onMouseEnter={e=>{if(!loginLoading)e.currentTarget.style.opacity="0.88";}}
                  onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                  {loginLoading ? "Signing in..." : `Continue as ${selectedRole.label} →`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {step === "dashboard" && selectedRole && (
          <div className="fade-up" style={{width:"100%",maxWidth:660}}>

            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:18}}>{selectedRole.icon}</span>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600}}>
                    {role==="doctor"?"Doctor Dashboard":role==="owner"?"Clinic Dashboard":"Admin Dashboard"}
                  </span>
                </div>
                <div style={{fontSize:12,color:"var(--muted)"}}>
                  Logged in as <strong>{username}</strong> · {selectedRole.label}
                </div>
              </div>
              <button onClick={handleSignOut}
                style={{padding:"7px 16px",borderRadius:8,border:"1px solid var(--border)",
                  background:"var(--white)",fontSize:12,cursor:"pointer",color:"var(--muted)",
                  fontFamily:"'DM Sans',sans-serif"}}>Sign out</button>
            </div>

            {/* ── Doctor flow ── */}
            {role === "doctor" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>

                {/* IDLE — Upload card */}
                {uploadState === "idle" && (
                  <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                    border:"0.5px solid var(--border)",boxShadow:"0 2px 20px rgba(10,102,64,0.05)",padding:"28px"}}>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>📄 Upload Consultation Transcript</div>
                    <div style={{fontSize:13,color:"var(--muted)",marginBottom:22,lineHeight:1.6}}>
                      Upload a <strong>.txt</strong> file of a doctor-patient consultation.
                      Our AI will score it across <strong>8 quality parameters</strong>.
                    </div>

                    {/* Drop zone */}
                    <div onClick={() => fileRef.current?.click()}
                      style={{border:"2px dashed var(--border)",borderRadius:12,padding:"32px 20px",
                        textAlign:"center",cursor:"pointer",transition:"all 0.2s",marginBottom:16,background:"var(--light)"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#0a6640";e.currentTarget.style.background="#f0f9f4";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--light)";}}>
                      <div style={{fontSize:32,marginBottom:10}}>{fileName ? "✅" : "📂"}</div>
                      <div style={{fontSize:14,fontWeight:500,color:"var(--green)",marginBottom:4}}>
                        {fileName ? fileName : "Click to select a .txt file"}
                      </div>
                      <div style={{fontSize:12,color:"var(--muted)"}}>
                        {fileName ? "File ready — click Analyse Transcript below" : "Only .txt files supported"}
                      </div>
                    </div>
                    <input ref={fileRef} type="file" accept=".txt" onChange={handleFileChange} style={{display:"none"}}/>

                    {analysisError && (
                      <div className="fade-in" style={{padding:"9px 13px",borderRadius:8,background:"#fdf0f0",
                        border:"1px solid #f5c6c6",fontSize:12,color:"var(--error)",marginBottom:14}}>{analysisError}</div>
                    )}

                    <button onClick={handleAnalyse} disabled={!transcript.trim()}
                      style={{width:"100%",padding:"13px",borderRadius:10,border:"none",
                        background:transcript.trim()?"var(--green)":"#c8ddd4",
                        color:"#fff",fontSize:14,fontWeight:600,
                        cursor:transcript.trim()?"pointer":"not-allowed",
                        fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                      onMouseEnter={e=>{if(transcript.trim())e.currentTarget.style.opacity="0.88";}}
                      onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                      🔍 Analyse Transcript
                    </button>

                    {/* Parameter list */}
                    <div style={{marginTop:22,padding:"16px",borderRadius:12,
                      background:"var(--light)",border:"0.5px solid var(--border)"}}>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",
                        letterSpacing:"0.07em",marginBottom:12}}>8 Quality Parameters</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {PARAMETERS.map(p => (
                          <div key={p.key} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:"var(--text)"}}>
                            <span style={{fontSize:14}}>{p.icon}</span><span>{p.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ANALYSING — Loader */}
                {uploadState === "analysing" && (
                  <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                    border:"0.5px solid var(--border)",padding:"56px 28px",textAlign:"center"}}>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
                      <div className="spinner"/>
                    </div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,marginBottom:10}}>
                      Analysis in progress
                    </div>
                    <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.8}}>
                      Gemini AI is reviewing your consultation transcript<br/>
                      across 8 quality parameters. This takes a few seconds.
                    </div>
                    <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:7,marginTop:22}}>
                      {[0,1,2].map(i => (
                        <div key={i} className="pulse-dot" style={{animationDelay:`${i*0.3}s`}}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* ERROR */}
                {uploadState === "error" && (
                  <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                    border:"1px solid #f5c6c6",padding:"32px",textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>Analysis failed</div>
                    <div style={{fontSize:13,color:"var(--muted)",marginBottom:6}}>{analysisError}</div>
                    <div style={{fontSize:12,color:"var(--muted)",marginBottom:22}}>
                      Make sure your Gemini API key is set correctly in App.jsx
                    </div>
                    <button onClick={resetUpload}
                      style={{padding:"10px 24px",borderRadius:9,border:"1px solid var(--border)",
                        background:"var(--light)",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                      Try again
                    </button>
                  </div>
                )}

                {/* DONE — Results */}
                {uploadState === "done" && result && (
                  <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:12}}>

                    {/* Overall score banner */}
                    <div style={{background:"var(--white)",borderRadius:16,border:"0.5px solid var(--border)",
                      boxShadow:"0 2px 20px rgba(10,102,64,0.05)",padding:"24px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:18}}>
                        <div style={{width:76,height:76,borderRadius:"50%",flexShrink:0,
                          background:scoreBg(result.overall_score/10),
                          border:`3px solid ${scoreColor(result.overall_score/10)}`,
                          display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
                          <span style={{fontSize:24,fontWeight:700,color:scoreColor(result.overall_score/10),
                            fontFamily:"'Playfair Display',serif",lineHeight:1}}>{result.overall_score}</span>
                          <span style={{fontSize:9,color:"var(--muted)"}}>/100</span>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Analysis complete ✓</div>
                          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>{result.summary}</div>
                          {savedId && <div style={{marginTop:8,fontSize:11,color:"var(--green)"}}>✓ Saved to Supabase</div>}
                        </div>
                      </div>
                    </div>

                    {/* View feedback button */}
                    <button onClick={() => setShowFeedback(!showFeedback)}
                      style={{width:"100%",padding:"13px",borderRadius:10,border:"none",
                        background:"var(--green)",color:"#fff",fontSize:14,fontWeight:600,
                        cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      {showFeedback ? "▲ Hide Detailed Feedback" : "▼ View Detailed AI Feedback"}
                    </button>

                    {/* Detailed feedback panel */}
                    {showFeedback && (
                      <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                        border:"0.5px solid var(--border)",padding:"22px",display:"flex",flexDirection:"column",gap:14}}>

                        <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em"}}>
                          Parameter Breakdown
                        </div>

                        {PARAMETERS.map(p => {
                          const pd = result.parameters?.[p.key];
                          if (!pd) return null;
                          return (
                            <div key={p.key} style={{display:"flex",alignItems:"flex-start",gap:12,
                              padding:"13px 14px",borderRadius:10,background:"var(--light)",border:"0.5px solid var(--border)"}}>
                              <span style={{fontSize:18,marginTop:1,flexShrink:0}}>{p.icon}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                                  <span style={{fontSize:13,fontWeight:500}}>{p.label}</span>
                                  <span style={{fontSize:13,fontWeight:700,color:scoreColor(pd.score),
                                    background:scoreBg(pd.score),padding:"2px 9px",borderRadius:6,flexShrink:0}}>
                                    {pd.score}/10
                                  </span>
                                </div>
                                <div style={{height:4,background:"#e8f0ec",borderRadius:2,marginBottom:6}}>
                                  <div style={{height:"100%",width:`${pd.score*10}%`,
                                    background:scoreColor(pd.score),borderRadius:2,transition:"width 0.8s ease"}}/>
                                </div>
                                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>{pd.feedback}</div>
                              </div>
                            </div>
                          );
                        })}

                        {result.strengths?.length > 0 && (
                          <div style={{padding:"14px",borderRadius:10,background:"#e6f4ed",border:"0.5px solid #b2ddc4"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"var(--green)",textTransform:"uppercase",
                              letterSpacing:"0.07em",marginBottom:8}}>✓ Strengths</div>
                            {result.strengths.map((s,i) => (
                              <div key={i} style={{fontSize:13,color:"var(--text)",lineHeight:1.6,
                                paddingLeft:12,borderLeft:"2px solid var(--green)",
                                marginBottom:i<result.strengths.length-1?6:0}}>{s}</div>
                            ))}
                          </div>
                        )}

                        {result.improvements?.length > 0 && (
                          <div style={{padding:"14px",borderRadius:10,background:"var(--amber-bg)",border:"0.5px solid #f0d060"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"var(--amber)",textTransform:"uppercase",
                              letterSpacing:"0.07em",marginBottom:8}}>↑ Areas for Improvement</div>
                            {result.improvements.map((s,i) => (
                              <div key={i} style={{fontSize:13,color:"var(--text)",lineHeight:1.6,
                                paddingLeft:12,borderLeft:"2px solid var(--amber)",
                                marginBottom:i<result.improvements.length-1?6:0}}>{s}</div>
                            ))}
                          </div>
                        )}

                        <button onClick={resetUpload}
                          style={{padding:"11px",borderRadius:9,border:"1px solid var(--border)",
                            background:"var(--light)",fontSize:13,cursor:"pointer",
                            color:"var(--muted)",fontFamily:"'DM Sans',sans-serif"}}>
                          ← Analyse another transcript
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Owner / Admin placeholder ── */}
            {(role === "owner" || role === "admin") && (
              <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                border:"0.5px solid var(--border)",padding:"52px 28px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:16}}>{selectedRole.icon}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:600,marginBottom:8}}>
                  {selectedRole.label} Dashboard
                </div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.8}}>
                  Coming in the next step.<br/>
                  Will show clinic-wide scores, doctor leaderboards,<br/>and full platform analytics.
                </div>
              </div>
            )}
          </div>
        )}

        <p className="fade-up" style={{animationDelay:"400ms",marginTop:28,fontSize:11,color:"var(--muted)"}}>
          DocRate MVP · Testing mode · Portfolio project
        </p>
      </div>
    </>
  );
}
