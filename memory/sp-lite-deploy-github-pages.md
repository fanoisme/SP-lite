---
name: sp-lite-deploy-github-pages
description: SP-lite deploys to GitHub Pages via GitHub Actions — there's a rebuild delay after every push
metadata:
  type: project
---

SP-lite (C:\Users\22002420\Desktop\Allo\VIBE\SP-lite) is a static Vue site deployed to GitHub Pages at https://fanoisme.github.io/SP-lite/. Pushing `main` triggers a GitHub Actions workflow (.github/) that rebuilds and redeploys.

**Why:** After pushing a fix, the live site still serves the OLD build for ~1-2 min until the Action finishes. The user has tested immediately after push twice and reported the fix "didn't work" — it was the stale build, not the code.

**How to apply:** When the user reports a frontend fix isn't working right after a push, first ask/check whether the GitHub Action has finished deploying before debugging deeper. Verify via the Actions tab or by hard-refreshing (cache) once the build is green.

Related: [[sp-lite-auth-nav-timing]]
