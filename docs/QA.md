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
