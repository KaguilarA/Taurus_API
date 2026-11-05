# Project rules

1. **Performance first, with correctness and security preserved.** Measure critical endpoints before and after changes. Run independent reads concurrently outside transactions, project only needed fields, use lean reads and query-aligned indexes, bound lists and payloads, and avoid repeated work. Never parallelize operations on the same transaction session, cache private data across users, or sacrifice inventory/payment consistency for speed. Keep regression checks for permissions and concurrent operations.

- Do more with less: reuse existing entities, controllers and domain operations across features. Split responsibilities when useful; do not duplicate business logic.

- The backend must use the existing `models/`, `routes/`, `controllers/`, `api/` and `middlewares/` structure. Extend existing entities and controllers; never introduce a parallel application or duplicate model registry.
- Use `owl-expressjs-utils` for model construction, hashing, CRUD controllers, sessions, authentication, rate limits, CORS and database connections whenever supported. Do not implement substitutes for features provided by OWL.
- ALL model and database access must use `owl-expressjs-utils`. No direct Mongoose imports, dependency, native model handles, document saves or local wrappers are allowed in this backend. If OWL lacks an operation, extend the OWL library itself and consume its public API.
- New models are allowed only for genuinely new domain entities with no existing equivalent. Register them once in `models/models.js` using `OwlModel`.
- Preserve stored users, password hashes, sessions, products, inventory, orders, payments and business settings. Migrations must be idempotent, refuse conflicts and never delete source data.
- All credentials and external service configuration belong in environment variables. Never commit secrets or expose them to the frontend or logs.
