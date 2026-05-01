import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

export default function Kalender() {
  const [bestellungen, setBestellungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monat, setMonat] = useState(() => {
    const d = new Date();
    return { jahr: d.getFullYear(), monat: d.getMonth() };
  });

  useEffect(() => {
    fetch('/api/bestellungen').then(r => r.json()).then(d => {
      if (d.ok) setBestellungen(d.bestellungen || []);
      setLoading(false);
    });
  }, []);

  // Map: "DD.MM.YYYY" → {anzahl, offen}
  const tagesMap = useMemo(() => {
    const m = {};
    bestellungen.forEach(b => {
      if (!b.lieferdatum || b.status === 'ersetzt') return;
      const k = b.lieferdatum;
      if (!m[k]) m[k] = { anzahl: 0, offen: 0 };
      m[k].anzahl++;
      if (b.status === 'neu' || b.status === 'konflikt') m[k].offen++;
    });
    return m;
  }, [bestellungen]);

  const tageImMonat = new Date(monat.jahr, monat.monat + 1, 0).getDate();
  const ersterTag = new Date(monat.jahr, monat.monat, 1).getDay(); // 0=So
  const offsetMo = (ersterTag + 6) % 7; // Mo-basiert
  const heuteIso = new Date().toISOString().substring(0, 10);
  const monatsName = new Date(monat.jahr, monat.monat).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  function changeMonat(delta) {
    let nm = monat.monat + delta;
    let nj = monat.jahr;
    if (nm < 0) { nm = 11; nj--; }
    if (nm > 11) { nm = 0; nj++; }
    setMonat({ jahr: nj, monat: nm });
  }

  const tage = [];
  for (let i = 0; i < offsetMo; i++) tage.push(null);
  for (let d = 1; d <= tageImMonat; d++) tage.push(d);

  return (
    <div className="app">
      <div className="header">
        <div className="header-sub">Bauers Garten</div>
        <div className="header-title">Liefertage</div>
      </div>

      <div className="date-switcher">
        <button className="date-arrow" onClick={() => changeMonat(-1)}>‹</button>
        <div className="date-center">
          <div className="date-main">{monatsName}</div>
        </div>
        <button className="date-arrow" onClick={() => changeMonat(1)}>›</button>
      </div>

      <div className="content">
        <div className="cal-grid-head">
          {['MO','DI','MI','DO','FR','SA','SO'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="cal-grid">
          {tage.map((d, i) => {
            if (d === null) return <div key={i} className="cal-empty"></div>;
            const dStr = `${String(d).padStart(2,'0')}.${String(monat.monat+1).padStart(2,'0')}.${monat.jahr}`;
            const dIso = `${monat.jahr}-${String(monat.monat+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const info = tagesMap[dStr];
            const isHeute = dIso === heuteIso;

            let cls = 'cal-day';
            if (info) cls += ' cal-pos';
            if (info?.offen > 0) cls += ' cal-warn';
            if (isHeute) cls += ' cal-heute';

            return (
              <Link key={i} href={`/?datum=${dIso}`} className={cls}>
                <div className="cal-num">{d}</div>
                {info && <div className="cal-count">{info.anzahl}{info.offen > 0 ? ' ⚠' : ''}</div>}
              </Link>
            );
          })}
        </div>

        <div className="cal-legend">
          <div className="cal-legend-row">
            <span className="legend-dot" style={{ background: '#e8f0e0' }}></span>
            <span>Bestellungen vorhanden</span>
          </div>
          <div className="cal-legend-row">
            <span className="legend-dot" style={{ background: '#fff3a0' }}></span>
            <span>Offene Bestellungen</span>
          </div>
          <div className="cal-legend-row">
            <span className="legend-dot" style={{ background: '#2d5016' }}></span>
            <span>Heute</span>
          </div>
        </div>
      </div>

      <div className="bottom-nav">
        <Link href="/" className="nav-item" style={{textDecoration:'none',color:'inherit'}}>
          <div className="nav-icon">📋</div>
          <div>Liste</div>
        </Link>
        <div className="nav-item active">
          <div className="nav-icon">📅</div>
          <div>Kalender</div>
        </div>
      </div>
    </div>
  );
}
