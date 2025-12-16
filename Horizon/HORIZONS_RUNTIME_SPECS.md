# Horizons Runtime & Environment Specifications

## 1. Resource & Runtime Limits
This environment operates within a strictly defined sandbox designed for React-based frontend development.

*   **Runtimes:** The environment is strictly **Node.js v20**.
*   **Languages:** strictly JavaScript/JSX for logic, CSS/Tailwind for styling, and HTML.
    *   *Constraint:* No other server-side languages (Python, PHP, Go, Rust, Java) are supported. Attempting to use them will result in environment failure.
*   **Memory & CPU:**
    *   Exact `max_cpu_seconds` and `max_memory_mb` are platform-managed and dynamic.
    *   *Observation:* The environment is capable of running `npm install` and `vite build` processes for typical mid-sized React applications.
*   **Process Management:**
    *   No access to background daemons, systemd, or cron jobs.
    *   The environment automatically executes `npm install`, `npm run dev`, and `npm run build`.
    *   Linting is enforced via `eslint-config-react-app`.

## 2. Model / Context Limits
*   **Context Window:** Dynamic.
    *   *Constraint:* Large files (typically >400-500 lines) are subject to truncation in the input context (marked by `<large_files_section>`).
    *   *Implication:* When modifying large files, the AI must rely on the `codebase` snapshot provided or request the user to provide specific sections if truncation occurs.
*   **Token Output:** Finite budget per response.
    *   *Constraint:* Extremely large refactors spanning dozens of files in a single prompt may hit output token limits. It is best to break large architectural changes into smaller, component-focused tasks.
*   **Knowledge Cutoff:** The model's internal knowledge is static. It cannot browse the live web for documentation updates released after its training data.

## 3. File System & Repo Handling
*   **Access:** Read/Write access to the `/src` and root directories.
*   **Write Mechanism:** **Atomic Overwrite ONLY**.
    *   *Hard Limit:* The AI *cannot* apply diffs or patches. It must rewrite the *entire* file content to make a change.
    *   *Hard Limit:* The AI *cannot* delete files. File deletion requires manual user intervention.
*   **Read-Only Files:** Certain configuration files (e.g., `vite.config.js`, potentially others listed in `<read_only_file_list>`) are immutable to the AI.
*   **Image Handling:** No programmatic image generation. New images must be requested via `<img-replace>` tags, which the system resolves to Unsplash URLs.

## 4. Network / External Access
*   **Model Network Access:** **None**. The AI model itself cannot make HTTP requests to the outside world (e.g., cannot query Google, StackOverflow, or external APIs during generation).
*   **Runtime Network Access:** **Allowed**.
    *   The *generated code* (running in the user's browser/preview) can make `fetch`/`axios` requests to allowed endpoints (Supabase, public APIs).
    *   `npm install` has access to public registries.

## 5. Tooling & Integrations
*   **Built-in Tools:**
    *   `Vite`: Build tool and dev server.
    *   `TailwindCSS`: Styling engine.
    *   `Lucide React`: Iconography.
    *   `Shadcn/UI`: Component library (headless).
    *   `Supabase`: Backend-as-a-Service (Auth, Database, Storage, Edge Functions).
*   **Limitations:**
    *   No local databases (SQLite, MongoDB local) allowed.
    *   No backend server creation (Express, NestJS) allowed. All backend logic must be offloaded to Supabase Edge Functions or third-party APIs.

## 6. Security & Isolation
*   **Secrets Management:**
    *   Secrets must be handled via the `supabase-secrets` action type.
    *   Secrets are injected into the environment; they should never be hardcoded in the source code.
*   **Persistence:**
    *   Code changes are persistent.
    *   Runtime state (browser session, local storage) is ephemeral to the user's session.

## 7. Behavior Guarantees
*   **Determinism:** Non-deterministic. Re-running the same prompt may result in slightly different code implementations or commentary.
*   **CI/CD:** The system automatically runs ESLint. Code that fails linting is flagged in the logs.

## 8. DevOps-Friendly Summary (JSON)