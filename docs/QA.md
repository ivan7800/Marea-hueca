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

## Verificación de 0.4.0

- Chromium 141.0.7390.0 en Linux con SwiftShader, resolución de ventana 800 × 500 CSS, calidad baja y nueve chunks. La prueba `tests/settlement-browser.mjs` carga partidas de QA en los accesos y usa el teclado para cruzar las entradas. Usa el ratón para operar los menús, fabricar y equipar. Se recogieron los dos armarios una sola vez, se probó el rumbo y la recarga de la aguja, se ahuyentó una raspadura gastando una sal, se fabricó y activó el umbral y se guardó y recargó el progreso. El ensayo aislado del umbral no registró daño durante dos segundos. El recorrido no partió de la aparición inicial.
- En tomas fijas de 4,35 s, Boyas registró 9,1 FPS, 38 llamadas y 13.060 triángulos. Costillas registró 14,6 FPS, 87 llamadas y 22.606 triángulos. El host virtualizado tenía carga variable y estos datos no representan una GPU física.
- Node 24.22.1, semilla MAREA-17, Xeon Platinum 8573C virtualizado. Medianas de 60 tomas alternas de generación y malla fría de nueve chunks, base 0.3.1 → 0.4.0: Boyas 17,92 → 18,86 ms (5.844 → 6.104 caras), Costillas 18,99 → 19,42 ms (12.681 → 12.343 caras).
- 14 pruebas de sistemas, incluidas transitabilidad en tres semillas, migración v1/v2, recompensas únicas y persistencia de los objetos. Se construyeron la web y el HTML autónomo.

## Verificación de 0.5.0

- Base `main` 4b1a465. Antes de editar pasaron 14 pruebas de sistemas y se generaron la web y el HTML autónomo.
- Prueba focal de interfaz `tests/ui-browser.mjs`: Chromium 141 headless, Linux virtualizado, WebGL 2 mediante SwiftShader, 1280 × 720 CSS. Se recorrieron portada, Ajustes y vuelta a portada, guía de controles y Escape, Créditos, nueva partida, mochila, pausa, guardar, vuelta al menú y Continuar con partida recuperada; sin errores de página ni respuestas HTTP fallidas.
- Capturas revisadas de menú, mochila, pausa y recarga en escritorio, y menú y guía en emulación de iPhone 13 a 390 × 664 CSS y DPR 3. Se redujo la altura de la portada a 720 px y se corrigió el contraste del botón desactivado en la vista táctil. El móvil físico y el juego táctil siguen sin estar probados ni soportados.
- La portada usa una ilustración Canvas estática con una transición CSS lenta; la preferencia de movimiento reducido anula la animación. No se ha realizado una evaluación visual con usuarios externos ni una escucha de audio.
- El recorrido completo `tests/browser.mjs` pasó en Chromium 141 headless, Linux virtualizado y SwiftShader a 1280 × 720 CSS: extracción, colocación, mochila, fabricación, pausa, recarga, tres biomas, ambos ecos y Cámara Sorda, regreso al menú, importación/exportación y HTML autónomo desde `file://` sin red. Cero errores de aplicación, respuestas HTTP fallidas o errores WebGL durante la prueba. La emulación táctil del menú y ajustes pasó; esto no acredita juego táctil.
- Tomas fijas de aproximadamente 4,35 s en calidad baja y nueve chunks: La Costra 15,8 FPS (67 intervalos, p95 133,4 ms) y La Salina Ciega 13,4 FPS (56 intervalos, p95 250 ms). Son observaciones de renderizado por software en un host de carga variable, sin comparación causal con 0.4.0.

## Candidata 0.6.0

- Node 24.22.1: 15 pruebas unitarias correctas. La nueva prueba comprueba que v3 preserva sus emplazamientos, posición, descubrimientos y ediciones, y selecciona otra huella para el aljibe cuando la primera está ocupada. Se generaron la web y el HTML autónomo.
- En la referencia 0.5.0, Chromium 141 con SwiftShader, 1280 × 720, calidad baja y nueve chunks registró 17,1 FPS en La Costra y 15,8 en la Salina. No hay medidas posteriores comparables.
- En la sesión de continuación, las tres suites Playwright quedaron bloqueadas al lanzar Chromium (`process_singleton_posix.cc: socket() failed: Operation not permitted`). Pendientes recorrido, capturas nuevas, rendimiento con estructuras y criaturas, prueba autónoma en navegador y escucha. Mantener el despliegue actual hasta que se verifique la candidata.

- La continuación añadió borde escénico, vegetación y cielo. Las 15 pruebas unitarias y las dos compilaciones siguen pasando. La inspección de fotogramas nuevos continúa pendiente por el fallo de arranque de Chromium del entorno. No hay mediciones nuevas de FPS de esta candidata ni escucha física del audio.

## 0.6.1 · Mando

- 18 pruebas de sistemas en Node 24.22.1. Se añadieron comprobaciones de deriva, recorrido analógico, flancos de pulsación, gatillos, navegación repetida, reconexión y validación de ajustes en guardados v4. Compilaciones web y autónoma correctas.
- Chromium Headless Shell 141.0.7390.37, Linux virtualizado con WebGL 2 mediante SwiftShader. La prueba de mando sustituye solamente `navigator.getGamepads()` para enviar ejes y botones al juego. Ventana de 1000 × 650 CSS. Probó arranque desde portada, movimiento, cámara, salto, extraer y colocar, barra, mochila, cuaderno, pausa, pérdida de foco simulada, desconexión y recuperación del ratón.
- Pendientes un mando físico, otros navegadores y una escucha real. Un navegador puede exigir un clic o una tecla para desbloquear el audio al iniciar con mando. La versión base ofrece supervivencia. No se pudo comprobar un modo Libre porque aún no existe.
- Recorrido en escritorio a 1280 × 720: los tres biomas, ambos ecos y Cámara Sorda, extracción, construcción, fabricación, pausa, ajustes de audio, guardado, recarga, exportación, importación y rechazo de JSON corrupto. Sin errores de aplicación ni WebGL durante ese recorrido. La prueba de interfaz pasó su tramo de escritorio. Chromium en modo de proceso único se cerró al crear un segundo contexto en ambas suites. Se verificaron por separado el menú y Ajustes en emulación iPhone 13 (390 px) y el arranque con guardado en el HTML autónomo, con red desactivada.
- Prueba de asentamientos a 800 × 500: entradas y suministros de Boyas, Costillas y Aljibe, aguja, lanza, fabricación y umbral, con recarga. Las mediciones fijas con SwiftShader registraron 31,4 FPS en Costra y 10,4 en Salina durante el recorrido de escritorio, con calidad baja y nueve chunks. La carga del entorno varió durante la toma. Estos datos no miden una GPU física ni establecen una comparación antes y después.
