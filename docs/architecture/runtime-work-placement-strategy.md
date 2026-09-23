# Runtime Work Placement Strategy

## Purpose

This document defines a general strategy for deciding **where
computational work should happen** in the application.

The three primary execution locations are:

1.  **Offline / build-time processing**
2.  **Web Workers**
3.  **The browser main thread**

The goal is to preserve a responsive interactive experience while
avoiding unnecessary runtime computation and architectural complexity.

The guiding principle is:

> **Do work as early and as far away from the main thread as practical,
> while keeping interaction-critical work close to the UI.**

This is a decision framework, not a rule that every expensive-looking
operation must use a worker.

------------------------------------------------------------------------

## 1. The hierarchy

When introducing a computation or data transformation, consider the
execution locations in this order:

``` text
Can it be computed ahead of time?
            │
       yes  │  no
            ▼
         OFFLINE
                 Can it run independently
                 from the DOM/UI?
                         │
                    yes  │  no
                         ▼
                     WEB WORKER
                              │
                              ▼
                         MAIN THREAD
```

In practice:

``` text
OFFLINE / BUILD TIME
        │
        │ precomputed assets
        ▼
WEB WORKERS
        │
        │ prepared runtime results
        ▼
MAIN THREAD
        │
        ▼
INTERACTIVE EXPERIENCE
```

Prefer the highest applicable layer.

------------------------------------------------------------------------

## 2. Offline / build-time processing

### What it is

Offline processing means performing work **before the user runs the
application**.

The result is stored as a generated asset or other prepared
representation that the browser can load directly.

Examples include:

-   analysis of static source data;
-   extraction of metadata;
-   generation of indexes;
-   normalization and transformation of assets;
-   precomputed lookup tables;
-   static geometry;
-   derived timing data;
-   deterministic mappings.

### When to prefer it

Offline processing is generally the best option when:

-   the input is known ahead of time;
-   the output is deterministic;
-   every user would otherwise repeat the same calculation;
-   the result can reasonably be stored and distributed;
-   runtime user state is not required to produce it.

If a calculation would produce the same answer for every user on every
page load, ask why the browser is calculating it at all.

### Benefits

Offline processing:

-   consumes no runtime CPU for the computation itself;
-   cannot block the browser UI;
-   reduces work on lower-powered devices;
-   makes runtime behavior more predictable;
-   can simplify client-side code;
-   allows expensive tooling that would be inappropriate to ship to the
    browser.

### Costs

Precomputation can:

-   increase generated asset size;
-   require an asset-generation pipeline;
-   introduce cache/versioning concerns;
-   duplicate data in derived representations;
-   be unsuitable when the result depends on runtime state.

### General rule

> **Static problem + deterministic answer = strong offline candidate.**

------------------------------------------------------------------------

## 3. Web Workers

### What they are

A Web Worker runs JavaScript on a thread separate from the browser's
main UI thread.

The worker and main thread communicate asynchronously by sending
messages.

Conceptually:

``` text
MAIN THREAD                         WORKER

request ─────────────────────────► compute
                                    compute
UI continues                        compute
responding                           │
                                    │
result  ◄───────────────────────────┘
```

The important benefit is usually not that the computation becomes
intrinsically faster.

The benefit is that the computation can happen **without monopolizing
the main thread**.

### When to prefer a worker

Workers are strong candidates when work:

-   must happen at runtime;
-   is CPU-intensive;
-   may take tens or hundreds of milliseconds;
-   can be performed independently from the DOM;
-   can accept explicit inputs and return explicit outputs;
-   would otherwise produce long main-thread tasks;
-   does not need synchronous access to UI state.

Examples can include:

-   parsing;
-   layout calculations;
-   geometry generation;
-   indexing;
-   searching large local datasets;
-   data transformations;
-   simulation;
-   computational analysis.

### Workers are not UI environments

Workers do not normally manipulate the DOM directly.

They should therefore be treated as computational services:

``` text
input
  │
  ▼
WORKER
  │
  ├── parse
  ├── calculate
  ├── transform
  └── prepare
  │
  ▼
result
```

The main thread remains responsible for presenting that result.

### Costs

Workers introduce overhead and complexity:

-   message passing;
-   serialization or transfer of data;
-   asynchronous control flow;
-   worker lifecycle management;
-   error handling;
-   stale-result handling;
-   cancellation or invalidation;
-   additional debugging complexity.

For small calculations, these costs can exceed the benefit.

### General rule

> **Runtime CPU work that does not need the UI is a worker candidate
> when profiling shows it threatens responsiveness.**

------------------------------------------------------------------------

## 4. Main thread

### What it is

The browser main thread is where most application JavaScript and UI work
normally happens.

It is also a scarce resource.

The main thread is involved in work such as:

-   DOM interaction;
-   React rendering and updates;
-   user input;
-   animation coordination;
-   browser layout;
-   painting;
-   many rendering APIs;
-   presentation of application state.

