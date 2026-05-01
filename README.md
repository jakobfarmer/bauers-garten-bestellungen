# Bauers Garten – Bestellungs-App

## Setup-Schritte (wenn du wieder am Computer sitzt)

### 1. GitHub-Repo anlegen
Genauso wie beim Ernte-Tool – neues öffentliches Repo, z.B. `bauers-garten-bestellungen`.

### 2. Diese Dateien hochladen

### 3. Auf Vercel importieren
- "New Project" → das Repo wählen
- **Wichtig:** Vor dem Deployen Environment Variables setzen!

### 4. Environment Variables in Vercel

| Name | Wert |
|------|------|
| `AZURE_TENANT_ID` | `b2833459-8aad-47bb-a8da-f5dde21cd01d` |
| `AZURE_CLIENT_ID` | `01f5ada4-c4dc-4b5d-a03d-d8032f74fd87` |
| `AZURE_CLIENT_SECRET` | (der "Wert" aus Azure - den hast du dir notiert) |
| `MAIL_POSTFACH` | `bestellung@bauersgarten.de` |
| `ANTHROPIC_API_KEY` | (dein API-Key - gleicher wie beim Ernte-Tool) |
| `KV_REST_API_URL` | (von Upstash, gleicher wie beim Ernte-Tool) |
| `KV_REST_API_TOKEN` | (von Upstash, gleicher wie beim Ernte-Tool) |

### 5. Deployen
Vercel baut automatisch, dauert ~1 Minute.

### 6. Erster Test
- App öffnen → solltest leere Liste sehen
- Manuell synchronisieren mit dem ↻ Button rechts oben
- Mit echten Bestellungen testen

## Was die App macht

- **Alle 15 Minuten** prüft sie automatisch das Postfach (Vercel Cron)
- Mails von bekannten Domains mit PDF-Anhang werden ausgelesen
- Claude liest die Bestellung aus dem PDF
- Doppelte Bestellungen vom gleichen Kunden + Liefertag werden als Konflikt markiert

## Bekannte Domains
- rinklin-naturkost.de
- dennree.de
- landlinie.de
- biogros.lu
- engemann-bio.de
- grundhoefer-frankfurt.de

Erweitern in `lib/graph.js` → `KUNDEN_DOMAINS`.
