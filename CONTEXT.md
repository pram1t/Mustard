# OpenAgent Project Context

> **Purpose**: This document provides continuity for AI assistants working on this project across multiple chat sessions. Update this file at the end of each session.

---

## 🚨 PROJECT PIVOT: PRODUCTIZATION

**Original Vision**: OpenAgent as a Claude Code clone (single agent tool)

**New Vision**: **AI Development Agency Platform** - A productized platform where users **hire AI workers** (not just use an agent)

### Key Changes

| Before | After |
|--------|-------|
| Single agent | Team of specialized workers |
| Chat interface | Visual workspace |
| CLI tool | SaaS platform |
| Pay for usage | Pay per worker hired |
| Session memory | Persistent project memory |

### New Documentation Location

All productization planning is at: `E:\you\the productization plan\`

| Document | Purpose |
|----------|---------|
| `README.md` | Vision overview |
| `ARCHITECTURE-COMPARISON.md` | Current vs proposed architectures |
| `WORKER-CATALOG.md` | All 10 workers defined |
| `COORDINATION-PATTERNS.md` | How workers collaborate |
| `BUSINESS-MODEL.md` | Pricing, revenue projections |
| `COMPETITIVE-ANALYSIS.md` | vs Claude Code, Devin, etc |
| `IMPLEMENTATION-ROADMAP.md` | Build phases |

---

## Project Overview

**OpenAgent** is evolving from an open-source Claude Code clone into a **productized AI development agency platform**.

### Core Goals (Updated)
1. **Worker Model**: Users hire specialized AI workers (Architect, Frontend, Backend, QA, etc.)
2. **Persistent Memory**: Workers remember project context across sessions
3. **Visual Workspace**: Kanban boards, war rooms, artifact galleries
4. **Collaboration**: Workers hand off work, review each other
5. **Business Model**: Per-worker subscription pricing

### Tech Stack (Same foundation)
- **Runtime**: TypeScript + Bun
- **Desktop**: Electron + React
- **Build**: Turborepo monorepo
- **Protocol**: MCP (JSON-RPC 2.0 over STDIO/HTTP)
- **New**: PostgreSQL (worker memory), Redis (message bus)

---

## Current Project State

### Phase: Documentation Complete, Pivot Defined

Original OpenAgent docs are complete. New productization plan is documented.

### Completed Work

#### Original OpenAgent Documentation (`docs/`)
| File | Description | Status |
|------|-------------|--------|
| `docs/ARCHITECTURE.md` | 5-layer system architecture | Done |
| `docs/LLM-ABSTRACTION.md` | LLM provider interface | Done |
| `docs/TOOL-SYSTEM.md` | Tool interface, 11 built-in tools | Done |
| `docs/MCP-CLIENT.md` | MCP protocol, transports | Done |
| `docs/AGENT-LOOP.md` | Core agent loop | Done |
| All other docs... | See full list | Done |

#### Productization Plan (`E:\you\the productization plan\`)
| File | Description | Status |
|------|-------------|--------|
| `README.md` | Vision: AI team vs AI tool | Done |
| `ARCHITECTURE-COMPARISON.md` | 4 architecture options | Done |
| `WORKER-CATALOG.md` | 10 workers with skills, tools, pricing | Done |
| `COORDINATION-PATTERNS.md` | Message bus, handoffs, war rooms | Done |
| `BUSINESS-MODEL.md` | $19-49/worker pricing, bundles | Done |
| `COMPETITIVE-ANALYSIS.md` | vs Claude, Devin, Copilot, etc | Done |
| `IMPLEMENTATION-ROADMAP.md` | Phase A/B/C with tasks | Done |

#### Related Projects
| Folder | Purpose |
|--------|---------|
| `E:\you\self improving coding agent\` | Bootstrap guide for self-building |
| `E:\you\a new life\` | Universal connectors research |

---

## NEW Implementation Roadmap

### Foundation: OpenAgent Phases 1-4 (Still Required)
Build the basic agent infrastructure first - this becomes the foundation.

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project Foundation (monorepo setup) | Not Started |
| 2 | LLM Abstraction Layer | Not Started |
| 3 | Core Tool System | Not Started |
| 4 | Agent Loop | Not Started |

### Productization: Phases A-C (New)

| Phase | Description | Duration | Status |
|-------|-------------|----------|--------|
| **A** | MVP - 3 workers (Architect, Frontend, Backend) | 4-6 weeks | Not Started |
| **B** | Full Team - 10 workers, war rooms, reviews | 6-8 weeks | Not Started |
| **C** | Enterprise - Custom workers, marketplace | 8-12 weeks | Not Started |

### Phase A Breakdown (MVP)

```
A.1 Worker Infrastructure (Week 1-2)
├── Worker base class
├── Memory persistence (PostgreSQL)
├── Skill tracking
└── 3 initial workers

