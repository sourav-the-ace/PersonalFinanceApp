# Northstar Finance Hub

A modern personal finance management web app built with Next.js, TypeScript, Tailwind CSS, and a feature-based architecture.

## Milestones

### Milestone 1 — Foundation and dashboard
- Scaffolded a Next.js 16 app with TypeScript and Tailwind.
- Implemented a feature-based finance shell with:
  - dashboard overview cards
  - income vs expense chart
  - expense by category chart
  - recent transactions and account summaries
  - transactions, accounts, categories, reports, and settings views
- Added reusable UI primitives and domain-specific data models.

## Architecture

- app/ — route entry points and global layout
- components/ — shared UI primitives
- features/finance/ — finance domain UI and seed data
- lib/ — shared helpers such as utility functions
- types/ — shared TypeScript domain models
- utils/ — formatting and other helpers

## Getting started

```bash
npm install
npm run dev
```

## Verification

The project was verified with:

```bash
npm run build
```
