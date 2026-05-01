import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

export default function Home() {
  const [bestellungen, setBestellungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('produkt'); // 'produkt' | 'kunde'
  const [datum, setDatum] = useState(() => {
    const d = new Date();
    return d.toISOString().substring(0, 10);
  });
  const [expanded, setExpanded] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [conflictView, setConflictView] = useState(null);

  async function laden() {
    setLoading(true);
    try {
      const r = await fetch('/api/bestellungen');
      const d = await r.json();
      if (d.ok) setBestellungen(d.bestellungen || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    try {
      await fetch('/api/sync');
      await laden();
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  }

  useEffect(() => {
    laden();
  }, []);

  // Datum DD.MM.YYYY für Vergleich mit lieferdatum
  function formatDateDeutsch(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function changeDatum(delta) {
    const d = new Date(datum);
    d.setDate(d.getDate() + delta);
    setDatum(d.toISOString().substring(0, 10));
  }

  // Filter aktiver Bestellungen für gewähltes Datum
  const datumDeutsch = formatDateDeutsch(datum);
  const aktiv = useMemo(() => {
    return bestellungen.filter(
      b => b.lieferdatum === datumDeutsch && b.status !== 'ersetzt'
    );
  }, [bestellungen, datumDeutsch]);

  const konflikte = aktiv.filter(b => b.konflikt);
  const offene = aktiv.filter(b => b.status === 'neu' || b.status === 'konflikt');

  // Nach Produkt gruppieren
  const proProdukt = useMemo(() => {
    const map = {};
    aktiv.forEach(b => {
      (b.positionen || []).forEach(p => {
        const k = p.produkt;
        if (!map[k]) map[k] = { produkt: k, gesamt: 0, kunden: [] };
        map[k].gesamt += p.menge || 0;
        map[k].kunden.push({ kunde: b.kunde, menge: p.menge, einheit: p.einheit, status: b.status });
      });
    });
    return Object.values(map).sort((a, b) => a.produkt.localeCompare(b.produkt));
  }, [aktiv]);

  // Nach Kunde gruppieren
  const proKunde = useMemo(() => {
    const map = {};
    aktiv.forEach(b => {
      const k = b.kunde;
      if (!map[k]) map[k] = { kunde: k, bestellungen: [] };
      map[k].bestellungen.push(b);
    });
    return Object.values(map).sort((a, b) => a.kunde.localeCompare(b.kunde));
  }, [aktiv]);

  if (conflictView) {
    return <KonfliktView bestellung={conflictView} alleBestellungen={bestellungen} onClose={() => setConflictView(null)} onResolved={() => { setConflictView(null); laden(); }} />;
  }

  const wochentag = new Date(datum).toLocaleDateString('de-DE', { weekday: 'long' });

  return (
    <div className="app">
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-sub">Bauers Garten</div>
            <div className="header-title">Bestellungen</div>
          </div>
          <button className="sync-btn" onClick={sync} disabled={syncing}>
            {syncing ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="tabs">
        <div className={'tab ' + (tab === 'produkt' ? 'active' : '')} onClick={() => setTab('produkt')}>Nach Produkt</div>
        <div className={'tab ' + (tab === 'kunde' ? 'active' : '')} onClick={() => setTab('kunde')}>Nach Kunde</div>
      </div>

      <div className="date-switcher">
        <button className="date-arrow" onClick={() => changeDatum(-1)}>‹</button>
        <div className="date-center">
          <div className="date-day">{wochentag}</div>
          <div className="date-main">{datumDeutsch}</div>
        </div>
        <button className="date-arrow" onClick={() => changeDatum(1)}>›</button>
      </div>

      <div className="summary">
        <div>
          <span className="summary-num">{tab === 'produkt' ? proProdukt.length : proKunde.length}</span>
          <span className="summary-lbl">{tab === 'produkt' ? 'Produkte' : 'Kunden'}</span>
        </div>
        <div>
          <span className="summary-num">{aktiv.length}</span>
          <span className="summary-lbl">Bestellungen</span>
        </div>
        <div>
          <span className="summary-num">{konflikte.length > 0 ? '⚠ ' + konflikte.length : offene.length}</span>
          <span className="summary-lbl">{konflikte.length > 0 ? 'Konflikt' : 'offen'}</span>
        </div>
      </div>

      <div className="content">
        {loading && <div className="loading">Lade Bestellungen...</div>}
        {!loading && aktiv.length === 0 && (
          <div className="empty">Keine Bestellungen für diesen Tag.</div>
        )}

        {konflikte.map(b => (
          <div key={b.id} className="conflict-banner" onClick={() => setConflictView(b)}>
            <span className="conflict-icon">⚠</span>
            <div>
              <div className="conflict-title">{b.kunde} – Bestellung 2× erhalten</div>
              <div className="conflict-sub">Tippen um zu prüfen →</div>
            </div>
          </div>
        ))}

        {tab === 'produkt' && proProdukt.map(p => (
          <div key={p.produkt} className="produkt-card" onClick={() => setExpanded({ ...expanded, [p.produkt]: !expanded[p.produkt] })}>
            <div className="produkt-head">
              <div>
                <div className="produkt-name">{p.produkt}</div>
                <div className="produkt-sub">{p.kunden.length} {p.kunden.length === 1 ? 'Kunde' : 'Kunden'}</div>
              </div>
              <div className="produkt-menge">
                <div className="produkt-menge-zahl">{p.gesamt}</div>
                <div className="produkt-menge-lbl">VK</div>
              </div>
            </div>
            {expanded[p.produkt] && (
              <div className="produkt-detail">
                {p.kunden.map((k, i) => (
                  <div key={i} className="kunde-row">
                    <span>{k.kunde}</span>
                    <span className="kunde-menge">{k.menge}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {tab === 'kunde' && proKunde.map(k => (
          <div key={k.kunde} className="produkt-card" onClick={() => setExpanded({ ...expanded, [k.kunde]: !expanded[k.kunde] })}>
            <div className="produkt-head">
              <div>
                <div className="produkt-name">{k.kunde}</div>
                <div className="produkt-sub">
                  {k.bestellungen.reduce((s, b) => s + (b.positionen?.length || 0), 0)} Positionen
                </div>
              </div>
              <div className="produkt-menge">
                <div className="produkt-menge-zahl">{k.bestellungen.length}</div>
                <div className="produkt-menge-lbl">{k.bestellungen.length === 1 ? 'Best.' : 'Best.'}</div>
              </div>
            </div>
            {expanded[k.kunde] && (
              <div className="produkt-detail">
                {k.bestellungen.flatMap(b => b.positionen || []).map((p, i) => (
                  <div key={i} className="kunde-row">
                    <span>{p.produkt}</span>
                    <span className="kunde-menge">{p.menge}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bottom-nav">
        <div className="nav-item active">
          <div className="nav-icon">📋</div>
          <div>Liste</div>
        </div>
        <Link href="/kalender" className="nav-item" style={{textDecoration:'none',color:'inherit'}}>
          <div className="nav-icon">📅</div>
          <div>Kalender</div>
        </Link>
      </div>
    </div>
  );
}

function KonfliktView({ bestellung, alleBestellungen, onClose, onResolved }) {
  const [working, setWorking] = useState(false);
  const alte = alleBestellungen.find(b => b.id === bestellung.konfliktMit);

  if (!alte) {
    return (
      <div className="app">
        <div className="header">
          <div className="header-title">Konflikt</div>
        </div>
        <div className="content">
          <p>Frühere Bestellung nicht gefunden.</p>
          <button className="btn-primary" onClick={onClose}>Zurück</button>
        </div>
      </div>
    );
  }

  async function handle(action) {
    setWorking(true);
    try {
      await fetch('/api/conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neueId: bestellung.id, alteId: alte.id, action }),
      });
      onResolved();
    } catch (e) {
      console.error(e);
      setWorking(false);
    }
  }

  return (
    <div className="app">
      <div className="header" style={{ background: '#fff8d0' }}>
        <div className="header-row">
          <button className="back-arrow" onClick={onClose}>‹ Zurück</button>
        </div>
        <div className="header-sub" style={{ color: '#7a5500' }}>⚠ Mögliche Änderung</div>
        <div className="header-title" style={{ color: '#7a5500' }}>{bestellung.kunde}</div>
        <div style={{ fontSize: 11, color: '#7a5500', marginTop: 2 }}>
          Liefertag: {bestellung.lieferdatum}
        </div>
      </div>

      <div className="content">
        <div className="conflict-card">
          <div className="conflict-versions">
            <div className="version-card alt">
              <div className="version-label">1. Mail</div>
              <div className="version-time">{new Date(alte.empfangenAm).toLocaleString('de-DE')}</div>
              {(alte.positionen || []).map((p, i) => (
                <div key={i} className="version-pos">
                  <span>{p.produkt}</span>
                  <span className="menge">{p.menge}</span>
                </div>
              ))}
            </div>
            <div className="version-card neu">
              <div className="version-label" style={{ color: '#f57c00' }}>2. Mail (neu)</div>
              <div className="version-time">{new Date(bestellung.empfangenAm).toLocaleString('de-DE')}</div>
              {(bestellung.positionen || []).map((p, i) => (
                <div key={i} className="version-pos">
                  <span>{p.produkt}</span>
                  <span className="menge">{p.menge}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="action-row">
            <button className="action-btn btn-replace" disabled={working} onClick={() => handle('replace')}>
              <strong>Neue Bestellung übernimmt</strong>
              <span className="sub">Wenn Mail 2 die erste ersetzen soll</span>
            </button>
            <button className="action-btn btn-add" disabled={working} onClick={() => handle('add')}>
              <strong>Mengen addieren</strong>
              <span className="sub">Wenn Mail 2 eine Nachbestellung ist</span>
            </button>
            <button className="action-btn btn-keep" disabled={working} onClick={() => handle('keep_both')}>
              <strong>Beide einzeln behalten</strong>
              <span className="sub">Manuell entscheiden, später</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