A.2 Orchestration Layer (Week 2-3)
├── Task queue (Redis/BullMQ)
├── Message bus
└── Orchestrator

A.3 Handoff Protocol (Week 3-4)
├── Artifact types
├── Handoff flow
└── Acknowledgment system

A.4 Basic UI (Week 4-5)
├── Project dashboard
├── Task board (Kanban)
└── Work stream

A.5 Testing (Week 5-6)
└── Integration tests
```

---

## Key Architectural Decisions

### Original Decisions (Still Valid)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript + Bun | Performance, ecosystem |
| Desktop | Electron | Cross-platform |
| Structure | Monorepo (Turborepo) | Modularity |
| Integrations | MCP-first | Ecosystem compatibility |

### New Decisions (Productization)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worker Model | Persistent, specialized | Better than disposable subagents |
| Communication | Event-driven message bus | Async, scalable |
| Storage | PostgreSQL + Redis | Memory persistence + real-time |
| UI | React + Next.js | Modern, SSR-ready |
| Pricing | Per-worker subscription | Natural monetization |

---

## For Future AI Sessions

### Starting a New Session

1. **Read this file first** (`CONTEXT.md`)
2. **Check productization plan** at `E:\you\the productization plan\`
3. **Decide which path**:
   - Building foundation? → Follow OpenAgent Phases 1-4
   - Building product? → Follow Phases A-C in IMPLEMENTATION-ROADMAP.md

### Quick Start Commands

```bash
# If starting foundation (Phases 1-4):
cd E:\you\openagent
# Follow docs/IMPLEMENTATION-PHASES.md

# If starting productization (Phase A):
cd E:\you\openagent
# Follow "the productization plan/IMPLEMENTATION-ROADMAP.md"
```

### Key Files to Reference

**For Foundation**:
- `docs/ARCHITECTURE.md` - System design
- `docs/IMPLEMENTATION-PHASES.md` - Build steps
- `specs/` - Type definitions

**For Productization**:
- `the productization plan/ARCHITECTURE-COMPARISON.md` - Worker architecture
- `the productization plan/WORKER-CATALOG.md` - Worker definitions
- `the productization plan/IMPLEMENTATION-ROADMAP.md` - Build phases

---

## Session History

### Session 1 (Initial)
**Date**: 2025-01-15
**Work Done**:
- Created complete project documentation
- All 14 docs, 5 specs, 3 templates

### Session 2 (Current - Productization Pivot)
**Date**: 2025-01-17
**Work Done**:
- Researched multi-agent architectures (Claude Code, Devin, CrewAI, MetaGPT, etc.)
- Defined productization pivot: AI tool → AI agency platform
- Created complete productization plan:
  - 4 architecture options (Agency, Assembly Line, Swarm, Firm)
  - 10 workers with full definitions
  - Coordination patterns (message bus, handoffs, war rooms)
  - Business model ($19-49/worker, bundles, engagement models)
  - Competitive analysis
  - Implementation roadmap (Phases A-C)
- Updated this CONTEXT.md for new direction

**Next Steps**:
- Start Phase 1-4 (foundation) OR
- Start Phase A (MVP with 3 workers)
- User's choice on which path

---

## Notes

- **Original vision**: Claude Code clone (still valuable as foundation)
- **New vision**: Productized platform with worker subscriptions
- **Key insight**: "Users hire a team, not use a tool"
- **Revenue potential**: $99-351/month per user (vs $20/month for Claude Code)
- **Differentiation**: Persistent memory, visual workspace, worker collaboration

---

*Last Updated: Session 2 - Productization Pivot*
