# BHFOS Network OS — Experience & Design System Definition

| Field | Value |
| --- | --- |
| Status | Draft — founder ratification required |
| Version | 0.1 |
| Date | 2026-08-22 |
| Product | Network OS |
| Owner | Founder |
| Design authority | Controlled product artifact |
| Implementation authority | None — experience/design direction only |

## 1. Purpose

Define the governing visual and interaction system for Network OS before implementation begins.

Network OS must feel premium from its first usable release. The design system is therefore a release gate, not a post-build styling pass.

This artifact governs product appearance, interaction language, layout, density, component behavior, responsive behavior, status/exception treatment, and visual quality standards.

## 2. Design authority rule

> **No designer, developer, AI agent, contractor, or implementation team may introduce ad hoc stylistic changes outside the approved Network OS design system. Material stylistic changes require controlled design approval and an update to this governing artifact before implementation.**

Implementation may solve technical details inside the approved system, but may not invent new visual patterns merely for convenience.

## 3. Product character

Network OS should feel like a premium managed-services operating console.

Desired characteristics:

- calm;
- precise;
- premium;
- authoritative;
- operational;
- modern without looking trendy;
- information-dense where useful without feeling crowded;
- understated rather than flashy;
- trustworthy under pressure;
- clearly designed for professional operators rather than generic SaaS buyers.

Network OS should not resemble a generic CRM template.

## 4. Anti-patterns

Avoid:

- oversized white cards everywhere;
- random rounded containers without hierarchy;
- default shadcn styling used without adaptation;
- bright blue primary actions on every screen;
- excessive gradients;
- decorative glassmorphism;
- dashboard tile walls with weak information value;
- inconsistent spacing;
- excessive icon use;
- colored status pills for every field;
- desktop layouts simply squeezed onto mobile;
- arbitrary shadows, borders, radii, font sizes, or colors;
- noisy animation;
- large empty hero areas inside operational screens;
- generic "admin template" aesthetics.

## 5. Visual principles

### 5.1 Hierarchy before decoration

Every screen should make the next important action and current operating state obvious without relying on ornamental effects.

### 5.2 Restraint communicates quality

Use fewer visual devices, used consistently. Premium should come from proportion, spacing, typography, alignment, interaction detail, and material consistency.

### 5.3 Data deserves structure

Tables, queues, timelines, details, and operational summaries should be first-class components rather than afterthoughts wrapped in cards.

### 5.4 Exceptions deserve emphasis

Normal work should feel calm. Exceptions, overdue items, risks, and blocked states should stand out immediately without making the whole product visually alarming.

### 5.5 Mobile is purpose-built

Mobile workflows should be designed around the task being performed, not around parity with desktop navigation.

### 5.6 One product language

Page shells, panels, filters, actions, typography, form behavior, status language, and responsive patterns must feel intentionally related across Network OS.

## 6. Product-family relationship

Network OS and Partner OS should eventually be visually recognizable as members of the same BHFOS product family while preserving different operational personalities.

Network OS should feel more like:

- command center;
- network operations;
- relationship intelligence;
- risk/exception control;
- portfolio management.

Partner OS may later lean more heavily into field execution and service-company operations.

Shared family assets may include typography, base tokens, iconography, interaction quality, and certain platform components, but Network OS layouts and workflows should remain independently optimized.

## 7. Layout system

### Desktop

Use a stable application frame with:

- primary navigation;
- contextual page title/header;
- optional secondary/context navigation;
- primary content area;
- restrained right-side contextual panels only when they materially improve the task.

Operational pages should favor full-width useful content over excessive centered-card layouts.

### Content width

- Dense operational views may use most available viewport width.
- Detail/edit forms should use readable constrained widths where appropriate.
- Related information should align to a consistent grid.

### Spacing

Use a governed spacing scale. Avoid one-off pixel values except for exceptional technical alignment.

Recommended base rhythm should derive from a small consistent unit such as 4px or 8px and produce a limited spacing scale.

## 8. Typography

Typography must communicate premium restraint and strong information hierarchy.

