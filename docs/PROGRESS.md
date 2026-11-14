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
