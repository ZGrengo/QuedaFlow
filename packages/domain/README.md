# @quedaflow/domain

Domain logic package for QuedaFlow. Contains pure, testable business logic for time slot computation.

## Structure

- `time.ts` - Time utilities (HH:MM conversion, overlaps, clamp)
- `blocks.ts` - Block manipulation (split midnight, apply buffer, merge)
- `compute.ts` - Slot computation and ranking
- `types.ts` - TypeScript interfaces

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