Requirements:

- one primary UI sans family unless separately approved;
- a deliberate display/heading strategy without decorative headline fonts;
- excellent numeric/tabular legibility;
- consistent text roles rather than arbitrary font sizes;
- restrained use of bold weight;
- clear distinction among page title, section title, label, body, metadata, table content, status, and helper/error text;
- avoid oversized headings in operational screens.

Exact font family and type scale require founder/design approval before coding.

## 9. Color system

Color must be role-based, not decorative.

Required semantic roles:

- application background;
- elevated/surface background;
- primary text;
- secondary/muted text;
- structural border/divider;
- primary action;
- neutral/informational status;
- positive/success;
- caution/warning;
- critical/error;
- selected/focus state;
- disabled state.

The palette should remain restrained. Most screens should be visually neutral, allowing exceptions and meaningful actions to carry the color.

Exact palette values require approval before implementation.

## 10. Surface system

Do not treat every content group as a floating card.

Use three primary surface concepts:

1. **Page plane** — the main working surface.
2. **Structured section/panel** — separates materially distinct context or actions.
3. **Elevated temporary surface** — dialog, popover, menu, command palette, or transient contextual surface.

Borders, shadows, and elevation must follow tokens and should communicate hierarchy rather than decoration.

## 11. Radius and shape language

Use a restrained radius scale with a small number of approved values.

Avoid extreme pill-shaped UI except where the element is genuinely a compact status/tag/control.

Buttons, inputs, cards/panels, tables, dialogs, and chips should share a coherent shape language.

## 12. Navigation model

Primary navigation should reflect Network OS mental models rather than inherited CRM module names.

Initial conceptual navigation should trend toward:

- Home / Attention;
- Customers;
- Service Needs;
- Service Partners;
- Work / Coordination;
- Exceptions;
- Reporting;
- Administration / Settings where authorized.

Slice 1 should expose only active/relevant areas rather than empty future modules.

Navigation labels must use approved Network OS jargon consistently.

## 13. Home / attention experience

The home screen should not be a generic KPI dashboard.

Its first responsibility is to answer:

- What requires my attention?
- What changed?
- What is at risk?
- What should I do next?

Slice 1 home may include:

- follow-ups due;
- recent/new Service Needs;
- relationship activity requiring attention;
- incomplete records/errors;
- simple demand counts/trends only when supported by real data.

Later Network OS versions may add six-dimension scorecards.

## 14. Tables and queues

Tables and queues are core Network OS interaction surfaces.

Requirements:

- deliberate column hierarchy;
- strong row scanning;
- stable alignment;
- sortable/filterable fields only where useful;
- predictable row actions;
- compact but readable density;
- sticky headers where long lists justify them;
- clear selected/hover/focus states;
- mobile alternatives rather than broken horizontal tables;
- no excessive borders/gridlines;
- status and exception information integrated without visual noise.

## 15. Detail pages

Detail pages should provide a clear hierarchy:

1. identity/context;
2. key operational state;
3. next actions;
4. primary record information;
5. related activity/history;
6. secondary/reference information.

Avoid turning detail pages into a stack of unrelated cards.

## 16. Forms

Forms must prioritize speed and clarity.

Rules:

- group fields by user task/context;
- use progressive disclosure for secondary/rare data;
- preserve entered work on recoverable errors;
- use clear labels, not placeholder-only fields;
- avoid overusing required fields;
- use structured selections where reporting/matching depends on the value;
- use free text where structured data would create unnecessary burden;
- display validation near the field and summarize blocking issues when appropriate.

## 17. Status language

Status is operational information, not decoration.

Use:

- concise approved labels;
- a restrained status indicator system;
- color only when it adds meaning;
- text/icon combinations where color alone would be insufficient;
- consistent semantics across list/detail/history views.

Normal states should not compete visually with exceptions.

## 18. Exception language

Exceptions need a stronger visual system than normal statuses.

An exception component should communicate:

- what is wrong;
- severity/priority;
- who owns it;
- how long it has existed / due time where applicable;
- next available action;
- resolution state.