When JavaScript occupies the main thread for too long, the browser has
fewer opportunities to respond to input or produce frames.

### Frame budget

At a 60 Hz refresh rate, a new frame is available roughly every:

``` text
1000 ms / 60 ≈ 16.7 ms
```

Not all of that budget belongs to application JavaScript. The browser
also needs time for layout, paint, compositing, and other work.

A long synchronous task can therefore cause:

-   dropped frames;
-   delayed pointer/touch response;
-   animation stutter;
-   delayed UI updates;
-   a general feeling of "chunkiness."

### What belongs here

The main thread should primarily contain work that:

-   directly interacts with the DOM or UI;
-   coordinates user interaction;
-   drives visual presentation;
-   must happen with very low latency;
-   is computationally cheap;
-   cannot reasonably be moved elsewhere.

### General rule

> **The main thread should run the experience, not perform avoidable
> heavy computation.**

------------------------------------------------------------------------

## 5. Latency versus responsiveness

These are separate concerns.

Consider a computation that takes 300 ms.

### On the main thread

``` text
request
   │
   ▼
████████████ 300 ms ████████████
   │
   ▼
result
```

The result arrives after 300 ms, but the UI may also be blocked during
that period.

### In a worker

``` text
MAIN THREAD                  WORKER

request ───────────────────► ███████
UI remains responsive        ███████ 300 ms
animations continue          ███████
input continues                 │
                                │
result ◄────────────────────────┘
```

The result may still take 300 ms.

But the application remains responsive while it is being prepared.

This leads to an important principle:

> **A slower asynchronous result can provide a better experience than a
> faster result that blocks interaction.**

Optimize both latency and responsiveness, but do not confuse them.

------------------------------------------------------------------------

## 6. Keep continuous and expensive work separate

Interactive applications often contain two very different classes of
runtime work.

### Continuous, lightweight work

Examples:

-   moving an indicator;
-   updating a transform;
-   responding to pointer movement;
-   advancing an animation;
-   reading already-prepared lookup data.

This work may happen every frame and therefore must be extremely cheap.

### Expensive, occasional work

Examples:

-   parsing a large document;
-   recalculating layout;
-   generating geometry;
-   rebuilding an index;
-   performing a complex transformation.

This work may take much longer but often does not need to happen
continuously.

The architecture should avoid coupling them.

``` text
EXPENSIVE PATH
worker
runs occasionally
prepares data
       │
       ▼
prepared result
       │
       ▼
LIGHTWEIGHT PATH
main thread
runs continuously
uses prepared data
```

A continuous animation should not require repeating expensive
computation every frame.

------------------------------------------------------------------------

## 7. Data crossing the worker boundary

Worker communication has a cost.

Avoid architectures that continuously send large objects back and forth
between threads.

Prefer:

``` text
main → worker

small explicit request
```

followed by:

``` text
worker → main

bounded prepared result
```

which the main thread can reuse for some period of time.

Where appropriate, transferable objects or other efficient browser
primitives can reduce copying costs, but these should be introduced
based on measured need.

The worker boundary should encourage clean data contracts rather than
shared implicit state.

------------------------------------------------------------------------

## 8. Concurrency and stale results

Because worker operations are asynchronous, the application may change
state before a worker finishes.

For example:

``` text
request #41
request #42
request #43

#41 completes
```

By the time `#41` returns, it may no longer be relevant.

Worker-backed features should therefore have an explicit stale-result
strategy.

A common pattern is a monotonically increasing request generation:

``` text
#41  old request
#42  newer request
#43  current request
```

When results arrive:

``` text
#41 → discard
#42 → discard
#43 → commit
```

The general rule is:

> **Only a result that is still relevant to current application state
> may affect visible state.**

Cancellation may improve efficiency where supported, but correctness
should not depend solely on successful cancellation.

------------------------------------------------------------------------

## 9. Workers are not state stores

Moving computation to a worker must not accidentally create a second
source of application truth.

Canonical application state should remain in its established owner.

The worker receives enough information to perform a calculation and
returns a result.

``` text
CANONICAL STATE
      │
      ▼
request
      │
      ▼
WORKER
      │
      ▼
derived result
      │
      ▼
presentation
```

Avoid:

``` text
main-thread state
        ↕
worker state
        ↕
UI state
```

where all three can independently diverge.

Workers should generally own **computation**, not application truth.

------------------------------------------------------------------------

## 10. Feature ownership

Prefer feature-specific workers over one application-wide "background
worker."

For example:

``` text
feature-a/
    feature-a-worker.ts

feature-b/
    feature-b-worker.ts
```

rather than:

``` text
workers/
    everything-worker.ts
```

Feature ownership provides:

