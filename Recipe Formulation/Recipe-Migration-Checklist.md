# Recipe Migration Checklist

Use this when recipe code is present.

## Preflight
- [ ] `recipe-generator` route exists
- [ ] `recipe-formulator` route exists
- [ ] components/hook/services located

## Consolidation
- [ ] `/recipe-generator` redirects to `/recipe-formulator`
- [ ] query params preserved across redirect
- [ ] canonical recipe model established
- [ ] legacy adapter implemented

## Validation
- [ ] legacy recipe import works
- [ ] validation issues render correctly
- [ ] selected derivative download works
- [ ] type checks pass

## Cleanup
- [ ] stale generator-only code removed
- [ ] docs updated
- [ ] route map updated