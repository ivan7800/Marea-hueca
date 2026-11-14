# QA · La Marea Hueca 0.1.0

## Base

- Node 24.22.1 en el entorno de ejecución. La suite cubre semilla, límites, aparición, física, mochila, herramientas, recetas, mallas, guardado, corrupción, recuperación y ecos.
- Prueba de navegador reproducible en `tests/browser.mjs`. Usa eventos de teclado, ratón o botones de la interfaz y un observador habilitado por `?qa=1`. La ranura del juego normal queda fuera de las pruebas.
- El sitio se sirve desde `/LA-MAREA-HUECA/` para reproducir un subdirectorio de GitHub Pages. El proyecto no tiene recursos dependientes del nombre del repositorio.

## Plataformas

- La vista compartida de Chrome muestra el menú y el formulario de semilla. Intentar iniciar el mundo en esa vista devuelve WebGL 2 deshabilitado por el entorno.
- La prueba de escritorio usa Chromium headless 141.0.7390.0, Linux, 1280 × 720 CSS, SwiftShader y CPU Intel Xeon Platinum 8573C virtualizada. WebGL 2 está disponible mediante la implementación por software.
- Quedan pendientes Safari, Firefox, GPU física, mando, móvil físico y una prueba de escucha de la mezcla en altavoces o auriculares. El juego no ofrece controles táctiles.

## Alcance del mundo y límites

La cuenca tiene 36 chunks de base como máximo y ocho criaturas. Se construyen caras expuestas y se regeneran los vecinos cuando una edición toca un borde. Se priorizan nueve chunks iniciales y el resto se carga de uno en uno. Las ediciones se limitan a 40.000. La persistencia usa una ranura y exportación JSON. Cambiar de ruta en la edición autónoma puede cambiar el ámbito del guardado.

El flujo de Pages está incluido y requiere un repositorio nuevo con permisos de escritura y GitHub Actions habilitado como origen. No se ha desplegado a GitHub.

La ejecución independiente de la edición autónoma abrió una partida desde `file://` con red desactivada, WebGL 2 operativo y guardado local disponible. La emulación táctil de iPhone 13 en Chromium verificó el menú y los ajustes a 390 × 664 CSS (DPR 3).

En las tomas de La Costra sin desplazamiento, la resolución normal y 25 chunks registraron 14,6–15,9 FPS. Con resolución baja y nueve chunks, las repeticiones registraron 15,8–20,6 FPS. Se tomaron intervalos de `requestAnimationFrame` durante unos 4,35 s por toma. La carga variable del host produjo picos de 133–216 ms al percentil 95 en las tomas indicadas. Estos datos corresponden a renderizado por software.

## Recorrido ejecutado

La suite de escritorio completó una partida nueva con la semilla MAREA-17. Avanzó y saltó con el teclado, extrajo y colocó bloques, fabricó el escoplo, guardó, exportó y recargó. Comprobó las ediciones tras la recarga y reanudó tras liberar el cursor. Visitó La Costra, El Espinazo y La Salina Ciega, recibió daño de una raspadura, recogió los dos ecos, bajó por el observatorio y devolvió los ecos en la Cámara Sorda. También rechazó un JSON corrupto e importó el JSON exportado para recuperar un estado anterior. No aparecieron errores de aplicación ni de WebGL en las comprobaciones del recorrido.

La Salina registró 13,6 FPS de media (57 fotogramas, p95 de 300,1 ms) con resolución baja y nueve chunks. El registro de La Costra de esa misma ejecución dio 15,8 FPS (68 fotogramas, p95 de 166,6 ms). Se verificaron los fotogramas en dos escenas fijas. El recorrido completo usa entradas normales y su tiempo incluye la automatización y las capturas, por lo que no se usa para estimar duración.

La revisión visual cubrió portada, aparición, extracción, colocación, mochila, pausa, recarga, superficies de los tres biomas, límenes, interfaz móvil, Cámara Sorda y resultado del encuentro. El Espinazo registró daño y aviso de raspadura. Se usaron capturas para corregir la disposición de las casillas de ajustes en la pantalla estrecha.

