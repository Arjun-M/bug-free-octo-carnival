# Contributing to IsoBox

First off, thanks for taking the time to contribute! IsoBox is a community-driven project and we value your input.

## How to Contribute

You can contribute in many ways:

1.  **Reporting Bugs**: If you find a bug, please create an issue with a detailed description and reproduction steps.
2.  **Suggesting Enhancements**: Have an idea? Open an issue to discuss it.
3.  **Pull Requests**: Submit PRs for bug fixes or new features.
4.  **Documentation**: Improve the documentation to help others.

## Development Setup

To get started with development:

1.  **Fork the repository** on GitHub.
2.  **Clone your fork**:
    ```bash
    git clone https://github.com/Arjun-M/Isobox.git
    cd Isobox
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```
    *Note: This requires Node.js >= 18.0.0 and a C++ compiler for `isolated-vm`.*

## Code Style

We follow strict code style guidelines to ensure consistency:

-   **TypeScript**: We use strict TypeScript configuration. Ensure no `any` types unless absolutely necessary.
-   **Linting**: Run `npm run lint` to check for linting errors. We use ESLint.
-   **Formatting**: Run `npm run format` to format your code using Prettier.
-   **Comments**: Write clear, "human-style" comments explaining the "why" and "how". Avoid verbose AI-generated comments.

## PR Process

1.  **Create a Branch**: `git checkout -b feature/my-feature`
2.  **Commit Changes**: Make focused commits with descriptive messages.
3.  **Test**: Ensure all tests pass (`npm test`).
4.  **Push**: `git push origin feature/my-feature`
5.  **Open PR**: Submit a Pull Request against the `main` branch.
6.  **Review**: Address any feedback from reviewers.

## Testing Requirements

We maintain high test coverage and strict testing standards:

-   **Unit Tests**: Write unit tests for all new functions and classes.
-   **Coverage**: Aim for >85% code coverage.
-   **Integration Tests**: Add integration tests for complex interactions.
-   **Running Tests**:
    ```bash
    npm test          # Run all tests
    npm run test:coverage # Run with coverage report
    ```
-   **Snapshot Testing**: If you change output formats, update snapshots.

## Release Process

(For maintainers)

1.  Update version in `package.json`.
2.  Update `CHANGELOG.md`.
3.  Run build and tests.
4.  Create a release tag.
5.  Publish to npm.

---

By contributing, you agree that your contributions will be licensed under the MIT License.
