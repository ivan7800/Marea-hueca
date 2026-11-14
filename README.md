# La Marea Hueca · 0.4.0

Sandbox voxel de exploración, construcción y supervivencia con horror cósmico. El mar se retiró de una cuenca que conserva voces bajo la piedra. Puedes excavar, construir tu refugio o salir en busca de dos ecos y llevarlos al recinto enterrado bajo el observatorio.

## Jugar

Abre `La-Marea-Hueca.html` en Chromium o Chrome de escritorio con WebGL 2. El archivo incluye los recursos y funciona sin conexión. Conserva su ruta si usas el guardado local y exporta una copia JSON antes de moverlo, ya que la gestión de los datos de `file://` depende del navegador.

Desde el código fuente, usa Node.js 22 o posterior:

```bash
npm run build
npm run dev
```

Abre `http://127.0.0.1:4173/`. El proceso sirve archivos estáticos. El juego no tiene backend, cuenta, CDN ni telemetría.

| Acción | Tecla o ratón |
|---|---|
| Moverse, correr, saltar | WASD o flechas, Mayús, Espacio |
| Mirar | Ratón o I/J/K/L |
| Minar y recoger | Mantener botón izquierdo o M |
| Colocar el bloque elegido | Botón derecho o N |
| Elegir casilla | 1–8 o rueda |
| Mochila y recetas | E |
| Escuchar un eco, usar musgo o ahuyentar con el gancho | F |
| Cuaderno de campo | C |
| Pausa y cursor | Esc o P |

## Primer recorrido

- En La Costra puedes colocar bloques desde el principio y fabricar el Escoplo de veta con la mochila inicial. El junco se reconoce por sus fibras verticales. Cada recurso extraído va directo a la mochila.
- El objetivo de los ecos es opcional. El Espinazo queda al oeste y la Salina Ciega al este. Sigue el sendero bajo de Z 0. Escucha la Costilla partida en (−28, −5) y el Pozo que escucha en (28, 1) con F.
- La entrada de la Cámara Sorda está en el centro del observatorio, al norte del punto de aparición. Baja por el centro de las escaleras. El eco final está cerca de (0, −24).
- Los límenes se apartan del jugador. Las raspaduras persiguen a corta distancia, especialmente en bajamar. Construye barreras, aléjate o usa el gancho. Si caes, recuperas la salud al regresar y conservas los objetos y cambios.

Los tres hallazgos del cuaderno son opcionales. Examínalos con F y usa sus materiales para fabricar fanales, el gancho o bloques de refugio. Los fanales colocados iluminan su entorno y disuaden a las raspaduras cercanas. Ante el aviso de embestida, toma distancia o usa el gancho.

## Asentamientos y objetos especiales

- **Poblado de las Boyas · La Costra.** La torre de junco señala dos refugios junto a un embarcadero seco. Busca la puerta sur del refugio de caliza. En una partida nueva, la entrada al poblado está cerca de X 9, Z −8. El almacén contiene caliza, junco y la Aguja de resonancia.
- **Estación de las Costillas · El Espinazo.** Dos pilares enmarcan la entrada sur del archivo de basalto, cerca de X −24, Z 13. Su almacén contiene materiales, una Lanza de sal y un Fanal de umbral.
- Entra y pulsa **F** junto al armario marcado con un diamante. Las coordenadas de tu mundo están en el cuaderno (**C**). Si todas las huellas candidatas de un asentamiento están ocupadas por ediciones antiguas, ese asentamiento se omite para preservar la partida.
- Equipa el objeto en la mochila (**E**). La **Aguja** indica rumbo y distancia al hallazgo pendiente más cercano, con 8 segundos de recarga. La **Lanza** ahuyenta raspaduras visibles a un máximo de 5 bloques y consume una sal violeta si acierta. El **Fanal de umbral** dura 14 segundos en un radio de 4,5 bloques y se consume al activarlo. Fabrica otro con un fanal de nácar y 2 sales violetas.

## Banda sonora

El juego sintetiza su música en el navegador. **Donde rompe el junco** acompaña La Costra, **La vértebra de basalto** suena en El Espinazo, **Sedimento de luz** en La Salina Ciega y **El peso del agua ausente** entra al descender bajo el observatorio hacia la Cámara Sorda. Los encuentros y los hallazgos tienen motivos propios. Ajustes permite regular música y efectos por separado o silenciar ambos.

## Guardar y publicar

El autoguardado escribe en una ranura por navegador y origen. Pausa ofrece guardado manual y exportación. Importa desde Créditos. Se pide confirmación al sustituir la ranura y se valida la semilla, las coordenadas, el inventario y las ediciones. El esquema 3 abre partidas de los esquemas 1 y 2 en la misma ranura. Al migrar, sitúa los asentamientos en huellas que no coinciden con tus ediciones ni con tu posición guardada. El modo de prueba `?qa=1` guarda con claves separadas.

```bash
npm test
npm run build
```

GitHub Pages sirve la raíz de `main`. La entrada de la raíz carga los recursos compilados de `dist/` sin cambiar la URL de juego. Regenera y sube `dist/` junto con el código tras ejecutar las pruebas. Para servir solo la compilación, `dist/` también incluye su propio HTML con rutas relativas.

## Reconstruir esta entrega

```bash
npm ci
npm test
npm run build
npm run build:offline
python3 scripts/release.py
```

Para ejecutar la prueba de navegador en un Chromium instalado y reunir capturas:

```bash
npm run build:offline
node scripts/serve.mjs --root dist --base LA-MAREA-HUECA --port 4273
# En otra terminal
MAREA_CHROMIUM=/ruta/a/chromium npm run test:browser
```

La interfaz móvil muestra el menú y permite consultar ajustes. La partida requiere teclado, ratón y bloqueo de puntero. Consulta [QA](docs/QA.md) y [progreso](docs/PROGRESS.md).

## Atribución

Three.js r180 se distribuye bajo MIT. Véase [licencia de Three.js](vendor/THREE-LICENSE.txt). La ilustración, el atlas de bloques, las criaturas, las estructuras, la música y los efectos son originales y se producen con código. La aplicación emplea tipografías de sistema.
