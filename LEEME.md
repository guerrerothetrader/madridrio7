# Madrid Río-Arganzuela B · Seguimiento (con sincronización entre dispositivos)

Los datos (jugadores, resultados, clasificación, objetivos, logo…) se guardan en Netlify
y se replican entre todos los dispositivos y entre los dos entrenadores.

## Contenido
- `public/index.html` → la aplicación.
- `netlify/functions/sync.mjs` → el servidor (función de Netlify, ya empaquetada).
- `netlify.toml` → configuración.
- `src/` → código fuente de la función (solo si quieres regenerarla con `build.sh`).

## Publicar (recomendado: GitHub)
1. Crea un repositorio en GitHub y sube TODO el contenido de esta carpeta.
2. En Netlify: Add new site → Import an existing project → elige el repositorio.
   No hace falta cambiar nada (lee `netlify.toml`). Deploy.
3. Alternativa con CLI: `npm i -g netlify-cli`, `netlify login`, `netlify deploy --prod` en esta carpeta.
   (Arrastrar la carpeta a Netlify Drop: no he podido confirmar que incluya funciones; no lo recomiendo.)

## Primer uso
1. Entrenador 1: pestaña **Datos** → "Sincronización" → escribe un código de equipo (mín. 8 caracteres)
   → **Crear código nuevo**. Sus datos actuales se suben.
2. Entrenador 2 (y otros móviles/tablets): abre la web → **Datos** → mismo código → **Conectar**.
   Si ese dispositivo ya tenía datos propios, pregunta si usar los del equipo o subir los suyos.
3. Desde ahí, cada cambio se envía solo (1–2 s) y los demás lo reciben en ≤60 s o al volver a la pestaña.

## Indicador de la cabecera (☁)
Sincronizado · Sincronizando… · Sin conexión (se guarda y se envía al volver) · Código incorrecto ·
Elige qué datos usar · Sin servidor (la función no está desplegada) · Sin sincronizar.

## Detalles a tener en cuenta
- Si dos personas editan EL MISMO dato a la vez, gana el último en llegar. Datos distintos se conservan ambos.
- "Restablecer datos" se replica a todos los dispositivos conectados.
- Los dibujos de la pizarra táctica no se sincronizan (sí los jugadores, dorsales, posiciones…).
- Cada ~10 min la app se autoverifica y re-sube lo que el servidor haya perdido.
- Opcional: variable de entorno `TEAM_CODE` en Netlify para fijar el código en vez de crearlo desde la app.
- Privacidad: hay nombres de menores. El código es la única protección; no lo compartas fuera del cuerpo técnico
  y no pongas la URL en sitios públicos.
- Plan gratuito de Netlify: el uso de esta app (sondeo cada 60 s solo con la pestaña visible) es muy bajo.
