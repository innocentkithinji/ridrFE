# The web app is a static SPA that talks to Ridr directly

The web app is a single-page application served as static files; the browser calls the Ridr API itself (Connect RPC, and SSE for Live queries) with a fresh Clerk token on every call. We have no backend-for-frontend: Ridr already sends CORS headers, checks Clerk tokens and enforces Roles and Scopes, so a middle layer would only add a server to run. Anything that must persist across devices (such as Unit preferences) is asked of the Ridr backend rather than added to a server of our own.

## Considered Options

- **Backend-for-frontend (Node/Next server)**: rejected; it duplicates Ridr's auth and permission checks and stops the app from deploying as static assets.
