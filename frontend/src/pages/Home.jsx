import { Link } from 'react-router-dom';
import Dial from '../components/ui/Dial';
import Ladder from '../components/ui/Ladder';

const FEATURES = [
  { n: '01', t: 'Five KPIs, one score', d: 'Attendance, tasks, quality, teamwork and innovation roll up into a single weighted score out of 100.' },
  { n: '02', t: 'Levels that ladder up', d: 'A clear A–E ladder gives everyone a visible path from developing to outstanding.' },
  { n: '03', t: 'Points you can feel', d: 'Every good cycle earns points. Progress is banked, not forgotten.' },
  { n: '04', t: 'Promotion by proof', d: 'Three consecutive Level-A cycles triggers promotion review. Data decides, not opinions.' },
];

export default function Home() {
  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">KPI performance · made visible</div>
              <h1>See your effort <span className="accent">add up.</span></h1>
              <p className="hero-sub">
                Zippio scores every cycle against the five KPIs that matter, converts results into a
                level, and banks points you can watch grow month after month.
              </p>
              <div className="hero-actions">
                <Link to="/login" className="btn-primary">Sign in</Link>
                <a href="/#how" className="btn-ghost">How it works</a>
              </div>
              <div className="hero-note">Attendance 10 · Tasks 35 · Quality 25 · Teamwork 15 · Innovation 15 = 100</div>
            </div>
            <div className="dial-wrap">
              <div className="dial-card">
                <div className="dial-label">This month · Level B</div>
                <div style={{ position: 'relative' }}>
                  <Dial score={87} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="dial-score">87</div>
                    <div className="dial-grade">Level B · trending up</div>
                  </div>
                </div>
                <div className="dial-foot">
                  <span>Points <b>+412</b></span>
                  <span>Lifetime <b>2,140</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="how">
        <div className="wrap">
          <div className="section-head">
            <div className="section-eyebrow">How it works</div>
            <h2>One system, zero guesswork.</h2>
            <p className="section-sub">Managers score each cycle against the five weighted KPIs. Zippio does the math, shows the level, and keeps the points.</p>
          </div>
          <div className="feat-grid">
            {FEATURES.map((f) => (
              <div className="feat" key={f.n}>
                <div className="feat-num">{f.n}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="levels">
        <div className="wrap">
          <div className="section-head">
            <div className="section-eyebrow">The ladder</div>
            <h2>Five levels. Clear thresholds.</h2>
            <p className="section-sub">Scores map straight onto a ladder — no hidden curves.</p>
          </div>
          <div style={{ maxWidth: 680 }}>
            <Ladder active="B" height={280} />
          </div>
        </div>
      </section>

      <section id="promotion">
        <div className="wrap">
          <div className="cta-band">
            <h2>Three Level-A cycles. One promotion.</h2>
            <p>Promotion candidates are surfaced by the data, three consecutive outstanding cycles at a time. No lobbying, no recency bias.</p>
            <Link to="/login" className="btn-primary">See it in action</Link>
          </div>
        </div>
      </section>
    </>
  );
}
