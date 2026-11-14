# La Marea Hueca · 0.1.0

Sandbox voxel de exploración, construcción y supervivencia con horror cósmico. El mar se retiró de una cuenca que conserva voces bajo la piedra. Puedes excavar, construir tu refugio o salir en busca de dos ecos y llevarlos al recinto enterrado bajo el observatorio.

## Jugar

Abre `La-Marea-Hueca.html` en Chromium o Chrome de escritorio con WebGL 2. El archivo incluye los recursos y funciona sin conexión. Conserva su ruta si usas el guardado local y exporta una copia JSON antes de moverlo, ya que la gestión de los datos de `file://` depende del navegador.

Desde el código fuente, usa Node.js 22 o posterior:

```bash
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
| Pausa y cursor | Esc o P |

## Primer recorrido

- En La Costra puedes colocar bloques desde el principio y fabricar el Escoplo de veta con la mochila inicial. El junco se reconoce por sus fibras verticales. Cada recurso extraído va directo a la mochila.
- El objetivo de los ecos es opcional. El Espinazo queda al oeste y la Salina Ciega al este. Sigue el sendero bajo de Z 0. Escucha la Costilla partida en (−28, −5) y el Pozo que escucha en (28, 1) con F.
- La entrada de la Cámara Sorda está en el centro del observatorio, al norte del punto de aparición. Baja por el centro de las escaleras. El eco final está cerca de (0, −24).
- Los límenes se apartan del jugador. Las raspaduras persiguen a corta distancia, especialmente en bajamar. Construye barreras, aléjate o usa el gancho. Si caes, recuperas la salud al regresar y conservas los objetos y cambios.

## Guardar y publicar

El autoguardado escribe en una ranura por navegador y origen. Pausa ofrece guardado manual y exportación. Importa desde Créditos. Se pide confirmación al sustituir la ranura y se valida la semilla, las coordenadas, el inventario y las ediciones. El esquema 1 incluye ajustes y progreso. El modo de prueba `?qa=1` guarda con claves separadas.

```bash
npm test
npm run build
```

Publica `dist/` como contenido web estático. Para GitHub Pages, sube el proyecto a un repositorio nuevo y elige **Settings → Pages → Build and deployment → Source → GitHub Actions**. El flujo incluido genera y publica `dist/` desde `main` tras pasar las pruebas de sistemas. Todas las rutas de recursos son relativas al proyecto.

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