Critical exceptions may use stronger color and visual emphasis, but persistent full-screen alarm styling should be avoided unless the situation genuinely warrants it.

## 19. Timeline and activity history

Network OS should use a standardized activity/timeline treatment for relationship history, Service Need changes, and later coordination events.

Timeline rules:

- newest/oldest ordering must be consistent by context;
- actor and time are always visible;
- event type is visually scannable;
- detailed payload is secondary and expandable where useful;
- operational events and user-entered notes are distinguishable;
- sensitive details are only shown to authorized users.

## 20. Search and command behavior

Search should be treated as a primary productivity tool.

Slice 1 should anticipate:

- global lookup of customer organizations/properties/contacts/Service Needs;
- contextual list search/filter;
- keyboard-friendly navigation on desktop where practical.

A future command palette may be introduced if it genuinely improves high-frequency operator workflows.

## 21. Mobile principles

Mobile workflows should be task-oriented.

For Slice 1, the priority mobile task is property visit capture.

Requirements:

- one-handed friendly layout where practical;
- large reliable touch targets;
- minimal typing;
- context preserved after selecting property/contact;
- fast optional photo capture;
- direct create-follow-up and create-Service-Need actions;
- no unnecessary desktop side navigation;
- no tiny table layouts;
- clear save/success state;
- basic visit target: approximately one minute.

## 22. Loading, empty, error, and success states

These states are part of the premium experience and require standard patterns.

### Loading

Use stable skeleton/placeholder behavior where it reduces layout shift. Avoid excessive spinners.

### Empty

Explain what the area is for and offer the correct next action. Avoid generic "No data" messages.

### Error

State what failed, what was preserved, and what the user can do next. Do not expose raw technical errors to ordinary users.

### Success

Use restrained confirmation. Avoid unnecessary celebratory animation in operational workflows.

## 23. Motion

Motion should reinforce spatial/interaction understanding, not entertain.

Use short, subtle transitions for:

- panel/dialog opening;
- list/detail state changes;
- focus/selection;
- loading completion;
- mobile task transitions.

Avoid bouncing, dramatic easing, continuous decorative animation, or slow transitions that delay operation.

## 24. Iconography

Use one coherent icon family unless separately approved.

Icons should:

- support recognition;
- not replace important text labels unnecessarily;
- use consistent stroke/weight treatment;
- avoid mixed icon families/styles on the same product surface.

## 25. Accessibility

Premium includes accessibility.

Minimum expectations:

- WCAG-appropriate contrast for text and meaningful UI states;
- keyboard/focus support for desktop workflows;
- visible focus states;
- semantic labels;
- non-color-only status/exception communication;
- appropriately sized touch targets;
- screen-reader-safe form/error labeling where technically applicable.

## 26. Performance perception

The UI should feel fast even when operations require network work.

Design should favor:

- optimistic interaction only where safe;
- immediate local acknowledgment of user actions;
- stable layouts;
- clear pending states;
- no unexplained frozen buttons;
- minimized full-page reload behavior.

## 27. Canonical Slice 1 screen contracts

Before Cursor begins production UI implementation, the following screens must have approved visual/interaction references.

### 27.1 Network OS Home / Attention

Purpose: immediate working context, not marketing dashboard.

Required regions:

- compact page identity/context;
- attention queue;
- follow-ups due;
- recent/new Service Needs;
- simple relationship/demand indicators supported by real data;
- direct actions such as New Visit / New Service Need / Find Property.

### 27.2 Customer Network Browser

Purpose: find and navigate Organization → Portfolio/Region → Property/Facility relationships.

Required behavior:

- powerful search;
- hierarchy-aware list/browse;
- clear property identity/location;
- relationship status/owner visible without clutter;
- fast access to property workspace.

### 27.3 Property / Relationship Workspace

Purpose: one place to understand and manage the BHIS relationship with a property.

Required regions:

