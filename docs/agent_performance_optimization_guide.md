# Agent Performance Optimization Guide

## High-Performance Windows Desktop Agent (TS + React)

------------------------------------------------------------------------

# Problem

Agent response is too slow for simple system queries (e.g., checking CPU
usage).\
Expected latency: \<200ms\
Actual latency: 2s--10s+

Root cause in most cases:

-   Every request goes through LLM planning
-   No intent routing
-   No caching
-   Overloaded context
-   Blocking execution pipeline

This document defines a production-grade optimization strategy.

------------------------------------------------------------------------

# Target Architecture (Optimized)

User Input ↓ Intent Router ↓ ├─ Local Fast Path (no LLM) └─ LLM Path
(complex reasoning only) ↓ Planner (if needed) ↓ Permission System ↓
Tool Execution ↓ Async Logging (non-blocking)

------------------------------------------------------------------------

# Phase 1 --- Intent Router (Critical)

## Objective

Prevent trivial system queries from going through LLM.

## Strategy

Implement rule-based intent detection:

Examples of Fast Path: - "check cpu" - "list processes" - "current
directory" - "memory usage" - "time"

These directly call SystemTool without LLM.

## Implementation Concept

-   Regex-based classifier
-   Lightweight intent parser
-   Keyword mapping

Result: Latency reduced from \~3s → \~50--200ms

------------------------------------------------------------------------

# Phase 2 --- Caching Layer

## Objective

Avoid repeated system calls.

## Strategy

Add TTL cache for system metrics:

-   CPU → 1 second TTL
-   Memory → 1 second TTL
-   Process list → 2 seconds TTL

## Implementation

-   In-memory Map cache
-   Key: query type
-   Value: result + timestamp

Expected improvement: Eliminate redundant calls under rapid querying.

------------------------------------------------------------------------

# Phase 3 --- Reduce LLM Overhead

## Problems

-   Large system prompts
-   Full conversation history every call
-   Large tool schemas
-   Blocking full completion response

## Optimizations

1.  Only send last 2--3 turns
2.  Compress system prompt
3.  Reduce tool schema size
4.  Use JSON mode
5.  Enable streaming

Expected improvement: 30--60% latency reduction.

------------------------------------------------------------------------

# Phase 4 --- Parallel Execution

## Problem

Sequential pipeline:

LLM → Wait → Execute → Log → Save

## Optimization

Parallelize non-critical operations:

-   Log asynchronously
-   Save DB async
-   Pre-fetch system data during LLM reasoning

Use Promise.all for non-critical steps.

------------------------------------------------------------------------

# Phase 5 --- Split Planner and Executor

## Problem

LLM handles everything.

## Optimization

Introduce two layers:

1.  Lightweight Planner (LLM only for planning)
2.  Local Executor (rule-based first)

Execution priority:

-   Deterministic logic
-   Then LLM fallback

------------------------------------------------------------------------

# Phase 6 --- Streaming UX

Even if backend takes 2 seconds:

-   Stream LLM tokens
-   Show spinner immediately
-   Display plan progressively

Perceived latency improves significantly.

------------------------------------------------------------------------

# Performance Checklist

Before adding new features:

-   [ ] Does this request require LLM?
-   [ ] Can this be deterministic?
-   [ ] Is there a cache opportunity?
-   [ ] Is logging blocking execution?
-   [ ] Is context trimmed?
-   [ ] Are tool schemas minimal?

------------------------------------------------------------------------

# Recommended Immediate Actions

If only 3 optimizations are implemented:

1.  Intent Router
2.  Local Fast Path for system queries
3.  Reduce LLM context size

This alone can reduce latency from seconds to milliseconds.

------------------------------------------------------------------------

# Long-Term Strategy

After core stabilization:

-   Add telemetry
-   Measure real latency
-   Track token usage
-   Profile bottlenecks
-   Consider local small-model classifier
-   Move toward event-driven architecture

------------------------------------------------------------------------

# Final Principle

Intelligence should not slow control.

Use LLM for reasoning. Use local code for execution.
