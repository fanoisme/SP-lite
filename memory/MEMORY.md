# Project Memory

- [SP-lite deploys via GitHub Pages + Actions](sp-lite-deploy-github-pages.md) — stale build for ~1-2 min after push; check Action status before assuming a fix failed.
- [SP-lite auth nav timing](sp-lite-auth-nav-timing.md) — router guard reads session synchronously; auth state must update before router.push, not in onAuthStateChange.
- [SP-lite profile self-heal](sp-lite-profile-self-heal.md) — on_auth_user_created trigger is unreliable; ensure_profile() RPC is the fallback.