-   clearer dependencies;
-   smaller message contracts;
-   easier lifecycle management;
-   better code splitting;
-   simpler testing;
-   fewer accidental cross-feature dependencies.

A worker should not become a hidden service layer connecting otherwise
independent features.

------------------------------------------------------------------------

## 11. Do not workerize by default

Workers are not inherently better than main-thread code.

Do not move work into a worker simply because:

-   it sounds architecturally cleaner;
-   another feature uses a worker;
-   the operation is asynchronous;
-   a library supports workers.

A calculation taking 1--3 ms may be much simpler and more efficient on
the main thread.

Workerization becomes more attractive as computation becomes expensive
enough to threaten the application's frame and interaction budget.

Profile first.

------------------------------------------------------------------------

## 12. Practical decision framework

When adding or profiling a workload, ask:

### Question 1: Can this be computed ahead of time?

If yes, prefer **offline processing**.

Ask:

-   Is the source static?
-   Is the result deterministic?
-   Would every client otherwise repeat the same calculation?

If yes, precompute it.

### Question 2: Must it happen at runtime?

If yes, ask whether it requires direct UI/DOM access.

If it does not, and it is computationally significant, consider a **Web
Worker**.

### Question 3: Does it need the main thread?

If the work directly drives DOM/UI presentation or is sufficiently
cheap, keep it on the **main thread**.

The resulting decision tree is:

``` text
                    WORK
                     │
          ┌──────────┴──────────┐
          │                     │
    static/deterministic?       no
          │                     │
         yes                    ▼
          │              runtime computation
          ▼                     │
       OFFLINE          ┌───────┴────────┐
                        │                │
                  needs DOM/UI?          no
                        │                │
                       yes               ▼
                        │             expensive?
                        ▼                │
                  MAIN THREAD       ┌────┴────┐
                                    │         │
                                   yes        no
                                    │         │
                                    ▼         ▼
                                  WORKER   MAIN THREAD
```

------------------------------------------------------------------------

## 13. Profiling guidance

Architecture decisions should be based on observed behavior rather than
intuition alone.

Watch for:

-   long tasks;
-   dropped frames;
-   delayed input;
-   large parse times;
-   expensive layout calculations;
-   large synchronous transformations;
-   memory growth;
-   repeated calculations;
-   work triggered unnecessarily at frame frequency.

A useful heuristic:

-   **a few milliseconds:** usually fine on the main thread;
-   **tens of milliseconds:** inspect carefully, particularly if
    frequent;
-   **hundreds of milliseconds:** strong candidate for off-thread or
    offline work;
-   **repeated expensive work:** first ask whether it can be cached or
    precomputed.

These are heuristics, not hard thresholds. Device class, frequency,
concurrency with other work, and user-visible impact matter.

Test on representative physical devices, not only high-end development
hardware.

------------------------------------------------------------------------

## 14. Choosing between offline and workers

Workers should not be used to solve a problem that can be eliminated
entirely.

Prefer:

``` text
compute once during asset generation
        ↓
ship result
```

over:

``` text
every user's worker
        ↓
recompute same result
```

when both produce equivalent outcomes.

Workers are most valuable for computations whose inputs genuinely depend
on runtime conditions.

This gives the hierarchy:

``` text
ELIMINATE runtime work
        ↓
ISOLATE unavoidable heavy runtime work
        ↓
KEEP interaction-critical work lightweight
```

Or:

``` text
OFFLINE
precompute what is knowable

WORKERS
prepare what must be computed at runtime

MAIN THREAD
run the experience
```

------------------------------------------------------------------------

## 15. Architectural principles

The strategy can be summarized in a few rules.

### 1. Protect the main thread

Treat main-thread time as a limited real-time resource.

### 2. Prefer elimination over optimization

If runtime work can become build-time work, remove it from runtime
entirely.

### 3. Isolate unavoidable heavy computation

Use workers when substantial runtime CPU work can be performed
independently from the UI.

### 4. Keep frame-frequency work extremely cheap

Continuous visual updates should consume prepared data rather than
trigger expensive recomputation.

### 5. Preserve canonical state ownership

Workers calculate derived results; they do not become parallel
application stores.

### 6. Make asynchronous results safe

Worker-backed features must tolerate stale, superseded, failed, or
delayed work.

### 7. Keep worker boundaries feature-owned

Do not create a generic background thread that gradually accumulates
unrelated responsibilities.

### 8. Measure before adding complexity

Workers and preprocessing are architectural tools, not default
destinations for code.

------------------------------------------------------------------------

## Summary

The application's runtime strategy is:

> **Offline processing prepares what can be known ahead of time. Web
> Workers perform expensive computation that must happen at runtime. The
> main thread remains focused on interaction, presentation, animation,
> and coordination.**

The purpose of this strategy is not maximum parallelism. It is to keep
the interactive experience responsive while placing each workload in the
least expensive and least disruptive execution environment that fits its
requirements.
