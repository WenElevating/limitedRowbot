# Windows Desktop Robot (TS + React) --- Full Development Plan

## Project Goal

Build a Windows desktop AI agent platform that:

-   Runs on Windows
-   Supports CLI interaction
-   Supports Desktop GUI (Electron + React)
-   Integrates with external LLM chat providers
-   Can control files, processes, shell, and (later) UI automation
-   Has permission control and risk management
-   Logs all actions
-   Synchronizes progress to AI coder after every completed task

------------------------------------------------------------------------

# Architecture Overview

User → CLI / Desktop UI\
↓\
Agent Core\
↓\
Planner\
↓\
Permission System\
↓\
Tool System\
↓\
Windows Adapter\
↓\
Execution + Logs

------------------------------------------------------------------------

# Development Phases

------------------------------------------------------------------------

# Phase 1 --- Core CLI Agent (Foundation)

## Objective

Create a stable CLI-based agent capable of:

-   Talking to an LLM
-   Generating execution plans
-   Running FileTool
-   Running ShellTool
-   Logging all operations

## Work Breakdown

### 1. Monorepo Setup

-   Initialize pnpm workspace
-   Create folder structure:
    -   apps/cli
    -   packages/agent-core
    -   packages/tool-system
    -   packages/windows-adapter
    -   packages/llm-adapter
    -   packages/permission-system
    -   packages/logger

### 2. Agent Core

-   Define ExecutionPlan interface
-   Implement planner() function
-   Implement execute() pipeline

### 3. Tool System

-   Define Tool interface
-   Create ToolRegistry
-   Implement:
    -   FileTool
    -   ShellTool

### 4. Windows Adapter

-   File operations wrapper
-   Shell execution wrapper
-   Process listing wrapper

### 5. LLM Adapter

-   Define LLMProvider interface
-   Implement OpenAI-compatible provider
-   Support JSON mode / function call

### 6. Logger

-   JSON log output
-   Task ID tracking
-   Store logs in SQLite

------------------------------------------------------------------------

## Phase 1 Completion Criteria

-   CLI agent runs
-   Can read/write file
-   Can execute safe shell commands
-   Can display structured plan before execution
-   Logs every action

------------------------------------------------------------------------

# Phase 2 --- Permission & Safety System

## Objective

Prevent dangerous operations.

## Work Breakdown

### 1. Risk Level Enum

READ / MODIFY / DELETE / SYSTEM

### 2. Permission Guard

-   Evaluate risk level
-   Require confirmation for DELETE and SYSTEM
-   CLI confirmation prompt

### 3. Dry Run Mode

-   Print plan without executing

### 4. Backup Mechanism

-   Before modifying files
-   Store in .robot-backups/

------------------------------------------------------------------------

## Phase 2 Completion Criteria

-   High-risk operations require confirmation
-   File overwrite creates backup
-   Dry-run supported

------------------------------------------------------------------------

# Phase 3 --- Electron Desktop UI

## Objective

Add GUI interface.

## Work Breakdown

### 1. Setup Electron + React + Vite

### 2. UI Components

-   Chat window
-   Execution log panel
-   Permission popup
-   Task history view

### 3. IPC Bridge

-   Renderer → Main process
-   Main → Agent Core

### 4. Isolate Agent from Renderer

------------------------------------------------------------------------

## Phase 3 Completion Criteria

-   Desktop app launches
-   Can chat with AI
-   Shows execution plan
-   Shows logs in real-time

------------------------------------------------------------------------

# Phase 4 --- Advanced Windows Automation

## Objective

Add deeper Windows control.

## Work Breakdown

### 1. Process Control Tool

-   List processes
-   Kill process
-   Start application

### 2. UI Automation Layer

-   Integrate Windows UI Automation API
-   Detect window elements
-   Click buttons safely

### 3. Screen Capture + OCR (Optional)

------------------------------------------------------------------------

## Phase 4 Completion Criteria

-   Can launch app
-   Can detect open windows
-   Can perform controlled UI actions

------------------------------------------------------------------------

# Phase 5 --- Workflow Engine

## Objective

Support YAML workflow execution.

## Work Breakdown

### 1. YAML Parser

### 2. DAG Execution

### 3. Retry Logic

### 4. Conditional Steps

------------------------------------------------------------------------

# AI Coder Synchronization Protocol

After completing EACH task:

1.  Update PROJECT_PROGRESS.md
2.  Add:
    -   Completed Task
    -   Date
    -   Files Modified
    -   Remaining Tasks
3.  Commit with: feat: phase-x task-y completed
4.  Ask AI coder:
    -   Review architecture consistency
    -   Check for security issues
    -   Suggest refactor

------------------------------------------------------------------------

# PROJECT_PROGRESS.md Template

## Current Phase:

## Completed Tasks:

## In Progress:

## Blockers:

## Next Task:

------------------------------------------------------------------------

# Mandatory Rule

After ANY feature is completed:

-   Update PROJECT_PROGRESS.md
-   Re-evaluate architecture
-   Sync with AI coder

------------------------------------------------------------------------

# Recommended Development Order

1.  CLI Agent
2.  Tool System
3.  Permission System
4.  Logging
5.  Electron UI
6.  Windows Automation
7.  Workflow Engine

------------------------------------------------------------------------

# Final Advice

Do not start with UI automation. Stabilize CLI core first. Make
execution deterministic before adding intelligence.

Build control first. Then build power.
