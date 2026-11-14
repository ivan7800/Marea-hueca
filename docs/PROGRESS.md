# Progreso

## Alcance y decisiones

- Proyecto inicializado en una carpeta vacía. Rama local `main`.
- **La Marea Hueca** transcurre en una cuenca que conserva los ecos de un mar desaparecido. Los refugios son del jugador. El objetivo opcional consiste en devolver dos ecos de la superficie a un recinto bajo el observatorio.
- El bucle empieza junto a un hito seguro. Desde allí se puede extraer caliza y junco, construir, fabricar un escoplo y explorar. Cada bioma tiene una silueta, un material y un ambiente distintos. El peligro se concentra junto a las agujas y aumenta durante la bajamar.
- JavaScript modular, Three.js r180 vendorizado, WebGL 2, audio sintetizado en Web Audio API. Mundo finito de 96 × 96 × 40 con chunks de 16 × 16. Recursos visuales trazados por código.

## Hitos de implementación

1. **Núcleo**. Cuenca reproducible por semilla, búsqueda voxel de la cara bajo el cursor, física fija de 120 Hz, mallas de caras expuestas y reconstrucción por chunk.
2. **Juego**. Mochila de ocho casillas rápidas, cinco recetas, extracción continua por pulsación, bloques colocables, salud, bajamar y dos criaturas. Exploración opcional desde el observatorio hasta la Cámara Sorda.
3. **Presentación**. Portada dibujada por código, atlas procedural, bruma y cielo definidos por región, interfaz de campo, sintetizador con tres capas y efectos con envolventes.
4. **Persistencia y entrega**. Ranura versionada y con validación de datos, respaldo e importación JSON, edición HTML autónoma, proyecto web estático y flujo de publicación.
5. **QA**. Las pruebas de sistemas pasan. La vista compartida deshabilita WebGL. Chromium headless con SwiftShader permite ejecutar la partida y medir escenas. Resultados y limitaciones en `QA.md`.

## Continuación

Para repetir la verificación ejecuta `npm ci`, `npm test`, `npm run build` y `npm run build:offline`. El README documenta cómo levantar el subdirectorio de prueba y ejecutar el recorrido. Tras cambiar el generador, añade una migración o conserva las reglas de generación vinculadas al esquema del guardado, pues los archivos JSON preservan la semilla y las ediciones, no duplican el terreno base.

## 0.2.0 · Expediciones y refugios

- Base auditada: `main` de GitHub, commit `06af609`. El despliegue de Pages por rama sirve la raíz y responde HTTP 200 para el HTML y el módulo principal. El repositorio contiene una copia de `dist/` y el HTML autónomo, sin un workflow de usuario.
- La versión inicial pasó 9 pruebas y produjo ambos formatos. El terreno base se conserva para que las partidas antiguas mantengan su geometría.
- La ampliación añade hallazgos opcionales y un diario de expedición. Los fanales construibles y el gancho dan al jugador maneras de escoger dónde y cómo afrontar un encuentro.
- La malla consulta búferes por chunk y reutiliza los de los vecinos. En una prueba alterna de 25 reconstrucciones de nueve chunks ya cargados, pasó de 80,25 a 9,17 ms de mediana con los mismos 30.294 vértices. Esto mide CPU en Node, no FPS.
- La entrada de Pages usa `dist/` sin redirección ni cambio de origen. Se mantienen la publicación dinámica por rama y la edición autónoma generada a partir del mismo código.


## 0.3.0 · Luz y sonido de la cuenca

- Base remota `6138106`. Las 11 pruebas de sistemas y la compilación de partida pasaron antes de la edición.
- Cuatro patrones musicales por zona con frases de distinta duración y silencios. Fundido por pistas, filtro de bajamar, pulsos cuando una raspadura ya ha sido señalada y motivo breve para descubrimientos nuevos. Audio procedural, sin recursos externos.
- La música limita el trabajo a una pista activa y desacopla la ganancia de las colas de cada zona. Un motor por página, hasta 16 voces simultáneas y liberación al terminar. Pausar detiene la programación de frases. Los ajustes de sonido conservan sus claves.
- Bruma y tonos de luz por región, motas en una sola geometría y fanales mediante cuatro posiciones como máximo. El brillo de los fanales se calcula por distancia, sin sombras ni oclusión por bloques. La calidad baja limita el brillo a dos fanales y omite las motas.
- Posturas de carga y recuperación en las raspaduras. La Cámara Sorda tiene movimiento localizado. No cambia el formato de las partidas.
