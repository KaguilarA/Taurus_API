# Project rules

- The backend must use the existing `models/`, `routes/`, `controllers/`, `api/` and `middlewares/` structure. Extend existing entities and controllers; never introduce a parallel application or duplicate model registry.
- Use `owl-expressjs-utils` for model construction, hashing, CRUD controllers, sessions, authentication, rate limits, CORS and database connections whenever supported. Do not implement substitutes for features provided by OWL.
- Mongoose queries on OWL-created models are permitted for transactions, atomic conditional updates, aggregations, indexes and change streams that OWL CRUD helpers cannot express.
- New models are allowed only for genuinely new domain entities with no existing equivalent. Register them once in `models/models.js` using `OwlModel`.
- Preserve stored users, password hashes, sessions, products, inventory, orders, payments and business settings. Migrations must be idempotent, refuse conflicts and never delete source data.
- All credentials and external service configuration belong in environment variables. Never commit secrets or expose them to the frontend or logs.
