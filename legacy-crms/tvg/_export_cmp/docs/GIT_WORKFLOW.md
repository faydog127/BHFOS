# Git Workflow Strategy

This project adheres to a strict **Gitflow-inspired** branching strategy to maintain stability while allowing for parallel feature development.

## 1. Branching Model

### **Main Branches**
*   **`main`**: 
    *   **Role**: Production-ready code.
    *   **Protection**: Locked. No direct commits. Pull Requests (PRs) only.
    *   **Tags**: Semantic version tags (e.g., `v2.5.0`) mark releases here.
*   **`develop`**: 
    *   **Role**: Integration branch for the next release.
    *   **Protection**: Protected. Code must pass CI/CD checks before merging.

### **Supporting Branches**
*   **Feature Branches** (`feature/feature-name`):
    *   **Source**: `develop`
    *   **Merge Target**: `develop`
    *   **Naming**: `feature/call-console-v2`, `feature/stripe-integration`
    *   **Lifecycle**: Created for specific tasks, deleted after merge.
*   **Hotfix Branches** (`hotfix/issue-description`):
    *   **Source**: `main` (from the latest stable tag)
    *   **Merge Target**: `main` AND `develop`
    *   **Naming**: `hotfix/login-crash`, `hotfix/invoice-calc-error`
    *   **Use Case**: Critical production bugs only.
*   **Release Branches** (`release/vX.X.X`):
    *   **Source**: `develop`
    *   **Merge Target**: `main` and `develop`
    *   **Role**: Final hardening, version bumping, and documentation updates.

## 2. Commit Convention
We follow the **Conventional Commits** specification to automate changelogs.

Format: `<type>(<scope>): <subject>`

**Types:**
*   `feat`: A new feature
*   `fix`: A bug fix
*   `docs`: Documentation only changes
*   `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
*   `refactor`: A code change that neither fixes a bug nor adds a feature
*   `perf`: A code change that improves performance
*   `test`: Adding missing tests or correcting existing tests
*   `chore`: Changes to the build process or auxiliary tools

**Examples:**
*   `feat(leads): add drag-and-drop kanban support`
*   `fix(auth): resolve session timeout on mobile`
*   `docs(audit): update codebase inventory`

## 3. Pull Request (PR) Process
1.  **Create PR**: Target `develop` for features, `main` for hotfixes.
2.  **Template**: Fill out the PR template (Summary, Changes, Testing Instructions).
3.  **Review**: Requires at least 1 approval from a Senior Developer.
4.  **Checks**: All automated tests (unit, lint, build) must pass.
5.  **Merge**: Squash and Merge is preferred to keep history clean.

## 4. CI/CD Pipeline (Overview)
*   **On PR Open**: Run Linter (`npm run lint`), Unit Tests (`npm run test`), and Build Check (`npm run build`).
*   **On Merge to `develop`**: Deploy to **Staging** environment.
*   **On Tag**: Deploy to **Production** environment.