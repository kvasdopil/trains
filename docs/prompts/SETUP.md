# When setting up the project for the 1st time

- This repository was bootstrapped locally; it has no remote yet.
- Create a new repo in GitHub, ASK the user for the repo name if not provided, then add it as `origin`.
- Deployment target is Vercel as a static Vite site (see the README's "Deploy to Vercel" and `memory/spec/operations/deploy.md`). Run `vercel link` from the project root to create the Vercel project, then connect the GitHub repo for automatic deploys. ASK the user before the first production deploy.
