import { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, BookOpen, ClipboardList, Plus, Trash2, Layers,
  RotateCcw, Check, X as XIcon, ChevronDown, ChevronRight, Shuffle,
  RefreshCw, ArrowUp, ArrowDown, SkipForward, PlayCircle
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const PALETTE = ["#C89B3C", "#2F6F4E", "#B33F3F", "#3C6E8F", "#7A5C9E", "#A0632F"];
const STORAGE_KEY = "aprovaja-data";
const LEGACY_KEY = "painel-estudos-concurso-data";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function minutesToLabel(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatDateShort(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PERIODS = [
  { key: "dia", label: "Diário", days: 1, noun: "hoje", chartLabel: "hoje" },
  { key: "semana", label: "Semanal", days: 7, noun: "na semana", chartLabel: "últimos 7 dias" },
  { key: "mes", label: "Mensal", days: 30, noun: "no mês", chartLabel: "últimos 30 dias" },
  { key: "semestre", label: "Semestral", days: 182, noun: "no semestre", chartLabel: "últimos 6 meses" },
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function sumSessions(list) {
  let grossMin = 0, netMin = 0, qTotal = 0, qCorrect = 0;
  list.forEach((s) => {
    grossMin += s.grossMin;
    netMin += Math.max(0, s.grossMin - s.pauseMin);
    qTotal += s.qTotal;
    qCorrect += s.qCorrect;
  });
  const efficiency = grossMin > 0 ? (netMin / grossMin) * 100 : 0;
  const accuracy = qTotal > 0 ? (qCorrect / qTotal) * 100 : 0;
  return { grossMin, netMin, qTotal, qCorrect, efficiency, accuracy };
}

function buildChartData(sessions, days) {
  if (days <= 31) {
    const bucket = [];
    for (let i = days - 1; i >= 0; i--) bucket.push(isoDaysAgo(i));
    return bucket.map((iso) => {
      const netMin = sessions.filter((s) => s.date === iso).reduce((a, s) => a + Math.max(0, s.grossMin - s.pauseMin), 0);
      return { date: formatDateShort(iso), horas: +(netMin / 60).toFixed(2) };
    });
  }
  const weeks = Math.ceil(days / 7);
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = w * 7;
    const start = Math.min(days - 1, end + 6);
    const isoStart = isoDaysAgo(start);
    const isoEnd = isoDaysAgo(end);
    const netMin = sessions
      .filter((s) => s.date >= isoStart && s.date <= isoEnd)
      .reduce((a, s) => a + Math.max(0, s.grossMin - s.pauseMin), 0);
    out.push({ date: formatDateShort(isoStart), horas: +(netMin / 60).toFixed(2) });
  }
  return out;
}

export default function AprovaJa() {
  const [loaded, setLoaded] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [cycleBlocks, setCycleBlocks] = useState([]);
  const [cyclePointer, setCyclePointer] = useState({ index: 0, round: 1 });
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSubjects(parsed.subjects || []);
        setTopics(parsed.topics || []);
        setQuestions(parsed.questions || []);
        setSessions(parsed.sessions || []);
        setCycleBlocks(parsed.cycleBlocks || []);
        setCyclePointer(parsed.cyclePointer || { index: 0, round: 1 });
      }
    } catch (e) {
      // sem dados salvos ainda
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects, topics, questions, sessions, cycleBlocks, cyclePointer }));
    } catch (e) {
      console.error("Falha ao salvar dados", e);
    }
  }, [subjects, topics, questions, sessions, cycleBlocks, cyclePointer, loaded]);

  const subjectById = useMemo(() => {
    const map = {};
    subjects.forEach((s) => (map[s.id] = s));
    return map;
  }, [subjects]);

  const topicsBySubject = useMemo(() => {
    const map = {};
    topics.forEach((t) => {
      if (!map[t.subjectId]) map[t.subjectId] = [];
      map[t.subjectId].push(t);
    });
    return map;
  }, [topics]);

  const totals = useMemo(() => {
    let grossMin = 0, netMin = 0, qTotal = 0, qCorrect = 0;
    sessions.forEach((s) => {
      grossMin += s.grossMin;
      netMin += Math.max(0, s.grossMin - s.pauseMin);
      qTotal += s.qTotal;
      qCorrect += s.qCorrect;
    });
    const efficiency = grossMin > 0 ? (netMin / grossMin) * 100 : 0;
    const accuracy = qTotal > 0 ? (qCorrect / qTotal) * 100 : 0;
    const reviewed = questions.reduce((a, q) => a + (q.timesReviewed || 0), 0);
    const reviewedCorrect = questions.reduce((a, q) => a + (q.timesCorrect || 0), 0);
    const reviewAccuracy = reviewed > 0 ? (reviewedCorrect / reviewed) * 100 : 0;
    return { grossMin, netMin, qTotal, qCorrect, efficiency, accuracy, reviewed, reviewAccuracy, flashcards: questions.length };
  }, [sessions, questions]);

  const subjectStats = useMemo(() => {
    return subjects.map((sub) => {
      const subSessions = sessions.filter((s) => s.subjectId === sub.id);
      const netMin = subSessions.reduce((a, s) => a + Math.max(0, s.grossMin - s.pauseMin), 0);
      const qDone = subSessions.reduce((a, s) => a + s.qTotal, 0);
      const qCorrect = subSessions.reduce((a, s) => a + s.qCorrect, 0);
      const topicCount = (topicsBySubject[sub.id] || []).length;
      const cardCount = questions.filter((q) => q.subjectId === sub.id).length;
      return { ...sub, netMin, qDone, qCorrect, accuracy: qDone > 0 ? (qCorrect / qDone) * 100 : 0, topicCount, cardCount };
    });
  }, [subjects, sessions, topicsBySubject, questions]);

  function addSubject(sub) { setSubjects((prev) => [...prev, { id: uid(), ...sub }]); }
  function removeSubject(id) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setTopics((prev) => prev.filter((t) => t.subjectId !== id));
  }
  function addTopic(subjectId, name) {
    setTopics((prev) => [...prev, { id: uid(), subjectId, name }]);
  }
  function removeTopic(id) {
    setTopics((prev) => prev.filter((t) => t.id !== id));
    setQuestions((prev) => prev.map((q) => (q.topicId === id ? { ...q, topicId: "" } : q)));
  }
  function addQuestion(q) { setQuestions((prev) => [{ id: uid(), timesReviewed: 0, timesCorrect: 0, ...q }, ...prev]); }
  function removeQuestion(id) { setQuestions((prev) => prev.filter((q) => q.id !== id)); }
  function registerReview(id, correct) {
    setQuestions((prev) => prev.map((q) => q.id === id
      ? { ...q, timesReviewed: (q.timesReviewed || 0) + 1, timesCorrect: (q.timesCorrect || 0) + (correct ? 1 : 0) }
      : q));
  }
  function addSession(sess) { setSessions((prev) => [{ id: uid(), ...sess }, ...prev]); }
  function removeSession(id) { setSessions((prev) => prev.filter((s) => s.id !== id)); }

  function addCycleBlock(subjectId, minutes) {
    setCycleBlocks((prev) => [...prev, { id: uid(), subjectId, minutes }]);
  }
  function removeCycleBlock(id) {
    setCycleBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      setCyclePointer((p) => ({ ...p, index: next.length > 0 ? Math.min(p.index, next.length - 1) : 0 }));
      return next;
    });
  }
  function moveCycleBlock(id, dir) {
    setCycleBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function completeCycleBlock(block, actualMin) {
    addSession({
      subjectId: block.subjectId, topicId: "", date: todayISO(),
      grossMin: actualMin, pauseMin: 0, qTotal: 0, qCorrect: 0,
      fromCycle: true, round: cyclePointer.round,
    });
    advanceCycle();
  }
  function skipCycleBlock() { advanceCycle(); }
  function advanceCycle() {
    setCyclePointer((p) => {
      const total = cycleBlocks.length;
      if (total === 0) return p;
      const nextIndex = p.index + 1;
      if (nextIndex >= total) return { index: 0, round: p.round + 1 };
      return { index: nextIndex, round: p.round };
    });
  }
  function resetCycle() { setCyclePointer({ index: 0, round: 1 }); }

  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "subjects", label: "Disciplinas", icon: BookOpen },
    { key: "cycle", label: "Ciclo de Estudos", icon: RefreshCw },
    { key: "questions", label: "Questões", icon: Layers },
    { key: "review", label: "Revisão", icon: RotateCcw },
    { key: "sessions", label: "Registrar Estudo", icon: ClipboardList },
  ];

  return (
    <div className="pec-root">
      <style>{STYLES}</style>

      <aside className="pec-sidebar">
        <div className="pec-brand">
          Aprova<span className="pec-brand-ja">JÁ</span>
          <span className="pec-brand-tag">Rumo à Aprovação</span>
        </div>
        {NAV.map((n) => (
          <button key={n.key} className={`pec-navbtn ${view === n.key ? "active" : ""}`} onClick={() => setView(n.key)}>
            <n.icon size={16} /> {n.label}
          </button>
        ))}
      </aside>

      <main className="pec-main">
        {view === "dashboard" && <DashboardView totals={totals} subjectStats={subjectStats} sessions={sessions} subjectById={subjectById} cycleBlocks={cycleBlocks} cyclePointer={cyclePointer} setView={setView} />}
        {view === "subjects" && <SubjectsView subjectStats={subjectStats} topicsBySubject={topicsBySubject} onAdd={addSubject} onRemove={removeSubject} onAddTopic={addTopic} onRemoveTopic={removeTopic} />}
        {view === "cycle" && <CycleView subjects={subjects} subjectById={subjectById} cycleBlocks={cycleBlocks} cyclePointer={cyclePointer} sessions={sessions} onAddBlock={addCycleBlock} onRemoveBlock={removeCycleBlock} onMoveBlock={moveCycleBlock} onComplete={completeCycleBlock} onSkip={skipCycleBlock} onReset={resetCycle} />}
        {view === "questions" && <QuestionsView subjects={subjects} topicsBySubject={topicsBySubject} questions={questions} onAdd={addQuestion} onRemove={removeQuestion} />}
        {view === "review" && <ReviewView subjects={subjects} topicsBySubject={topicsBySubject} questions={questions} onResult={registerReview} />}
        {view === "sessions" && <SessionsView subjects={subjects} topicsBySubject={topicsBySubject} sessions={sessions} onAdd={addSession} onRemove={removeSession} />}
      </main>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function DashboardView({ totals, subjectStats, sessions, subjectById, cycleBlocks, cyclePointer, setView }) {
  const [period, setPeriod] = useState("semana");
  const periodDef = PERIODS.find((p) => p.key === period);

  const periodSessions = useMemo(() => {
    const start = isoDaysAgo(periodDef.days - 1);
    return sessions.filter((s) => s.date >= start);
  }, [sessions, periodDef]);

  const periodTotals = useMemo(() => sumSessions(periodSessions), [periodSessions]);
  const chartData = useMemo(() => buildChartData(sessions, periodDef.days), [sessions, periodDef]);
  const recent = periodSessions.slice(0, 6);

  const currentBlock = cycleBlocks[cyclePointer.index] || null;
  const currentSubject = currentBlock ? subjectById[currentBlock.subjectId] : null;
  return (
    <>
      <Header title="Dashboard" sub="Visão geral do seu progresso rumo à aprovação" />

      <div className="pec-period-filter">
        {PERIODS.map((p) => (
          <button key={p.key} className={`pec-period-btn ${period === p.key ? "active" : ""}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      {cycleBlocks.length > 0 && (
        <div className="pec-panel pec-cycle-mini" onClick={() => setView("cycle")}>
          <div className="pec-cycle-mini-left">
            <div className="pec-ledger-label">Ciclo de estudos · rodada {cyclePointer.round}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {currentSubject && <span className="pec-dot" style={{ background: currentSubject.color, width: 11, height: 11 }} />}
              <span className="pec-card-name">{currentSubject ? currentSubject.name : "Ciclo concluído"}</span>
            </div>
            <div className="pec-sub" style={{ marginTop: 3 }}>Próximo bloco {currentBlock ? `· ${minutesToLabel(currentBlock.minutes)}` : ""}</div>
          </div>
          <div className="pec-cycle-mini-right">
            <span className="pec-mono">{cyclePointer.index + 1}/{cycleBlocks.length}</span>
            <div className="pec-bar-track" style={{ width: 100 }}>
              <div className="pec-bar-fill" style={{ width: `${((cyclePointer.index) / cycleBlocks.length) * 100}%`, background: "var(--gold)" }} />
            </div>
          </div>
        </div>
      )}

      <div className="pec-hero">
        <div className="pec-stamp">
          <div className="lbl">Aproveitamento</div>
          <div className="val">{periodTotals.grossMin > 0 ? periodTotals.efficiency.toFixed(0) : "—"}%</div>
          <div className="lbl">Líquido / Bruto</div>
        </div>
        <div className="pec-ledger">
          <LedgerItem label="Horas brutas" value={minutesToLabel(periodTotals.grossMin)} sub={`dedicadas ${periodDef.noun}`} />
          <LedgerItem label="Horas líquidas" value={minutesToLabel(periodTotals.netMin)} sub="descontadas as pausas" cls="green" />
          <LedgerItem label="Questões (sessões)" value={periodTotals.qTotal} sub={`${periodTotals.qCorrect} acertos`} />
          <LedgerItem label="Precisão" value={periodTotals.qTotal > 0 ? `${periodTotals.accuracy.toFixed(0)}%` : "—"} sub={`taxa de acerto ${periodDef.noun}`} cls="gold" />
        </div>
      </div>

      <div className="pec-hero" style={{ gridTemplateColumns: "1fr 1fr 1fr", padding: "16px 22px" }}>
        <LedgerItem label="Flashcards cadastrados" value={totals.flashcards} sub="questões para revisar" />
        <LedgerItem label="Revisões feitas" value={totals.reviewed} sub="cartões revisados (total)" cls="green" />
        <LedgerItem label="Acerto na revisão" value={totals.reviewed > 0 ? `${totals.reviewAccuracy.toFixed(0)}%` : "—"} sub="desempenho nos flashcards" cls="gold" />
      </div>

      <div className="pec-panel">
        <h3>Horas líquidas — {periodDef.chartLabel}</h3>
        {sessions.length === 0 ? (
          <div className="pec-empty">Nenhum estudo registrado ainda. Vá em "Registrar Estudo" para começar.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DACB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#3B4A6B" }} axisLine={{ stroke: "#E1DACB" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#3B4A6B" }} axisLine={false} tickLine={false} width={34} />
              <Tooltip formatter={(v) => [`${v}h`, "Líquido"]} contentStyle={{ borderRadius: 8, border: "1px solid #E1DACB", fontSize: 12, fontFamily: "Inter" }} />
              <Bar dataKey="horas" fill="#2F6F4E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
        <div className="pec-panel">
          <h3>Progresso por disciplina</h3>
          {subjectStats.length === 0 ? (
            <div className="pec-empty">Cadastre suas disciplinas para acompanhar o progresso aqui.</div>
          ) : (
            subjectStats.map((s) => (
              <div className="pec-row" key={s.id}>
                <span className="pec-dot" style={{ background: s.color }} />
                <div style={{ width: 96, fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
                <div className="pec-bar-track">
                  <div className="pec-bar-fill" style={{ width: `${s.goal > 0 ? Math.min(100, (s.qDone / s.goal) * 100) : 0}%`, background: s.color }} />
                </div>
                <div className="pec-mono" style={{ fontSize: 11.5, color: "#3B4A6B", width: 70, textAlign: "right" }}>{s.qDone}/{s.goal || 0}</div>
              </div>
            ))
          )}
        </div>

        <div className="pec-panel">
          <h3>Últimos registros</h3>
          {recent.length === 0 ? (
            <div className="pec-empty">Suas sessões de estudo mais recentes vão aparecer aqui.</div>
          ) : (
            <table className="pec-table">
              <thead><tr><th>Data</th><th>Disciplina</th><th>Líquido</th><th>Questões</th></tr></thead>
              <tbody>
                {recent.map((s) => {
                  const sub = subjectById[s.subjectId];
                  return (
                    <tr key={s.id}>
                      <td className="pec-mono">{formatDateShort(s.date)}</td>
                      <td><span className="pec-dot" style={{ background: sub ? sub.color : "#999", marginRight: 6, display: "inline-block" }} />{sub ? sub.name : "Disciplina removida"}</td>
                      <td className="pec-mono">{minutesToLabel(Math.max(0, s.grossMin - s.pauseMin))}</td>
                      <td className="pec-mono">{s.qCorrect}/{s.qTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
function LedgerItem({ label, value, sub, cls }) {
  return (
    <div className="pec-ledger-item">
      <div className="pec-ledger-label">{label}</div>
      <div className={`pec-ledger-value ${cls || ""}`}>{value}</div>
      <div className="pec-ledger-sub">{sub}</div>
    </div>
  );
}
function Header({ title, sub }) {
  return (
    <div className="pec-header">
      <div>
        <div className="pec-title">{title}</div>
        <div className="pec-sub">{sub}</div>
      </div>
    </div>
  );
}

/* ---------------- DISCIPLINAS + ASSUNTOS ---------------- */
function SubjectsView({ subjectStats, topicsBySubject, onAdd, onRemove, onAddTopic, onRemoveTopic }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [expanded, setExpanded] = useState(null);
  const [topicDraft, setTopicDraft] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), goal: Number(goal) || 0, color });
    setName(""); setGoal("");
    setColor(PALETTE[(subjectStats.length + 1) % PALETTE.length]);
  }
  function submitTopic(e, subjectId) {
    e.preventDefault();
    if (!topicDraft.trim()) return;
    onAddTopic(subjectId, topicDraft.trim());
    setTopicDraft("");
  }

  return (
    <>
      <Header title="Disciplinas" sub="Cadastre as matérias do edital, os assuntos de cada uma e a meta de questões" />

      <form className="pec-form" onSubmit={submit}>
        <h3>Nova disciplina</h3>
        <div className="pec-field-grid">
          <div className="pec-field">
            <label>Nome da disciplina</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Direito Constitucional" />
          </div>
          <div className="pec-field">
            <label>Meta de questões</label>
            <input type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: 300" />
          </div>
          <div className="pec-field">
            <label>Cor</label>
            <div className="pec-colorpick">
              {PALETTE.map((c) => (
                <button type="button" key={c} className={`pec-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Selecionar cor ${c}`} />
              ))}
            </div>
          </div>
        </div>
        <button className="pec-submit" type="submit"><Plus size={15} /> Adicionar disciplina</button>
      </form>

      {subjectStats.length === 0 ? (
        <div className="pec-panel"><div className="pec-empty">Nenhuma disciplina cadastrada ainda. Adicione a primeira acima para começar.</div></div>
      ) : (
        subjectStats.map((s) => {
          const isOpen = expanded === s.id;
          const subTopics = topicsBySubject[s.id] || [];
          return (
            <div className="pec-panel" key={s.id} style={{ marginBottom: 14 }}>
              <div className="pec-subject-head" onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="pec-dot" style={{ background: s.color, width: 11, height: 11 }} />
                  <span className="pec-card-name">{s.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="pec-mono" style={{ fontSize: 12, color: "#3B4A6B" }}>{subTopics.length} assunto{subTopics.length !== 1 ? "s" : ""}</span>
                  <span className="pec-mono" style={{ fontSize: 12, color: "#3B4A6B" }}>{s.qDone}/{s.goal || 0} questões</span>
                  <button className="pec-del" onClick={(e) => { e.stopPropagation(); onRemove(s.id); }} aria-label={`Remover ${s.name}`}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="pec-bar-track" style={{ marginTop: 10, marginBottom: isOpen ? 16 : 0 }}>
                <div className="pec-bar-fill" style={{ width: `${s.goal > 0 ? Math.min(100, (s.qDone / s.goal) * 100) : 0}%`, background: s.color }} />
              </div>

              {isOpen && (
                <div className="pec-topics">
                  {subTopics.length === 0 ? (
                    <div className="pec-empty" style={{ padding: "10px 0" }}>Nenhum assunto cadastrado nesta disciplina ainda.</div>
                  ) : (
                    <ul className="pec-topiclist">
                      {subTopics.map((t) => (
                        <li key={t.id}>
                          <span>{t.name}</span>
                          <button className="pec-del" onClick={() => onRemoveTopic(t.id)} aria-label={`Remover assunto ${t.name}`}><Trash2 size={13} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form className="pec-inline-form" onSubmit={(e) => submitTopic(e, s.id)}>
                    <input value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} placeholder="Novo assunto, ex: Controle de Constitucionalidade" />
                    <button className="pec-submit small" type="submit"><Plus size={13} /> Adicionar</button>
                  </form>
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}

/* ---------------- QUESTÕES (BANCO DE FLASHCARDS) ---------------- */
function QuestionsView({ subjects, topicsBySubject, questions, onAdd, onRemove }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [topicId, setTopicId] = useState("");
  const [statement, setStatement] = useState("");
  const [answer, setAnswer] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  useEffect(() => { if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  useEffect(() => { setTopicId(""); }, [subjectId]);

  const subjectTopics = topicsBySubject[subjectId] || [];
  const subjectById = useMemo(() => { const m = {}; subjects.forEach((s) => (m[s.id] = s)); return m; }, [subjects]);
  const topicNameById = useMemo(() => { const m = {}; Object.values(topicsBySubject).flat().forEach((t) => (m[t.id] = t.name)); return m; }, [topicsBySubject]);

  function submit(e) {
    e.preventDefault();
    if (!subjectId || !statement.trim() || !answer.trim()) return;
    onAdd({ subjectId, topicId: topicId || "", statement: statement.trim(), answer: answer.trim() });
    setStatement(""); setAnswer("");
  }

  const filtered = filterSubject ? questions.filter((q) => q.subjectId === filterSubject) : questions;

  return (
    <>
      <Header title="Questões" sub="Cadastre questões e enunciados para virarem flashcards de revisão" />

      {subjects.length === 0 ? (
        <div className="pec-panel"><div className="pec-empty">Cadastre uma disciplina antes de adicionar questões.</div></div>
      ) : (
        <form className="pec-form" onSubmit={submit}>
          <h3>Nova questão</h3>
          <div className="pec-field-grid">
            <div className="pec-field">
              <label>Disciplina</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="pec-field">
              <label>Assunto (opcional)</label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">Geral</option>
                {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="pec-field" style={{ marginBottom: 12 }}>
            <label>Enunciado da questão</label>
            <textarea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Cole ou escreva o enunciado da questão..." />
          </div>
          <div className="pec-field" style={{ marginBottom: 12 }}>
            <label>Resposta / gabarito comentado</label>
            <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Resposta correta e, se quiser, uma breve explicação" />
          </div>
          <button className="pec-submit" type="submit"><Plus size={15} /> Adicionar questão</button>
        </form>
      )}

      <div className="pec-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ marginBottom: 0 }}>Banco de questões ({filtered.length})</h3>
          <select className="pec-filter" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="pec-empty">Nenhuma questão cadastrada ainda.</div>
        ) : (
          <div className="pec-qlist">
            {filtered.map((q) => {
              const sub = subjectById[q.subjectId];
              const acc = q.timesReviewed > 0 ? Math.round((q.timesCorrect / q.timesReviewed) * 100) : null;
              return (
                <div className="pec-qitem" key={q.id}>
                  <div className="pec-qmeta">
                    <span className="pec-dot" style={{ background: sub ? sub.color : "#999" }} />
                    <span>{sub ? sub.name : "—"}</span>
                    {q.topicId && topicNameById[q.topicId] && <span className="pec-tag">{topicNameById[q.topicId]}</span>}
                    {acc !== null && <span className="pec-tag gold">{acc}% acerto · {q.timesReviewed}x revisada</span>}
                  </div>
                  <div className="pec-qtext">{q.statement}</div>
                  <button className="pec-del pec-qdel" onClick={() => onRemove(q.id)} aria-label="Remover questão"><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- REVISÃO (FLASHCARDS) ---------------- */
function ReviewView({ subjects, topicsBySubject, questions, onResult }) {
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState({ acertos: 0, erros: 0 });
  const [started, setStarted] = useState(false);

  const pool = useMemo(() => {
    return questions.filter((q) => (!filterSubject || q.subjectId === filterSubject) && (!filterTopic || q.topicId === filterTopic));
  }, [questions, filterSubject, filterTopic]);

  const topicsForFilter = filterSubject ? (topicsBySubject[filterSubject] || []) : [];

  function startDeck() {
    setDeck(shuffle(pool));
    setIndex(0);
    setFlipped(false);
    setSession({ acertos: 0, erros: 0 });
    setStarted(true);
  }

  function answer(correct) {
    const q = deck[index];
    onResult(q.id, correct);
    setSession((s) => ({ acertos: s.acertos + (correct ? 1 : 0), erros: s.erros + (correct ? 0 : 1) }));
    if (index + 1 < deck.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      setIndex(deck.length);
    }
  }

  const finished = started && index >= deck.length && deck.length > 0;
  const current = started && !finished ? deck[index] : null;
  const subjectById = useMemo(() => { const m = {}; subjects.forEach((s) => (m[s.id] = s)); return m; }, [subjects]);

  return (
    <>
      <Header title="Revisão" sub="Revise suas questões cadastradas no formato de flashcards" />

      {!started || finished ? (
        <div className="pec-panel">
          {finished && (
            <div className="pec-review-summary">
              <div className="pec-review-summary-title">Revisão concluída</div>
              <div style={{ display: "flex", gap: 22, margin: "10px 0 16px" }}>
                <span className="pec-mono" style={{ color: "#2F6F4E", fontSize: 18 }}>{session.acertos} acertos</span>
                <span className="pec-mono" style={{ color: "#B33F3F", fontSize: 18 }}>{session.erros} erros</span>
              </div>
            </div>
          )}
          <h3>{finished ? "Revisar novamente" : "Montar sessão de revisão"}</h3>
          <div className="pec-field-grid">
            <div className="pec-field">
              <label>Disciplina</label>
              <select value={filterSubject} onChange={(e) => { setFilterSubject(e.target.value); setFilterTopic(""); }}>
                <option value="">Todas</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="pec-field">
              <label>Assunto</label>
              <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} disabled={!filterSubject}>
                <option value="">Todos</option>
                {topicsForFilter.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {pool.length === 0 ? (
            <div className="pec-empty">Nenhuma questão encontrada para esse filtro. Cadastre questões em "Questões" primeiro.</div>
          ) : (
            <button className="pec-submit" onClick={startDeck}><Shuffle size={15} /> Iniciar revisão ({pool.length} carta{pool.length !== 1 ? "s" : ""})</button>
          )}
        </div>
      ) : (
        <div className="pec-review-stage">
          <div className="pec-review-progress">
            <span className="pec-mono">{index + 1} / {deck.length}</span>
            <span className="pec-mono" style={{ color: "#2F6F4E" }}>{session.acertos} certas</span>
            <span className="pec-mono" style={{ color: "#B33F3F" }}>{session.erros} erradas</span>
          </div>

          <div className={`pec-flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)}>
            <div className="pec-flashcard-inner">
              <div className="pec-flashcard-face front">
                {current && (
                  <>
                    <div className="pec-flashcard-tag" style={{ background: subjectById[current.subjectId]?.color || "#999" }}>
                      {subjectById[current.subjectId]?.name || "Disciplina"}
                    </div>
                    <div className="pec-flashcard-text">{current.statement}</div>
                    <div className="pec-flashcard-hint">Toque para ver a resposta</div>
                  </>
                )}
              </div>
              <div className="pec-flashcard-face back">
                {current && (
                  <>
                    <div className="pec-flashcard-tag gold">Resposta</div>
                    <div className="pec-flashcard-text">{current.answer}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {flipped ? (
            <div className="pec-review-actions">
              <button className="pec-answer-btn wrong" onClick={() => answer(false)}><XIcon size={16} /> Errei</button>
              <button className="pec-answer-btn right" onClick={() => answer(true)}><Check size={16} /> Acertei</button>
            </div>
          ) : (
            <div className="pec-review-actions">
              <button className="pec-submit" onClick={() => setFlipped(true)}>Mostrar resposta</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- CICLO DE ESTUDOS ---------------- */
function CycleView({ subjects, subjectById, cycleBlocks, cyclePointer, sessions, onAddBlock, onRemoveBlock, onMoveBlock, onComplete, onSkip, onReset }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [minutes, setMinutes] = useState("50");
  const [logging, setLogging] = useState(false);
  const [actualMinutes, setActualMinutes] = useState("");

  useEffect(() => { if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id); }, [subjects, subjectId]);

  const totalBlocks = cycleBlocks.length;
  const currentBlock = cycleBlocks[cyclePointer.index] || null;
  const currentSubject = currentBlock ? subjectById[currentBlock.subjectId] : null;
  const totalCycleMinutes = cycleBlocks.reduce((a, b) => a + b.minutes, 0);

  const history = useMemo(
    () => sessions.filter((s) => s.fromCycle).slice(0, 12),
    [sessions]
  );

  function submitBlock(e) {
    e.preventDefault();
    if (!subjectId || !Number(minutes)) return;
    onAddBlock(subjectId, Number(minutes));
    setMinutes("50");
  }

  function openLog() {
    setActualMinutes(String(currentBlock.minutes));
    setLogging(true);
  }
  function confirmLog(e) {
    e.preventDefault();
    onComplete(currentBlock, Number(actualMinutes) || currentBlock.minutes);
    setLogging(false);
  }

  return (
    <>
      <Header title="Ciclo de Estudos" sub="Monte a sequência de disciplinas do seu ciclo e siga bloco a bloco" />

      <div className="pec-panel">
        <h3>Bloco atual — rodada {cyclePointer.round}</h3>
        {totalBlocks === 0 ? (
          <div className="pec-empty">Monte seu ciclo abaixo cadastrando os blocos de disciplina e tempo planejado.</div>
        ) : (
          <div className="pec-cycle-current">
            <div className="pec-cycle-current-info">
              <span className="pec-dot" style={{ background: currentSubject.color, width: 13, height: 13 }} />
              <div>
                <div className="pec-card-name" style={{ fontSize: 18 }}>{currentSubject.name}</div>
                <div className="pec-sub">Planejado: {minutesToLabel(currentBlock.minutes)} · bloco {cyclePointer.index + 1} de {totalBlocks}</div>
              </div>
            </div>
            <div className="pec-bar-track" style={{ margin: "14px 0" }}>
              <div className="pec-bar-fill" style={{ width: `${(cyclePointer.index / totalBlocks) * 100}%`, background: "var(--gold)" }} />
            </div>
            {!logging ? (
              <div className="pec-review-actions" style={{ justifyContent: "flex-start" }}>
                <button className="pec-submit" onClick={openLog}><PlayCircle size={15} /> Concluir bloco</button>
                <button className="pec-submit small" style={{ background: "#8A8370" }} onClick={onSkip}><SkipForward size={14} /> Pular</button>
              </div>
            ) : (
              <form className="pec-inline-form" onSubmit={confirmLog} style={{ maxWidth: 320 }}>
                <input type="number" min="1" value={actualMinutes} onChange={(e) => setActualMinutes(e.target.value)} placeholder="Minutos estudados" />
                <button className="pec-submit small" type="submit"><Check size={13} /> Registrar</button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="pec-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ marginBottom: 0 }}>Configuração do ciclo {totalBlocks > 0 && <span className="pec-sub">· {minutesToLabel(totalCycleMinutes)} por volta</span>}</h3>
          {totalBlocks > 0 && <button className="pec-del" onClick={onReset} title="Reiniciar rodada"><RotateCcw size={15} /></button>}
        </div>

        {subjects.length === 0 ? (
          <div className="pec-empty">Cadastre uma disciplina primeiro para poder montar o ciclo.</div>
        ) : (
          <form className="pec-field-grid" onSubmit={submitBlock} style={{ marginBottom: 16, alignItems: "end" }}>
            <div className="pec-field">
              <label>Disciplina</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="pec-field">
              <label>Tempo planejado (min)</label>
              <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="50" />
            </div>
            <div className="pec-field">
              <button className="pec-submit" type="submit"><Plus size={15} /> Adicionar bloco</button>
            </div>
          </form>
        )}

        {cycleBlocks.length === 0 ? (
          <div className="pec-empty">Nenhum bloco no ciclo ainda.</div>
        ) : (
          <ul className="pec-cyclelist">
            {cycleBlocks.map((b, i) => {
              const sub = subjectById[b.subjectId];
              const isCurrent = i === cyclePointer.index;
              return (
                <li key={b.id} className={isCurrent ? "current" : ""}>
                  <span className="pec-cycle-order">{i + 1}</span>
                  <span className="pec-dot" style={{ background: sub ? sub.color : "#999" }} />
                  <span className="pec-cycle-name">{sub ? sub.name : "Disciplina removida"}</span>
                  <span className="pec-mono pec-cycle-time">{minutesToLabel(b.minutes)}</span>
                  <div className="pec-cycle-actions">
                    <button className="pec-del" onClick={() => onMoveBlock(b.id, -1)} disabled={i === 0} aria-label="Mover para cima"><ArrowUp size={13} /></button>
                    <button className="pec-del" onClick={() => onMoveBlock(b.id, 1)} disabled={i === cycleBlocks.length - 1} aria-label="Mover para baixo"><ArrowDown size={13} /></button>
                    <button className="pec-del" onClick={() => onRemoveBlock(b.id)} aria-label="Remover bloco"><Trash2 size={13} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pec-panel">
        <h3>Histórico do ciclo</h3>
        {history.length === 0 ? (
          <div className="pec-empty">Os blocos concluídos vão aparecer aqui, junto com a rodada em que foram feitos.</div>
        ) : (
          <table className="pec-table">
            <thead><tr><th>Data</th><th>Rodada</th><th>Disciplina</th><th>Tempo estudado</th></tr></thead>
            <tbody>
              {history.map((s) => {
                const sub = subjectById[s.subjectId];
                return (
                  <tr key={s.id}>
                    <td className="pec-mono">{formatDateShort(s.date)}</td>
                    <td className="pec-mono">{s.round}</td>
                    <td><span className="pec-dot" style={{ background: sub ? sub.color : "#999", marginRight: 6, display: "inline-block" }} />{sub ? sub.name : "Disciplina removida"}</td>
                    <td className="pec-mono">{minutesToLabel(s.grossMin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------------- REGISTRAR ESTUDO ---------------- */
function SessionsView({ subjects, topicsBySubject, sessions, onAdd, onRemove }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [topicId, setTopicId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [pause, setPause] = useState("0");
  const [qTotal, setQTotal] = useState("");
  const [qCorrect, setQCorrect] = useState("");

  useEffect(() => { if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  useEffect(() => { setTopicId(""); }, [subjectId]);

  const subjectTopics = topicsBySubject[subjectId] || [];
  const grossMinPreview = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const netMinPreview = Math.max(0, grossMinPreview - (Number(pause) || 0));

  function submit(e) {
    e.preventDefault();
    if (!subjectId || grossMinPreview <= 0) return;
    onAdd({
      subjectId, topicId: topicId || "", date,
      grossMin: grossMinPreview, pauseMin: Number(pause) || 0,
      qTotal: Number(qTotal) || 0, qCorrect: Math.min(Number(qCorrect) || 0, Number(qTotal) || 0),
    });
    setHours(""); setMinutes(""); setPause("0"); setQTotal(""); setQCorrect("");
  }

  const subjectById = useMemo(() => { const m = {}; subjects.forEach((s) => (m[s.id] = s)); return m; }, [subjects]);
  const topicNameById = useMemo(() => { const m = {}; Object.values(topicsBySubject).flat().forEach((t) => (m[t.id] = t.name)); return m; }, [topicsBySubject]);

  return (
    <>
      <Header title="Registrar Estudo" sub="Anote cada sessão de estudo com tempo bruto, pausas e questões resolvidas" />

      {subjects.length === 0 ? (
        <div className="pec-panel"><div className="pec-empty">Cadastre uma disciplina antes de registrar uma sessão de estudo.</div></div>
      ) : (
        <form className="pec-form" onSubmit={submit}>
          <h3>Nova sessão</h3>
          <div className="pec-field-grid">
            <div className="pec-field">
              <label>Disciplina</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="pec-field">
              <label>Assunto (opcional)</label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">Geral</option>
                {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="pec-field"><label>Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="pec-field"><label>Horas brutas</label><input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" /></div>
            <div className="pec-field"><label>Minutos brutos</label><input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" /></div>
            <div className="pec-field"><label>Pausas / distrações (min)</label><input type="number" min="0" value={pause} onChange={(e) => setPause(e.target.value)} placeholder="0" /></div>
            <div className="pec-field"><label>Questões resolvidas</label><input type="number" min="0" value={qTotal} onChange={(e) => setQTotal(e.target.value)} placeholder="0" /></div>
            <div className="pec-field"><label>Questões corretas</label><input type="number" min="0" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} placeholder="0" /></div>
          </div>
          <div className="pec-hint">Tempo líquido calculado: <strong className="pec-mono">{minutesToLabel(netMinPreview)}</strong> (bruto {minutesToLabel(grossMinPreview)} − pausas {pause || 0}min)</div>
          <div style={{ marginTop: 12 }}><button className="pec-submit" type="submit"><Plus size={15} /> Registrar sessão</button></div>
        </form>
      )}

      <div className="pec-panel">
        <h3>Histórico de sessões</h3>
        {sessions.length === 0 ? (
          <div className="pec-empty">Nenhuma sessão registrada ainda.</div>
        ) : (
          <table className="pec-table">
            <thead><tr><th>Data</th><th>Disciplina</th><th>Assunto</th><th>Bruto</th><th>Líquido</th><th>Questões</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => {
                const sub = subjectById[s.subjectId];
                return (
                  <tr key={s.id}>
                    <td className="pec-mono">{formatDateShort(s.date)}</td>
                    <td><span className="pec-dot" style={{ background: sub ? sub.color : "#999", marginRight: 6, display: "inline-block" }} />{sub ? sub.name : "Disciplina removida"}</td>
                    <td style={{ color: "#3B4A6B" }}>{s.topicId && topicNameById[s.topicId] ? topicNameById[s.topicId] : "—"}</td>
                    <td className="pec-mono">{minutesToLabel(s.grossMin)}</td>
                    <td className="pec-mono">{minutesToLabel(Math.max(0, s.grossMin - s.pauseMin))}</td>
                    <td className="pec-mono">{s.qCorrect}/{s.qTotal}</td>
                    <td><button className="pec-del" onClick={() => onRemove(s.id)} aria-label="Remover sessão"><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  .pec-root {
    --ink: #14213D; --ink-soft: #3B4A6B; --paper: #FAF8F3; --panel: #FFFFFF;
    --gold: #C89B3C; --green: #2F6F4E; --coral: #B33F3F; --line: #E1DACB;
    font-family: 'Inter', sans-serif; background: var(--paper); color: var(--ink);
    height: 100vh; overflow: hidden; display: flex; border: none; border-radius: 0;
  }
  .pec-serif { font-family: 'Space Grotesk', sans-serif; }
  .pec-mono { font-family: 'IBM Plex Mono', monospace; }

  .pec-sidebar { width: 208px; flex-shrink: 0; background: var(--ink); color: #EDE7D6; padding: 24px 14px; display: flex; flex-direction: column; gap: 4px; }
  .pec-brand { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; letter-spacing: 0.01em; color: #EDE7D6; padding: 0 10px 20px 10px; border-bottom: 1px solid rgba(237,231,214,0.15); margin-bottom: 14px; line-height: 1.3; }
  .pec-brand-ja { color: var(--gold); }
  .pec-brand-tag { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #A79E86; font-family: 'Inter', sans-serif; font-weight: 600; margin-top: 5px; }
  .pec-navbtn { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px; font-size: 13.5px; font-weight: 500; color: #C8C2AE; background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; }
  .pec-navbtn:hover { background: rgba(237,231,214,0.08); color: #EDE7D6; }
  .pec-navbtn.active { background: rgba(200,155,60,0.16); color: var(--gold); }

  .pec-main { flex: 1; padding: 28px 32px; overflow-y: auto; height: 100vh; }
  .pec-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; }
  .pec-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 600; }
  .pec-sub { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }

  .pec-period-filter { display: inline-flex; background: #EFEADE; border-radius: 8px; padding: 3px; gap: 2px; margin-bottom: 18px; }
  .pec-period-btn { border: none; background: transparent; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
  .pec-period-btn:hover { color: var(--ink); }
  .pec-period-btn.active { background: var(--ink); color: #EDE7D6; }

  .pec-hero { display: grid; grid-template-columns: 150px 1fr; gap: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 22px; margin-bottom: 16px; }
  .pec-stamp { width: 128px; height: 128px; border-radius: 50%; border: 2.5px dashed var(--green); display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-7deg); color: var(--green); margin: auto; }
  .pec-stamp .lbl { font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
  .pec-stamp .val { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; line-height: 1; margin: 3px 0; }

  .pec-ledger { display: flex; }
  .pec-ledger-item { flex: 1; padding: 0 18px; border-left: 1px solid var(--line); }
  .pec-ledger-item:first-child { border-left: none; padding-left: 0; }
  .pec-ledger-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-soft); font-weight: 600; margin-bottom: 6px; }
  .pec-ledger-value { font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; }
  .pec-ledger-value.green { color: var(--green); } .pec-ledger-value.gold { color: var(--gold); }
  .pec-ledger-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 3px; }

  .pec-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-bottom: 18px; }
  .pec-panel h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; margin-bottom: 14px; }
  .pec-empty { font-size: 13px; color: var(--ink-soft); padding: 18px 0; text-align: center; }

  .pec-cycle-mini { display: flex; align-items: center; justify-content: space-between; cursor: pointer; gap: 18px; }
  .pec-cycle-mini:hover { border-color: var(--gold); }
  .pec-cycle-mini-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

  .pec-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .pec-row:last-child { border-bottom: none; }
  .pec-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .pec-bar-track { flex: 1; height: 6px; background: #EFEADE; border-radius: 4px; overflow: hidden; }
  .pec-bar-fill { height: 100%; border-radius: 4px; }

  table.pec-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.pec-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); padding: 6px 8px; border-bottom: 1px solid var(--line); font-weight: 600; }
  table.pec-table td { padding: 9px 8px; border-bottom: 1px solid var(--line); }
  table.pec-table tr:last-child td { border-bottom: none; }
  .pec-del { color: var(--coral); background: none; border: none; cursor: pointer; padding: 4px; border-radius: 5px; display: inline-flex; }
  .pec-del:hover { background: rgba(179,63,63,0.1); }

  .pec-form { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-bottom: 18px; }
  .pec-form h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; margin-bottom: 14px; }
  .pec-field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .pec-field label { font-size: 11px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 5px; }
  .pec-field input, .pec-field select, .pec-field textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; font-size: 13px; font-family: 'Inter', sans-serif; background: #FFFDF9; color: var(--ink); resize: vertical; }
  .pec-field input:focus, .pec-field select:focus, .pec-field textarea:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
  .pec-field select:disabled { opacity: 0.5; }
  .pec-colorpick { display: flex; gap: 7px; padding-top: 3px; }
  .pec-swatch { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
  .pec-swatch.selected { border-color: var(--ink); }
  .pec-submit { background: var(--ink); color: #EDE7D6; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .pec-submit:hover { background: #22335A; }
  .pec-submit.small { padding: 6px 12px; font-size: 12px; }
  .pec-hint { font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; }

  .pec-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 14px; }
  .pec-card-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; }

  .pec-subject-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
  .pec-topics { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 14px; }
  .pec-topiclist { list-style: none; margin: 0 0 12px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .pec-topiclist li { display: flex; align-items: center; justify-content: space-between; font-size: 13px; background: #FAF8F3; border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; }
  .pec-inline-form { display: flex; gap: 8px; }
  .pec-inline-form input { flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; font-size: 13px; font-family: 'Inter', sans-serif; background: #FFFDF9; color: var(--ink); }
  .pec-inline-form input:focus { outline: 2px solid var(--gold); outline-offset: 1px; }

  .pec-filter { border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; background: #FFFDF9; color: var(--ink); }
  .pec-qlist { display: flex; flex-direction: column; gap: 10px; }
  .pec-qitem { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; position: relative; background: #FFFDF9; }
  .pec-qmeta { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 6px; flex-wrap: wrap; }
  .pec-tag { background: #EFEADE; border-radius: 10px; padding: 2px 8px; font-size: 10.5px; font-weight: 600; }
  .pec-tag.gold { background: rgba(200,155,60,0.18); color: var(--gold); }
  .pec-qtext { font-size: 13px; line-height: 1.5; padding-right: 26px; }
  .pec-qdel { position: absolute; top: 10px; right: 10px; }

  .pec-cycle-current { }
  .pec-cycle-current-info { display: flex; align-items: center; gap: 12px; }
  .pec-cyclelist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .pec-cyclelist li { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 9px 12px; background: #FFFDF9; }
  .pec-cyclelist li.current { border-color: var(--gold); background: rgba(200,155,60,0.08); }
  .pec-cycle-order { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); width: 16px; }
  .pec-cycle-name { flex: 1; font-size: 13px; font-weight: 500; }
  .pec-cycle-time { font-size: 12px; color: var(--ink-soft); }
  .pec-cycle-actions { display: flex; gap: 2px; }
  .pec-cycle-actions button:disabled { opacity: 0.3; cursor: not-allowed; }

  .pec-review-summary { border-bottom: 1px solid var(--line); margin-bottom: 16px; padding-bottom: 14px; }
  .pec-review-summary-title { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; }

  .pec-review-stage { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 10px 0 30px; }
  .pec-review-progress { display: flex; gap: 20px; font-size: 12.5px; }
  .pec-flashcard { width: 100%; max-width: 520px; height: 260px; perspective: 1200px; cursor: pointer; }
  .pec-flashcard-inner { position: relative; width: 100%; height: 100%; transition: transform 0.5s; transform-style: preserve-3d; }
  .pec-flashcard.flipped .pec-flashcard-inner { transform: rotateY(180deg); }
  .pec-flashcard-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); padding: 26px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-shadow: 0 2px 10px rgba(20,33,61,0.06); }
  .pec-flashcard-face.back { transform: rotateY(180deg); background: #FBF7EC; }
  .pec-flashcard-tag { color: #fff; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 12px; margin-bottom: 16px; }
  .pec-flashcard-tag.gold { background: var(--gold); color: #fff; }
  .pec-flashcard-text { font-size: 16px; line-height: 1.55; font-family: 'Space Grotesk', sans-serif; font-weight: 500; max-height: 150px; overflow-y: auto; }
  .pec-flashcard-hint { position: absolute; bottom: 16px; font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.08em; }
  .pec-review-actions { display: flex; gap: 14px; }
  .pec-answer-btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 8px; padding: 10px 22px; font-size: 13.5px; font-weight: 600; cursor: pointer; color: #fff; }
  .pec-answer-btn.right { background: var(--green); }
  .pec-answer-btn.right:hover { background: #255c3f; }
  .pec-answer-btn.wrong { background: var(--coral); }
  .pec-answer-btn.wrong:hover { background: #963333; }
`;
