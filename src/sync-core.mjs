// Lógica del servidor de sincronización del equipo (sin dependencias de Netlify: recibe el almacén).
//
// Modelo: el estado de la app se reparte en "celdas" (clave -> valor). Cada dispositivo envía solo las
// celdas que ha cambiado y recibe las que han cambiado otros. Si dos dispositivos cambian la MISMA celda
// gana la última que llega; cambios en celdas distintas (otro jugador, otra jornada...) nunca se pisan.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const STATE_KEY = "state";
export const AUTH_KEY = "auth";
const MAX_BODY = 4_000_000;
const MAX_CELLS_PER_PUSH = 3000;
const KEY_RE = /^(?:pl:\d{1,3}:(?:number|name|position)|mt:\d{1,3}:[A-Za-z]{2,12}|ls:.{1,120}|lo:\d{1,3}|tm:.{1,160}|fld|imp|tgt|logo)$/;

const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = s => createHash("sha256").update(String(s)).digest();
const sameSecret = (a, b) => timingSafeEqual(sha(a), sha(b));
const fail = (status, error) => Object.assign(new Error(error), { status, error });

function hashCode(code) {
    const salt = randomBytes(16).toString("hex");
    return { salt, hash: scryptSync(code, salt, 32).toString("hex") };
}
function checkStored(code, rec) {
    try { return timingSafeEqual(scryptSync(code, rec.salt, 32), Buffer.from(rec.hash, "hex")); }
    catch (e) { return false; }
}

export async function applySync(store, body) {
    let since = Number(body && body.since);
    since = Number.isFinite(since) ? Math.max(0, Math.floor(since)) : 0;
    const changes = body && body.changes && typeof body.changes === "object" ? body.changes : {};
    const keys = Object.keys(changes);
    if (keys.length > MAX_CELLS_PER_PUSH) throw fail(400, "too_many_cells");
    for (const k of keys) {
        const c = changes[k];
        if (!KEY_RE.test(k)) throw fail(400, "bad_key");
        if (!c || typeof c !== "object" || (c.d !== 1 && !("v" in c))) throw fail(400, "bad_cell");
        if (c.d !== 1 && JSON.stringify(c.v).length > (k === "logo" ? 1_500_000 : 50_000)) throw fail(413, "cell_too_big");
    }

    for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await store.getWithMetadata(STATE_KEY, { type: "json" });
        const doc = entry && entry.data ? entry.data : { rev: 0, cells: {} };
        if (keys.length) {
            doc.rev += 1;
            for (const k of keys) {
                const c = changes[k];
                doc.cells[k] = c.d === 1 ? { d: 1, r: doc.rev } : { v: c.v, r: doc.rev };
            }
            // Escritura condicional: si otro dispositivo guardó entre tanto, se repite sobre lo último.
            const res = await store.setJSON(STATE_KEY, doc, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
            if (!res.modified) { await sleep(15 + Math.random() * 60); continue; }
        }
        let from = since, reset = false;
        if (since > doc.rev) { reset = true; from = 0; }      // el servidor se vació o se restauró
        const cells = {};
        for (const [k, c] of Object.entries(doc.cells)) if (c.r > from) cells[k] = c;
        return { rev: doc.rev, cells, reset };
    }
    throw fail(503, "busy");
}

export async function handleRequest(req, store, env = {}) {
    try {
        if (req.method !== "POST") return json({ error: "method" }, 405);
        const text = await req.text();
        if (text.length > MAX_BODY) return json({ error: "too_big" }, 413);
        let body;
        try { body = JSON.parse(text); } catch (e) { return json({ error: "json" }, 400); }
        if (!body || typeof body !== "object") return json({ error: "json" }, 400);

        const code = req.headers.get("x-team-code") || "";
        const action = body.action || "sync";
        const envCode = env.TEAM_CODE ? String(env.TEAM_CODE) : "";
        const auth = envCode ? null : await store.get(AUTH_KEY, { type: "json" });
        const configured = !!envCode || !!auth;

        if (action === "status") return json({ configured, mode: envCode ? "env" : auth ? "stored" : "none" });

        if (action === "claim") {
            if (configured) return json({ error: "already_configured" }, 409);
            if (code.length < 8 || code.length > 100) return json({ error: "weak_code" }, 400);
            const r = await store.setJSON(AUTH_KEY, hashCode(code), { onlyIfNew: true });
            return r.modified ? json({ ok: true }) : json({ error: "already_configured" }, 409);
        }

        if (!configured) return json({ error: "not_configured" }, 403);
        const ok = envCode ? sameSecret(code, envCode) : checkStored(code, auth);
        if (!ok) { await sleep(500); return json({ error: "bad_code" }, 401); }
        if (action !== "sync") return json({ error: "action" }, 400);
        return json(await applySync(store, body));
    } catch (e) {
        if (e && e.status) return json({ error: e.error || e.message }, e.status);
        return json({ error: "server" }, 500);
    }
}
