#!/bin/sh
# Solo hace falta si cambias sync-core.mjs. Requiere: npm i @netlify/blobs esbuild (en esta carpeta)
npx esbuild sync.mjs --bundle --platform=node --format=esm --target=node20 --legal-comments=none \
  --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" \
  --outfile=../netlify/functions/sync.mjs
printf '\nexport const config = { path: "/api/sync" };\n' >> ../netlify/functions/sync.mjs
