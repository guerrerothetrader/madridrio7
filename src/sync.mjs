// Función de Netlify: POST /api/sync.
// Se empaqueta (con @netlify/blobs incluido) en netlify/functions/sync.mjs; ver build.sh.
import { getStore } from "@netlify/blobs";
import { handleRequest } from "./sync-core.mjs";

export default async (req) =>
    handleRequest(req, getStore({ name: "equipo", consistency: "strong" }), process.env);
