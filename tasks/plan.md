# Implementation plan

1. Define catalogue transformations and workflow invariants with failing tests.
   - Verify: tests fail because the new modules and workflow do not exist.
2. Implement the catalogue UI and build pipeline.
   - Verify: unit and build tests pass; archive validation still passes.
3. Add the `dev` deployment workflow.
   - Verify: static checks cover trigger, permissions, quality gates, `main` publication, and Pages.
4. Run responsive browser QA against the production build.
   - Verify: interactions, layout, accessibility basics, and console output pass at target widths.
5. Commit `dev`, then reproduce `dist/` as a static-only `main` commit.
   - Verify: both branches are clean and `main` contains no source files.
