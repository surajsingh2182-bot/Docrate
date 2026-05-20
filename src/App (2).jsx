import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────
// CONFIG — keys loaded from Vercel environment variables
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON  = import.meta.env.VITE_SUPABASE_ANON;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const supabase       = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const PARAMETERS = [
  { key:"empathy",          label:"Empathy & Patient-Centeredness", icon:"🤝", desc:"Did the doctor show compassion, listen actively, and acknowledge patient concerns?" },
  { key:"clinical_accuracy",label:"Clinical Accuracy & Knowledge",  icon:"🧠", desc:"Were diagnoses, medications, and medical advice accurate and evidence-based?" },
  { key:"communication",    label:"Communication Clarity",           icon:"💬", desc:"Was the doctor clear, free of jargon, and easy for the patient to understand?" },
  { key:"history_taking",   label:"History Taking",                  icon:"📋", desc:"Did the doctor gather a thorough patient history including symptoms and past conditions?" },
  { key:"safety",           label:"Safety & Risk Awareness",         icon:"🛡️", desc:"Were red flags, allergies, drug interactions, and contraindications properly addressed?" },
  { key:"followup",         label:"Follow-up & Action Plan",         icon:"📅", desc:"Were next steps, referrals, and tests clearly communicated?" },
  { key:"patient_education",label:"Patient Education",               icon:"📚", desc:"Did the doctor explain the diagnosis in a way the patient can act on?" },
  { key:"professionalism",  label:"Professionalism & Ethics",        icon:"⚖️", desc:"Was the consultation respectful, within ethical standards, and professional?" },
];

const ROLES = [
  { id:"doctor", label:"Doctor",       icon:"⚕",  desc:"View your consultation scores",    color:"#0a6640", bg:"#e6f4ed" },
  { id:"owner",  label:"Clinic Owner", icon:"🏥", desc:"Manage your clinic's performance", color:"#1a4fa0", bg:"#e8eef8" },
  { id:"admin",  label:"Admin",        icon:"⚙",  desc:"Full platform access",             color:"#7a3800", bg:"#fdf0e6" },
];

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green:#0a6640; --green-light:#e6f4ed; --light:#f7faf8; --white:#ffffff;
    --border:#dde8e2; --text:#0f1f16; --muted:#6b8070; --error:#c0392b;
    --amber:#b45309; --amber-bg:#fffbea;
  }
  body { background:var(--light); font-family:'DM Sans',sans-serif; color:var(--text); min-height:100vh; }
  input,button,textarea { font-family:'DM Sans',sans-serif; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .fade-up  { animation:fadeUp  0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-in  { animation:fadeIn  0.35s ease both; }
  .shake    { animation:shake   0.4s ease; }
  .spinner  { width:34px;height:34px;border:3px solid #d1e8dc;border-top-color:var(--green);border-radius:50%;animation:spin 0.9s linear infinite; }
  .pulse-dot{ width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.4s infinite; }
  .hist-row { transition:background 0.15s; }
  .hist-row:hover { background:#f0f7f3 !important; }
  .hist-row.active { background:var(--green-light) !important; border-left:3px solid var(--green) !important; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
`;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const scoreColor = n => n>=8?"#0a6640":n>=6?"#b45309":"#c0392b";
const scoreBg    = n => n>=8?"#e6f4ed":n>=6?"#fffbea":"#fdf0f0";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
}

function downloadTxt(content, filename) {
  const blob = new Blob([content], { type:"text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename || "transcript.txt";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// GEMINI CALL
// ─────────────────────────────────────────────────────────────
async function analyseWithGemini(transcript) {
  const paramList = PARAMETERS.map((p,i)=>`${i+1}. ${p.label}: ${p.desc}`).join("\n");
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
  "strengths":    ["<strength 1>","<strength 2>"],
  "improvements": ["<improvement 1>","<improvement 2>"]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.2} }),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(()=>({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Gemini API error (${res.status}): ${msg}`);
  }

  const data = await res.json();
  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  raw = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned invalid JSON. Raw response: ${raw.slice(0,200)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fade-in" style={{
      padding:"11px 14px", borderRadius:9,
      background:"#fdf0f0", border:"1px solid #f5c6c6",
      fontSize:12, color:"var(--error)",
      display:"flex", alignItems:"flex-start", gap:10, marginBottom:12,
    }}>
      <span style={{flexShrink:0}}>⚠️</span>
      <span style={{flex:1, lineHeight:1.5}}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{background:"none",border:"none",cursor:"pointer",color:"var(--error)",fontSize:14,flexShrink:0}}>×</button>
      )}
    </div>
  );
}

