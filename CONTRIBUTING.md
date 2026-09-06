# Contributing to Filadex

First off, thank you for considering contributing to Filadex! It's people like you that make Filadex such a great tool for the 3D printing community.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please take a moment to read it before proceeding.

## How Can I Contribute?

### Contributing Translations

Filadex aims to be accessible to users worldwide. We welcome translations to make the application available in multiple languages.

**Before Contributing Translations:**

* Check the existing translations in `client/src/i18n/locales/` to see if your language is already supported
* Review our [Translation Guide](docs/TRANSLATION_GUIDE.md) for detailed instructions
* Consult the [Translation Glossary](docs/TRANSLATION_GLOSSARY.md) for terminology consistency
* For technical details, see the [Technical Translation Guide](docs/TRANSLATION_TECHNICAL.md)

**How to Contribute Translations:**

1. Fork the repository
2. Create a new branch for your translation work
3. Add or update the translation files following the guidelines
4. Test your translations by running the application locally
5. Submit a pull request with your changes

### Reporting Bugs

This section guides you through submitting a bug report for Filadex. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

**Before Submitting A Bug Report:**

* Check the [issues](https://github.com/the-luap/filadex/issues) to see if the problem has already been reported. If it has and the issue is still open, add a comment to the existing issue instead of opening a new one.
* Determine which repository the problem should be reported in.

**How Do I Submit A (Good) Bug Report?**

Bugs are tracked as [GitHub issues](https://github.com/the-luap/filadex/issues). Create an issue and provide the following information:

* Use a clear and descriptive title for the issue to identify the problem.
* Describe the exact steps which reproduce the problem in as many details as possible.
* Provide specific examples to demonstrate the steps.
* Describe the behavior you observed after following the steps and point out what exactly is the problem with that behavior.
* Explain which behavior you expected to see instead and why.
* Include screenshots or animated GIFs which show you following the described steps and clearly demonstrate the problem.
* If the problem is related to performance or memory, include a CPU profile capture with your report.
* If the problem wasn't triggered by a specific action, describe what you were doing before the problem happened.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Filadex, including completely new features and minor improvements to existing functionality.

**Before Submitting An Enhancement Suggestion:**

* Check if the enhancement has already been suggested.
* Determine which repository the enhancement should be suggested in.

**How Do I Submit A (Good) Enhancement Suggestion?**

Enhancement suggestions are tracked as [GitHub issues](https://github.com/the-luap/filadex/issues). Create an issue and provide the following information:

* Use a clear and descriptive title for the issue to identify the suggestion.
* Provide a step-by-step description of the suggested enhancement in as many details as possible.
* Provide specific examples to demonstrate the steps or point out the part of Filadex where the suggestion is related to.
* Describe the current behavior and explain which behavior you expected to see instead and why.
* Include screenshots or animated GIFs which help you demonstrate the steps or point out the part of Filadex which the suggestion is related to.
* Explain why this enhancement would be useful to most Filadex users.
* List some other applications where this enhancement exists, if applicable.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Include screenshots and animated GIFs in your pull request whenever possible
* Follow the TypeScript and Documentation styleguides below
* Include adequate tests — `npm test` runs against both database engines, and
  `npm run test:e2e` covers browser-only behaviour
* Document new code based on the Documentation Styleguide
* End all files with a newline, with one deliberate exception: the generated
  files under `migrations/pg/` are written and identified by `drizzle-kit`, and
  a trailing newline changes the hash `scripts/migrate.pg.ts` records when it
  baselines an existing installation. See `docs/adr/0001` before touching them.

## Styleguides

### Git Commit Messages

This section describes what the repository already does, so that following it
and following the history give the same answer.

**Subject line**

* Limit it to 72 characters, and say what changed rather than which files moved.
* The imperative mood is the norm — "Add a browser test harness", "Drop
  DEFAULT_ADMIN_PASSWORD, which nothing reads", "Stop shipping a working
  database password".
* A declarative subject naming the resulting behaviour is also used and is
  equally welcome — "An unparseable density does not clear the stored one",
  "Ownership reads the role, not the is_admin mirror". Both forms appear
  throughout the log; neither is a defect, and reviewers should not ask for one
  to be rewritten as the other.
* No emoji prefix. Nothing in the history uses one.

**Body**

This is the part that matters most here, and it is the project's most consistent
habit: nearly every non-trivial commit carries one.

* Explain **why**, not what — the diff already says what. A reader coming back
  in six months needs the reasoning, the alternative that was rejected, and the
  constraint that forced the shape.
* Where a claim is checkable, say how it was checked. Commits that fix a bug
  routinely quote the failing output, the command that reproduces it, or the
  test that fails without the change.
* Wrap at 72 characters.
* Reference issues and pull requests liberally after the first line.

A commit that only reformats or renames can be a single line. One that changes
behaviour should not be.

### TypeScript Styleguide

The codebase is TypeScript, and TypeScript is what checks it: `npm run check`
(Postgres) and `npm run check:sqlite` (SQLite) must both pass, and CI runs both.
There is no ESLint or Prettier configuration in the repository — an earlier
version of this file claimed there was.

* Prefer the object spread operator (`{...anotherObj}`) to `Object.assign()`
* Inline `export`s with expressions whenever possible
  ```js
  // Use this:
  export const foo = 'bar';

  // Instead of:
  const foo = 'bar';
  export { foo };
  ```
* Place imports in the following order:
  * External packages
  * Internal modules
  * Local modules

### Documentation Styleguide

* Use [Markdown](https://daringfireball.net/projects/markdown/) for documentation.
* Reference code as a path, optionally with a line — `server/storage.ts:171` —
  which is what the existing docs and ADRs do and what a reader can click.
* A decision that shapes the codebase belongs in `docs/adr/`, next to the four
  already there, rather than only in a pull request description.

## Additional Notes

### Issue and Pull Request Labels

This section lists the labels we use to help us track and manage issues and pull requests.

* `bug` - Issues that are bugs
* `documentation` - Issues or PRs related to documentation
* `duplicate` - Issues that are duplicates of other issues
* `enhancement` - Issues that are feature requests
* `good first issue` - Good for newcomers
* `help wanted` - Extra attention is needed
* `invalid` - Issues that are invalid or non-reproducible
* `question` - Issues that are questions
* `wontfix` - Issues that will not be fixed
* `translation` - Issues or PRs related to translations

Thank you for contributing to Filadex!
