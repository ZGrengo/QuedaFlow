# @quedaflow/domain

Domain logic package for QuedaFlow. Contains pure, testable business logic for time slot computation.

## Structure

- `time.ts` - Time utilities (HH:MM conversion, overlaps, clamp)
- `blocks.ts` - Block manipulation (split midnight, apply buffer, merge)
- `compute.ts` - Slot computation and ranking
- `types.ts` - TypeScript interfaces
- `ocr-parse.ts` - OCR text parser for schedule screenshots (Mapal, etc.)

## OCR Parser – Formatos soportados

El parser de OCR (`parseMapalOcrText`) es tolerante a múltiples formatos:

- **Fechas**: `dd/mm`, `dd-mm`, `dd.mm` (con o sin año)
- **Rangos horarios**: `HH:MM - HH:MM`, `HH:MM–HH:MM`, `HH:MM a HH:MM`
- **Distribución**: Fecha y horas en la misma línea o en líneas separadas
- **Rango partido**: `13:00 -\n17:00` (inicio y fin en líneas distintas)
- **Día libre**: Líneas con "día libre", "libre", "descanso" no generan turnos
- **OCR**: Normaliza `O`→`0`, `I`/`l`→`1`, guiones largos, espacios extra

## Limitaciones

- Requiere una fecha en contexto cercano (máx. ~5 líneas) para rangos horarios sueltos
- El año se resuelve automáticamente según `planning_start` / `planning_end` del grupo
- Fechas fuera del rango de planificación generan un issue `out_of_range`

## Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Build

```bash
npm run build
```