- property identity/context;
- organization/portfolio lineage;
- key contacts;
- relationship owner/status;
- next follow-up;
- current/open Service Needs;
- recent activity/visits;
- existing vendor/customer preference notes as authorized;
- primary actions.

### 27.4 Service Need List

Purpose: operational demand queue.

Required behavior:

- status, service, property, urgency/timing, owner, next action;
- filters/search;
- visually clear needs requiring action versus deferred/completed records;
- no generic sales-pipeline styling unless that treatment is specifically justified.

### 27.5 Service Need Detail / Edit

Purpose: qualify and progress customer demand.

Required regions:

- identity/context header;
- current status and owner;
- service/scope/urgency/timing;
- customer/vendor context;
- attachments;
- recommended next action/follow-up;
- activity history;
- conversion-to-work area reserved for future active slice without exposing inactive controls prematurely.

### 27.6 Mobile Property Visit Capture

Purpose: complete an ordinary property visit record in about one minute.

Required flow:

- property context;
- person contacted;
- outcome;
- short notes;
- optional need/follow-up/photo;
- save.

Secondary fields must not block basic completion.

### 27.7 Search / Navigation Pattern

Purpose: make customer/property/Service Need navigation fast enough that users do not resort to notes or external tools because the application is cumbersome.

## 28. Design-token categories required before implementation

Exact values must be approved for:

- typography family;
- typography scale;
- font weights;
- line heights;
- spacing scale;
- layout grid/gutters;
- application/surface colors;
- semantic colors;
- border colors/widths;
- radius scale;
- shadow/elevation scale;
- icon sizes;
- control heights;
- table row densities;
- mobile touch sizes;
- motion durations/easing.

Tokens should be centralized and implementation teams should not hard-code one-off design values unless specifically approved.

## 29. Component-governance rule

Existing component libraries may be used as implementation primitives, but their default appearance is not automatically approved.

A component is Network OS-approved only when it conforms to the approved tokens, interaction rules, and canonical patterns.

Common components requiring governed variants include:

- buttons;
- inputs;
- selects/comboboxes;
- text areas;
- date/time controls;
- tables;
- badges/status indicators;
- alerts/exceptions;
- dialogs/drawers;
- menus;
- tabs/segmented controls;
- navigation;
- breadcrumbs/context trails;
- timeline/activity;
- empty/error/loading states;
- mobile bottom/action bars where used.

## 30. Visual QA gate

Every Cursor implementation slice containing UI must include visual validation evidence.

Minimum review questions:

- Does it conform to approved tokens/components?
- Does it match the canonical screen contract?
- Does it feel like Network OS rather than an inherited generic CRM?
- Are spacing, typography, alignment, density, and hierarchy consistent?
- Are status and exceptions used correctly?
- Does mobile behavior match the intended task?
- Are there any ad hoc style overrides or one-off values?
- Does the experience remain accessible and responsive?

A functionally correct screen that fails design-system conformance does not satisfy Definition of Done.

## 31. Change-control process

Material design changes require:

1. identified design problem or product need;
2. proposed change against this artifact/canonical screen;
3. founder or delegated controlled design approval;
4. update to design tokens/pattern/component documentation where applicable;
5. implementation only after the governing artifact is updated.

Bug fixes that restore conformance do not require a new design decision.

## 32. Design-system readiness status

This artifact defines the governing experience principles and screen contracts, but exact visual tokens and approved screen references still need to be produced before Release 1 / Slice 1 implementation becomes Ready.

Remaining design gates:

1. approve visual direction/mood;
2. approve typography;
3. approve palette and semantic color roles;
4. approve spacing/radius/elevation/control tokens;
5. create canonical desktop references for Home, Customer Network Browser, Property Workspace, Service Need List, Service Need Detail;
6. create canonical mobile Property Visit reference;
7. validate those references against premium quality, accessibility, and Slice 1 workflow requirements.

## 33. End-state quality bar

Network OS should be recognizable without its logo because its hierarchy, interaction behavior, typography, density, spacing, status language, and exception handling are consistent and deliberate.

Premium is not an aesthetic layer applied later. It is the quality of the operating experience itself.
