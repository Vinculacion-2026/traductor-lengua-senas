# Base de datos temporal

Este proyecto aun puede funcionar con `data/global-data.json`, pero ya queda preparado para migrar a PostgreSQL/Supabase.

## Archivos

- `db/schema.sql`: crea las tablas `sign_entries` y `sign_samples`.
- `scripts/export-for-db.mjs`: convierte `data/global-data.json` en `data/db-export.json`.
- `data/db-export.json`: se genera al ejecutar `npm run export:db`.

## Pasos para preparar Supabase

1. Crear un proyecto en Supabase.
2. Abrir el SQL Editor.
3. Copiar y ejecutar el contenido de `db/schema.sql`.
4. Ir a `Project Settings > Database > Connect`.
5. Copiar el connection string de Postgres o del pooler.
6. Guardar esa cadena para configurarla luego como variable de entorno del servidor.

## Exportar la informacion actual

Ejecutar:

```bash
npm run export:db
```

Eso crea `data/db-export.json` con:

- `entries`: palabras, frases y letras.
- `samples`: muestras individuales con pose, movimiento, fecha y datos crudos.

## Siguiente paso

Cuando ya exista la base temporal, se puede agregar un adaptador en `server.mjs` para que:

- `GET /api/global-data` lea desde PostgreSQL.
- `POST /api/global-data` guarde en PostgreSQL.
- `DELETE /api/global-data` borre entrada completa o muestra individual.

Mientras no se configure base de datos, el proyecto sigue funcionando con el JSON actual.