El recorrido de aceptación utilizó I/J/K/L, M y N para cámara, extracción y colocación. El entorno sin ventana permitió probar captura y liberación de puntero, pero no reprodujo movimientos relativos de ratón de forma fiable. Queda pendiente la vuelta completa con un ratón físico y la pérdida de foco en una sesión de escritorio visible. La derrota se verificó en la suite de sistemas. No se midió la duración de una partida libre ni se hizo una prueba con jugadores externos.

## Verificación de 0.2.0

- Base: `06af609` de GitHub. La raíz pública y su módulo principal respondieron HTTP 200 antes de los cambios. Pages usa despliegue por rama. La entrada conserva la URL pública y toma sus recursos de la compilación versionada en `dist/`.
- Pasaron las 11 pruebas de sistemas, incluidas la migración v1 y la persistencia de hallazgos y fanales. Se reconstruyeron la edición web y el HTML autónomo.
- Microbenchmark en Node 24.22.1, Linux x64, Intel Xeon Platinum 8573C virtualizado. Semilla MAREA-17, nueve chunks centrales precalentados, 25 mediciones alternas por versión. Mediana de 80,25 a 9,17 ms y p95 de 145,17 a 22,26 ms. Ambas versiones generaron 30.294 vértices.
- La toma fija de La Costra, a 1280 × 720 CSS, calidad baja y nueve chunks, pasó de 22,5 a 24,3 FPS en sendas ejecuciones con Chromium 141 y SwiftShader (4,35 s nominales). La carga variable del entorno limita cualquier comparación de FPS y no representa hardware físico.
- Pendientes de evaluación física: ratón bajo bloqueo de puntero, latencia audiovisual, GPU, Firefox, Safari, móvil y mando.

## Verificación de 0.3.0

- Chromium 141.0.7390.0 en Linux, escritorio virtual a 1280 × 720 CSS con WebGL 2 sobre SwiftShader. Recorrido por teclado desde lanzamiento hasta la Cámara Sorda: minería, construcción, mochila, fabricación, guardado, recarga, tres biomas, ecos y objetivo. Se probaron pausa, reanudación, cursor y pérdida de foco simulada. Menú y ajustes se probaron también con emulación de iPhone 13.
- Se revisaron capturas del recorrido y tomas adicionales en calidad normal con motas, junto con una escena de dos fanales. El modo de calidad baja omite las motas.
- El recorrido comprobó los cuatro cambios de tema, pausa, vuelta al menú, silencio total y persistencia de volúmenes independientes. Una prueba directa con Web Audio API y analizador registró señal para los cuatro temas, la modulación de amenaza y el motivo de hallazgo. El máximo observado fue de siete voces y se observó cero en pausa y silencio. La prueba de señal no incluyó escucha física por auriculares o altavoces.
- Comparación exploratoria en vistas fijas, semilla MAREA-17, 4,35 s nominales por toma, calidad baja, distancia corta, procesador Xeon Platinum 8573C virtualizado. FPS 0.2.0 → 0.3.0: Costra 10,7 → 15,6; Espinazo 6,1 → 5,6; Salina 0,8 → 9,3; Cámara 1,6 → 11,3. En Salina y Cámara la base produjo solo cuatro y cinco intervalos respectivamente. La carga variable y el renderizado por software impiden atribuir esas diferencias al código o concluir rendimiento en ordenadores físicos.
- Pendientes físicos: ratón con ventana visible, GPU, Safari, Firefox y evaluación auditiva de la mezcla.

## Verificación de 0.3.1

- La escena celeste se comprobó en Chromium 141 con WebGL 2 sobre SwiftShader. Satélite y arco permanecen estables en superficie y se atenúan con profundidad. El movimiento reducido congela su animación. La prueba no representa una GPU física.
