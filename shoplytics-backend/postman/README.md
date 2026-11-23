# Postman

1. Import `Shoplytics.postman_collection.json` and `Shoplytics.local.postman_environment.json`; select the *Shoplytics - Local* environment.
2. Start the API, run `npm run seed`.
3. Run **Auth & Profile → 1. Login as seeded users** first (stores a token per role).
4. Run **Businesses → List my businesses** (stores `businessId`), then **Products/Customers/Orders → List** (store ids used by other requests).
5. **RBAC checks** asserts 403 / 404 / 401 behaviour per role.

Note: "Logout" / "Logout everywhere" in the Auth folder revoke the owner's session; re-run the login folder afterwards.
