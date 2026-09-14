"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportRow = {
  channel: "meta" | "google";
  externalId: string;
  name: string;
  status: string;
  dailyBudget?: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  frequency?: number;
  capturedAt?: string;
};

const template = `channel,external_id,campaign_name,status,daily_budget,spend,impressions,clicks,conversions,revenue,frequency,captured_at
meta,meta-123,Festive Prospecting,active,5000,18250,245000,6800,124,91200,1.9,2026-09-14T12:00:00.000Z
google,gads-456,Brand Search,active,3000,9200,58000,4200,188,75600,,2026-09-14T12:00:00.000Z`;

function parseLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function key(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseNumber(value: string | undefined, field: string, row: number, optional = false) {
  if (!value?.trim()) {
    if (optional) return undefined;
    throw new Error(`Row ${row}: ${field} is required.`);
  }
  const cleaned = value.replace(/[₹$£€,\s]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Row ${row}: ${field} must be a positive number.`);
  return parsed;
}

function parseCsv(csv: string): ImportRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one campaign row.");

  const headers = parseLine(lines[0]).map(key);
  const index = new Map(headers.map((header, i) => [header, i]));
  const value = (cells: string[], aliases: string[]) => {
    for (const alias of aliases) {
      const i = index.get(alias);
      if (i !== undefined) return cells[i] ?? "";
    }
    return "";
  };

  return lines.slice(1).map((line, offset) => {
    const rowNumber = offset + 2;
    const cells = parseLine(line);
    const rawChannel = value(cells, ["channel", "platform"]).toLowerCase();
    const channel: "meta" | "google" =
      ["meta", "facebook", "instagram"].includes(rawChannel) ? "meta" :
      ["google", "google_ads", "googleads"].includes(rawChannel) ? "google" :
      (() => { throw new Error(`Row ${rowNumber}: channel must be meta or google.`); })();

    const externalId = value(cells, ["external_id", "campaign_id", "id"]).trim();
    const name = value(cells, ["campaign_name", "name", "campaign"]).trim();
    if (!externalId) throw new Error(`Row ${rowNumber}: external_id is required.`);
    if (!name) throw new Error(`Row ${rowNumber}: campaign_name is required.`);

    const capturedRaw = value(cells, ["captured_at", "date", "timestamp"]).trim();
    let capturedAt: string | undefined;
    if (capturedRaw) {
      const date = new Date(capturedRaw);
      if (Number.isNaN(date.getTime())) throw new Error(`Row ${rowNumber}: captured_at is not a valid date.`);
      capturedAt = date.toISOString();
    }

    return {
      channel,
      externalId,
      name,
      status: value(cells, ["status"]).trim() || "active",
      dailyBudget: parseNumber(value(cells, ["daily_budget", "budget"]), "daily_budget", rowNumber, true),
      spend: parseNumber(value(cells, ["spend", "amount_spent"]), "spend", rowNumber) as number,
      impressions: parseNumber(value(cells, ["impressions"]), "impressions", rowNumber) as number,
      clicks: parseNumber(value(cells, ["clicks", "link_clicks"]), "clicks", rowNumber) as number,
      conversions: parseNumber(value(cells, ["conversions", "purchases", "leads"]), "conversions", rowNumber) as number,
      revenue: parseNumber(value(cells, ["revenue", "conversion_value", "purchase_value"]), "revenue", rowNumber) as number,
      frequency: parseNumber(value(cells, ["frequency"]), "frequency", rowNumber, true),
      capturedAt,
    };
  });
}

export function CampaignImporter({ canManage = true }: { canManage?: boolean }) {
  const router = useRouter();
  const [csv, setCsv] = useState(template);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      setCsv(await file.text());
    } catch {
      setError("Unable to read that CSV file.");
    }
  }

  async function submit() {
    if (!canManage) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const rows = parseCsv(csv);
      const response = await fetch("/api/campaigns/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Campaign import failed.");
      setMessage(body.message || "Campaign data imported.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="section-head">
        <div>
          <p className="eyebrow">FIRST-PARTY DATA IMPORT</p>
          <h2>Import Meta / Google performance</h2>
        </div>
        <span className="pill">CSV · up to 500 rows</span>
      </div>
      <p className="muted">
        Use a normalized export when direct provider sync is not connected. The latest imported metric becomes the campaign diagnosis snapshot; values are never invented by AI.
      </p>
      <label>CSV file
        <input type="file" accept=".csv,text/csv" disabled={!canManage || busy} onChange={(e) => loadFile(e.target.files?.[0])} />
      </label>
      <label>CSV data
        <textarea rows={10} value={csv} disabled={!canManage || busy} onChange={(e) => setCsv(e.target.value)} />
      </label>
      <p className="muted">
        Required columns: channel, external_id, campaign_name, spend, impressions, clicks, conversions, revenue. Optional: status, daily_budget, frequency, captured_at.
      </p>
      {message && <div className="profile-notice success">{message}</div>}
      {error && <div className="error-box">{error}</div>}
      <button className="btn" type="button" disabled={!canManage || busy} onClick={submit}>
        {busy ? "Importing…" : "Import campaign data"}
      </button>
    </section>
  );
}
