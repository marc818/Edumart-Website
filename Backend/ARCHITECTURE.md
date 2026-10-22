# EduMart Backend Architecture

This folder contains add-only architecture modules for the student marketplace.

- `database/schema.sql`: students, admins, listings, orders, and audit logs.
- `modules/authorization.js`: authenticated-user and administrator guards.
- `modules/verification-service.js`: student verification statuses and approval rules.
- `modules/listing-service.js`: verified-seller and approved-listing rules.

The existing server is intentionally not modified by these files. Register the modules in `Backend/server.js` when the application is ready to activate the API routes. Until then, the current application behavior remains unchanged.
