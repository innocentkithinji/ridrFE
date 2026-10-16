# `@ridr/web` comes from the sibling `../Ridr` checkout

The app depends on the generated client as `file:../Ridr/sdk/web`, so it always matches the backend's protos with no publish step. The cost is that every build, local or CI, needs the backend repo checked out beside this one and `sdk/web` built first. Cloudflare's git-connected builder clones only this repo, so deploys run from GitHub Actions (both repos checked out side by side, then `wrangler deploy`) instead.

## Considered Options

- **Publish `@ridr/web` to GitHub Packages and pin a version**: the move once the API stabilises or a second consumer appears; more setup now.
- **Commit a built copy of the SDK here**: rejected; it drifts from the backend silently.