function ScoreCircle({ score }) {
  const col = scoreColor(score/10);
  const bg  = scoreBg(score/10);
  return (
    <div style={{width:56,height:56,borderRadius:"50%",flexShrink:0,
      background:bg, border:`2.5px solid ${col}`,
      display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
      <span style={{fontSize:17,fontWeight:700,color:col,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{score}</span>
      <span style={{fontSize:8,color:"var(--muted)"}}>/100</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY PANEL
// ─────────────────────────────────────────────────────────────
function HistoryPanel({ username, activeId, onViewAnalysis, onNewAnalysis, refreshKey }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase
        .from("consultations")
        .select("id, file_name, overall_score, status, uploaded_at, transcript, ai_feedback")
        .eq("doctor_username", username)
        .order("uploaded_at", { ascending: false })
        .limit(15);

      if (err) {
        // Give a clear, actionable error message
        if (err.code === "42P01") {
          setError("Table 'consultations' not found. Please run the SQL setup in Supabase first.");
        } else if (err.code === "PGRST301") {
          setError("Permission denied. Check your Supabase RLS policies allow SELECT.");
        } else {
          setError(`Supabase error (${err.code}): ${err.message}`);
        }
        return;
      }
      setItems(data || []);
    } catch (e) {
      setError(`Network error loading history: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div style={{
      width:300, flexShrink:0,
      background:"var(--white)",
      border:"0.5px solid var(--border)",
      borderRadius:16,
      display:"flex", flexDirection:"column",
      overflow:"hidden",
      maxHeight:720,
    }}>
      {/* Panel header */}
      <div style={{padding:"16px 16px 12px", borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:2}}>📁 Recent Transcripts</div>
        <div style={{fontSize:11, color:"var(--muted)"}}>Last 15 uploads</div>
      </div>

      {/* Upload new button */}
      <div style={{padding:"10px 12px", borderBottom:"1px solid var(--border)"}}>
        <button onClick={onNewAnalysis} style={{
          width:"100%", padding:"9px", borderRadius:8, border:"none",
          background:"var(--green)", color:"#fff", fontSize:12, fontWeight:500,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          + Upload New Transcript
        </button>
      </div>

      {/* List */}
      <div style={{flex:1, overflowY:"auto"}}>
        {/* Loading */}
        {loading && (
          <div style={{padding:"28px 16px", textAlign:"center"}}>
            <div className="spinner" style={{margin:"0 auto 10px"}}/>
            <div style={{fontSize:12, color:"var(--muted)"}}>Loading history...</div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{padding:"14px 12px"}}>
            <div style={{padding:"10px 12px", borderRadius:8, background:"#fdf0f0", border:"1px solid #f5c6c6", fontSize:11, color:"var(--error)", lineHeight:1.5}}>
              ⚠️ {error}
              <button onClick={load} style={{display:"block",marginTop:8,fontSize:11,color:"var(--green)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && (
          <div style={{padding:"32px 16px", textAlign:"center"}}>
            <div style={{fontSize:28, marginBottom:10}}>📂</div>
            <div style={{fontSize:12, color:"var(--muted)", lineHeight:1.6}}>
              No transcripts yet.<br/>Upload your first one!
            </div>
          </div>
        )}

        {/* Items */}
        {!loading && !error && items.map((item, i) => {
          const isActive  = item.id === activeId;
          const hasScore  = item.overall_score !== null && item.overall_score !== undefined;
          const isPending = item.status === "analysing" || item.status === "pending";
          const isFailed  = item.status === "error";
          const scoreNum  = hasScore ? item.overall_score : null;

          return (
            <div key={item.id}
              className={`hist-row${isActive?" active":""}`}
              style={{
                padding:"12px 14px",
                borderBottom:"0.5px solid var(--border)",
                borderLeft: isActive ? "3px solid var(--green)" : "3px solid transparent",
                cursor:"default",
              }}>
              {/* File name + status */}
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4}}>
                <div style={{fontSize:12, fontWeight:500, color:"var(--text)",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, paddingRight:8}}>
                  {item.file_name || "Untitled transcript"}
                </div>
                {hasScore && (
                  <span style={{fontSize:11, fontWeight:700, color:scoreColor(scoreNum/10),
                    background:scoreBg(scoreNum/10), padding:"1px 7px", borderRadius:5, flexShrink:0}}>
                    {scoreNum}
                  </span>
                )}
                {isPending && (
                  <span style={{fontSize:10, color:"var(--amber)", background:"var(--amber-bg)",
                    padding:"1px 7px", borderRadius:5, flexShrink:0}}>pending</span>
                )}
                {isFailed && (
                  <span style={{fontSize:10, color:"var(--error)", background:"#fdf0f0",
                    padding:"1px 7px", borderRadius:5, flexShrink:0}}>failed</span>
                )}
              </div>

              {/* Date + time */}
              <div style={{fontSize:10, color:"var(--muted)", marginBottom:8}}>
                {formatDate(item.uploaded_at)} · {formatTime(item.uploaded_at)}
              </div>

              {/* Buttons */}
              <div style={{display:"flex", gap:6}}>
                <button
                  onClick={() => downloadTxt(item.transcript, item.file_name)}
                  title="Download original transcript"
                  style={{
                    flex:1, padding:"5px 0", borderRadius:6,
                    border:"1px solid var(--border)", background:"var(--light)",
                    fontSize:11, cursor:"pointer", color:"var(--muted)",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--green)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  ⬇ Download
                </button>

                <button
                  onClick={() => {
                    if (!item.ai_feedback) {
                      alert("No analysis found for this transcript. It may still be processing or the analysis failed.");
                      return;
                    }
                    try {
                      const parsed = typeof item.ai_feedback === "string"
                        ? JSON.parse(item.ai_feedback)
                        : item.ai_feedback;
                      onViewAnalysis(item, parsed);
                    } catch {
                      alert("Could not load analysis data. The format may be corrupted.");
                    }
                  }}
                  disabled={!hasScore}
                  title={hasScore ? "View AI analysis" : "No analysis available yet"}
                  style={{
                    flex:1, padding:"5px 0", borderRadius:6,
                    border:`1px solid ${hasScore?"var(--green)":"var(--border)"}`,
                    background: hasScore?"var(--green-light)":"var(--light)",
                    fontSize:11, cursor:hasScore?"pointer":"not-allowed",
                    color: hasScore?"var(--green)":"var(--muted)",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                    opacity: hasScore ? 1 : 0.5,
                  }}
                  onMouseEnter={e=>{ if(hasScore) e.currentTarget.style.background="#c8ead8"; }}
                  onMouseLeave={e=>{ if(hasScore) e.currentTarget.style.background="var(--green-light)"; }}>
                  📊 Analysis
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      {!loading && !error && items.length > 0 && (
        <div style={{padding:"8px 14px", borderTop:"1px solid var(--border)",
          fontSize:10, color:"var(--muted)", textAlign:"center"}}>
          Showing {items.length} of last 15 · stored in Supabase
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESULTS VIEW (reused for new analysis + history view)
// ─────────────────────────────────────────────────────────────
function ResultsView({ result, fileName, savedId, onReset }) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Score banner */}
      <div style={{background:"var(--white)",borderRadius:16,border:"0.5px solid var(--border)",
        boxShadow:"0 2px 20px rgba(10,102,64,0.05)",padding:"22px"}}>
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
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>
              {fileName || "Analysis complete"} ✓
            </div>
            <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>{result.summary}</div>
            {savedId && <div style={{marginTop:6,fontSize:11,color:"var(--green)"}}>✓ Saved to Supabase</div>}
          </div>
        </div>
      </div>

      {/* View feedback toggle */}
      <button onClick={()=>setShowFeedback(!showFeedback)}
        style={{width:"100%",padding:"12px",borderRadius:10,border:"none",
          background:"var(--green)",color:"#fff",fontSize:14,fontWeight:600,
          cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
        onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
        {showFeedback?"▲ Hide Detailed Feedback":"▼ View Detailed AI Feedback"}
      </button>

      {/* Feedback panel */}
      {showFeedback && (
        <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
          border:"0.5px solid var(--border)",padding:"20px",display:"flex",flexDirection:"column",gap:12}}>

          <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Parameter Breakdown
          </div>

          {PARAMETERS.map(p => {
            const pd = result.parameters?.[p.key];
            if (!pd) return null;
            return (
              <div key={p.key} style={{display:"flex",alignItems:"flex-start",gap:10,
                padding:"12px",borderRadius:10,background:"var(--light)",border:"0.5px solid var(--border)"}}>
                <span style={{fontSize:17,marginTop:1,flexShrink:0}}>{p.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:500}}>{p.label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:scoreColor(pd.score),
                      background:scoreBg(pd.score),padding:"1px 8px",borderRadius:5,flexShrink:0}}>
                      {pd.score}/10
                    </span>
                  </div>
                  <div style={{height:4,background:"#e8f0ec",borderRadius:2,marginBottom:5}}>
                    <div style={{height:"100%",width:`${pd.score*10}%`,
                      background:scoreColor(pd.score),borderRadius:2,transition:"width 0.8s ease"}}/>
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>{pd.feedback}</div>
                </div>
              </div>
            );
          })}

          {result.strengths?.length > 0 && (
            <div style={{padding:"13px",borderRadius:10,background:"#e6f4ed",border:"0.5px solid #b2ddc4"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--green)",textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>✓ Strengths</div>
              {result.strengths.map((s,i)=>(
                <div key={i} style={{fontSize:12,color:"var(--text)",lineHeight:1.6,
                  paddingLeft:10,borderLeft:"2px solid var(--green)",
                  marginBottom:i<result.strengths.length-1?6:0}}>{s}</div>
              ))}
            </div>
          )}

          {result.improvements?.length > 0 && (
            <div style={{padding:"13px",borderRadius:10,background:"var(--amber-bg)",border:"0.5px solid #f0d060"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--amber)",textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>↑ Areas for Improvement</div>
              {result.improvements.map((s,i)=>(
                <div key={i} style={{fontSize:12,color:"var(--text)",lineHeight:1.6,
                  paddingLeft:10,borderLeft:"2px solid var(--amber)",
                  marginBottom:i<result.improvements.length-1?6:0}}>{s}</div>
              ))}
            </div>
          )}

          {onReset && (
            <button onClick={onReset}
              style={{padding:"10px",borderRadius:9,border:"1px solid var(--border)",
                background:"var(--light)",fontSize:13,cursor:"pointer",
                color:"var(--muted)",fontFamily:"'DM Sans',sans-serif"}}>
              ← Analyse another transcript
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [step,     setStep]     = useState("role");
  const [role,     setRole]     = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [shake,    setShake]    = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Upload / analysis
  const [uploadState,   setUploadState]   = useState("idle"); // idle|analysing|done|error
  const [transcript,    setTranscript]    = useState("");
  const [fileName,      setFileName]      = useState("");
  const [result,        setResult]        = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [savedId,       setSavedId]       = useState(null);
  const [refreshKey,    setRefreshKey]    = useState(0); // bump to reload history

  // History view
  const [histActiveId,  setHistActiveId]  = useState(null);
  const [histResult,    setHistResult]    = useState(null);
  const [histFileName,  setHistFileName]  = useState("");

  const fileRef = useRef();
  const selectedRole = ROLES.find(r => r.id === role);

  // ── Auth handlers ──
  function triggerLoginError(msg) {
    setLoginErr(msg); setShake(true);
    setTimeout(()=>setShake(false), 500);
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!username.trim()) { triggerLoginError("Please enter a username."); return; }
    if (!password.trim()) { triggerLoginError("Please enter a password."); return; }
    setLoginLoading(true);
    setTimeout(()=>{ setLoginLoading(false); setStep("dashboard"); }, 800);
  }

  function handleSignOut() {
    setStep("role"); setRole(null);
    setUsername(""); setPassword(""); setLoginErr("");
    resetUpload();
  }

  // ── Upload handlers ──
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      setAnalysisError("❌ Invalid file type. Please upload a .txt file only."); return;
    }
    setAnalysisError(""); setFileName(file.name);
    setHistActiveId(null); setHistResult(null);
    const reader = new FileReader();
    reader.onload = ev => setTranscript(ev.target.result);
    reader.onerror = () => setAnalysisError("❌ Could not read file. Please try again.");
    reader.readAsText(file);
  }

  async function handleAnalyse() {
    if (!transcript.trim()) {
      setAnalysisError("❌ No transcript loaded. Please upload a .txt file first.");
      return;
    }
    setUploadState("analysing");
    setAnalysisError(""); setResult(null); setSavedId(null);
    setHistActiveId(null); setHistResult(null);

    let dbId = null;

    try {
      // Step 1 — Save transcript to Supabase
      try {
        const { data, error: insertErr } = await supabase
          .from("consultations")
          .insert({
            doctor_username: username,
            role:            role,
            file_name:       fileName,
            transcript:      transcript,
            status:          "analysing",
          })
          .select("id")
          .single();

        if (insertErr) {
          console.warn(`Supabase insert warning (${insertErr.code}): ${insertErr.message}`);
          // Don't block analysis — log and continue
        } else {
          dbId = data?.id;
          setSavedId(dbId);
        }
      } catch (dbErr) {
        console.warn("Supabase unreachable — continuing with analysis:", dbErr.message);
      }

      // Step 2 — Analyse with Gemini
      const analysis = await analyseWithGemini(transcript);
      setResult(analysis);

      // Step 3 — Update Supabase with score
      if (dbId) {
        const { error: updateErr } = await supabase
          .from("consultations")
          .update({
            overall_score: analysis.overall_score,
            ai_feedback:   JSON.stringify(analysis),
            status:        "scored",
          })
          .eq("id", dbId);

        if (updateErr) {
          console.warn(`Score save warning (${updateErr.code}): ${updateErr.message}`);
        }
      }

      setUploadState("done");
      setRefreshKey(k => k+1); // reload history panel

    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysisError(`❌ ${err.message}`);
      setUploadState("error");

      // Mark as failed in Supabase
      if (dbId) {
        await supabase.from("consultations")
          .update({ status:"error" })
          .eq("id", dbId)
          .catch(()=>{});
      }
    }
  }

  function resetUpload() {
    setUploadState("idle"); setTranscript(""); setFileName("");
    setResult(null); setAnalysisError(""); setSavedId(null);
    setHistActiveId(null); setHistResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleViewAnalysis(item, parsed) {
    setHistActiveId(item.id);
    setHistResult(parsed);
    setHistFileName(item.file_name || "Transcript");
    // Clear new-upload result so panel shows history result
    setUploadState("idle"); setResult(null);
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      {/* Background */}
      <div style={{position:"fixed",inset:0,zIndex:0,background:"var(--light)",
        backgroundImage:`radial-gradient(circle at 15% 15%,rgba(10,102,64,0.06) 0%,transparent 50%),
                         radial-gradient(circle at 85% 85%,rgba(10,102,64,0.04) 0%,transparent 50%)`}}/>

      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",padding:"32px 16px",position:"relative",zIndex:1}}>

        {/* Logo */}
        <div className="fade-up" style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:5}}>
            <div style={{width:34,height:34,borderRadius:9,background:"var(--green)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>⚕</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,letterSpacing:"-0.01em"}}>DocRate</span>
          </div>
          <p style={{fontSize:11,color:"var(--muted)"}}>Healthcare consultation quality platform</p>
        </div>

        {/* ════ ROLE SELECTION ════ */}
        {step==="role" && (
          <div className="fade-up" style={{animationDelay:"80ms",width:"100%",maxWidth:420}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"24px 24px 16px"}}>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,marginBottom:4}}>Sign in to DocRate</h1>
                <p style={{fontSize:13,color:"var(--muted)"}}>Select your role to continue</p>
              </div>
              <div style={{padding:"0 16px 16px",display:"flex",flexDirection:"column",gap:9}}>
                {ROLES.map((r,i)=>(
                  <button key={r.id} className="fade-up"
                    onClick={()=>{setRole(r.id);setStep("login");setLoginErr("");}}
                    style={{animationDelay:`${120+i*60}ms`,display:"flex",alignItems:"center",gap:12,
                      padding:"14px 15px",borderRadius:11,border:`1px solid ${r.color}22`,
                      background:r.bg,cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color+"55";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 14px ${r.color}14`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=r.color+"22";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#fff",border:`1px solid ${r.color}22`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:r.color,marginBottom:1}}>{r.label}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{r.desc}</div>
                    </div>
                    <div style={{color:r.color,fontSize:16,opacity:0.4}}>›</div>
                  </button>
                ))}
              </div>
              <div style={{margin:"0 16px 16px",padding:"9px 12px",borderRadius:8,
                background:"var(--amber-bg)",border:"1px solid #f0d060",fontSize:12,color:"var(--amber)"}}>
                🧪 <strong>Testing mode</strong> — any username and password will work
              </div>
            </div>
          </div>
        )}

        {/* ════ LOGIN ════ */}
        {step==="login" && selectedRole && (
          <div className={`fade-up ${shake?"shake":""}`} style={{width:"100%",maxWidth:390}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"16px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button onClick={()=>{setStep("role");setLoginErr("");}}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:13}}>← Back</button>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:99,
                  background:selectedRole.bg,border:`1px solid ${selectedRole.color}22`}}>
                  <span>{selectedRole.icon}</span>
                  <span style={{fontSize:11,fontWeight:500,color:selectedRole.color}}>{selectedRole.label}</span>
                </div>
              </div>
              <div style={{padding:"14px 20px 4px"}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,marginBottom:3}}>Welcome back</h2>
                <p style={{fontSize:12,color:"var(--muted)"}}>Signing in as <strong>{selectedRole.label}</strong></p>
              </div>
              <form onSubmit={handleLogin} style={{padding:"12px 20px 20px",display:"flex",flexDirection:"column",gap:12}}>
                {[["Username","text",username,setUsername,"Enter any username"],
                  ["Password","password",password,setPassword,"Enter any password"]].map(([lbl,type,val,set,ph])=>(
                  <div key={lbl}>
                    <label style={{fontSize:11,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:4}}>{lbl}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                      style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border)",
                        fontSize:13,outline:"none",background:"var(--light)",transition:"border 0.2s"}}
                      onFocus={e=>e.target.style.borderColor=selectedRole.color}
                      onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  </div>
                ))}
                {loginErr && <ErrorBanner message={loginErr} onDismiss={()=>setLoginErr("")}/>}
                <div style={{padding:"8px 12px",borderRadius:8,background:"var(--amber-bg)",
                  border:"1px solid #f0d060",fontSize:11,color:"var(--amber)"}}>
                  🧪 Testing mode — any credentials work
                </div>
                <button type="submit" disabled={loginLoading}
                  style={{padding:"11px",borderRadius:9,border:"none",
                    background:loginLoading?"#a0c4b4":selectedRole.color,
                    color:"#fff",fontSize:13,fontWeight:500,cursor:loginLoading?"not-allowed":"pointer",
                    fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                  onMouseEnter={e=>{if(!loginLoading)e.currentTarget.style.opacity="0.88";}}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {loginLoading?"Signing in...": `Continue as ${selectedRole.label} →`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ════ DASHBOARD ════ */}
        {step==="dashboard" && selectedRole && (
          <div className="fade-up" style={{width:"100%",maxWidth:980}}>

            {/* Top header bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{selectedRole.icon}</span>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600}}>
                  {role==="doctor"?"Doctor Dashboard":role==="owner"?"Clinic Dashboard":"Admin Dashboard"}
                </span>
                <span style={{fontSize:11,color:"var(--muted)",marginLeft:4}}>· {username}</span>
              </div>
              <button onClick={handleSignOut}
                style={{padding:"6px 14px",borderRadius:7,border:"1px solid var(--border)",
                  background:"var(--white)",fontSize:12,cursor:"pointer",color:"var(--muted)"}}>
                Sign out
              </button>
            </div>

            {/* ── DOCTOR: two-panel layout ── */}
            {role==="doctor" && (
              <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>

                {/* LEFT — History panel */}
                <HistoryPanel
                  username={username}
                  activeId={histActiveId}
                  refreshKey={refreshKey}
                  onViewAnalysis={handleViewAnalysis}
                  onNewAnalysis={resetUpload}
                />

                {/* RIGHT — Main content */}
                <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>

                  {/* Show history result if selected from panel */}
                  {histResult && (
                    <div>
                      <div style={{fontSize:11,color:"var(--muted)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={()=>{setHistActiveId(null);setHistResult(null);}}
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--green)",fontSize:12}}>
                          ← Back to upload
                        </button>
                        <span>· Viewing: <strong>{histFileName}</strong></span>
                      </div>
                      <ResultsView result={histResult} fileName={histFileName} savedId={null} onReset={null}/>
                    </div>
                  )}

                  {/* New upload flow — only show when not viewing history */}
                  {!histResult && (
                    <>
                      {/* IDLE */}
                      {uploadState==="idle" && (
                        <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                          border:"0.5px solid var(--border)",boxShadow:"0 2px 20px rgba(10,102,64,0.05)",padding:"26px"}}>
                          <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>📄 Upload Consultation Transcript</div>
                          <div style={{fontSize:12,color:"var(--muted)",marginBottom:20,lineHeight:1.6}}>
                            Upload a <strong>.txt</strong> file. AI will score it across <strong>8 quality parameters</strong>.
                          </div>

                          <ErrorBanner message={analysisError} onDismiss={()=>setAnalysisError("")}/>

                          {/* Drop zone */}
                          <div onClick={()=>fileRef.current?.click()}
                            style={{border:"2px dashed var(--border)",borderRadius:12,padding:"28px 20px",
                              textAlign:"center",cursor:"pointer",transition:"all 0.2s",marginBottom:14,background:"var(--light)"}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--green)";e.currentTarget.style.background="#f0f9f4";}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--light)";}}>
                            <div style={{fontSize:28,marginBottom:8}}>{fileName?"✅":"📂"}</div>
                            <div style={{fontSize:13,fontWeight:500,color:"var(--green)",marginBottom:3}}>
                              {fileName?fileName:"Click to select a .txt file"}
                            </div>
                            <div style={{fontSize:11,color:"var(--muted)"}}>
                              {fileName?"File ready — click Analyse below":"Only .txt files are supported"}
                            </div>
                          </div>
                          <input ref={fileRef} type="file" accept=".txt" onChange={handleFileChange} style={{display:"none"}}/>

                          <button onClick={handleAnalyse} disabled={!transcript.trim()}
                            style={{width:"100%",padding:"12px",borderRadius:10,border:"none",
                              background:transcript.trim()?"var(--green)":"#c8ddd4",
                              color:"#fff",fontSize:13,fontWeight:600,
                              cursor:transcript.trim()?"pointer":"not-allowed",
                              fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                            onMouseEnter={e=>{if(transcript.trim())e.currentTarget.style.opacity="0.88";}}
                            onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                            🔍 Analyse Transcript
                          </button>

                          <div style={{marginTop:18,padding:"14px",borderRadius:11,
                            background:"var(--light)",border:"0.5px solid var(--border)"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",
                              letterSpacing:"0.07em",marginBottom:10}}>8 Quality Parameters</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                              {PARAMETERS.map(p=>(
                                <div key={p.key} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--text)"}}>
                                  <span style={{fontSize:13}}>{p.icon}</span><span>{p.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ANALYSING */}
                      {uploadState==="analysing" && (
                        <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                          border:"0.5px solid var(--border)",padding:"52px 28px",textAlign:"center"}}>
                          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                            <div className="spinner"/>
                          </div>
                          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:600,marginBottom:8}}>
                            Analysis in progress
                          </div>
                          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.8}}>
                            Gemini AI is reviewing your transcript<br/>across 8 quality parameters...
                          </div>
                          <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:20}}>
                            {[0,1,2].map(i=>(
                              <div key={i} className="pulse-dot" style={{animationDelay:`${i*0.3}s`}}/>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ERROR */}
                      {uploadState==="error" && (
                        <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                          border:"1px solid #f5c6c6",padding:"28px",textAlign:"center"}}>
                          <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
                          <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Analysis failed</div>
                          <div style={{fontSize:12,color:"var(--muted)",marginBottom:6,lineHeight:1.6}}>{analysisError}</div>
                          <div style={{fontSize:11,color:"var(--muted)",marginBottom:20,
                            padding:"8px 12px",background:"var(--light)",borderRadius:7,textAlign:"left"}}>
                            <strong>Common fixes:</strong><br/>
                            · Check VITE_GEMINI_API_KEY in Vercel env vars<br/>
                            · Make sure the key is active at aistudio.google.com<br/>
                            · Check Supabase URL and ANON key are correct<br/>
                            · Ensure the consultations table exists in Supabase
                          </div>
                          <button onClick={resetUpload}
                            style={{padding:"9px 22px",borderRadius:8,border:"1px solid var(--border)",
                              background:"var(--light)",fontSize:13,cursor:"pointer"}}>
                            Try again
                          </button>
                        </div>
                      )}

                      {/* DONE */}
                      {uploadState==="done" && result && (
                        <ResultsView
                          result={result}
                          fileName={fileName}
                          savedId={savedId}
                          onReset={resetUpload}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Owner / Admin placeholder ── */}
            {(role==="owner"||role==="admin") && (
              <div className="fade-in" style={{background:"var(--white)",borderRadius:16,
                border:"0.5px solid var(--border)",padding:"52px 28px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:16}}>{selectedRole.icon}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,marginBottom:8}}>
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

        <p className="fade-up" style={{animationDelay:"400ms",marginTop:24,fontSize:11,color:"var(--muted)"}}>
          DocRate MVP · Testing mode · Portfolio project
        </p>
      </div>
    </>
  );
}
