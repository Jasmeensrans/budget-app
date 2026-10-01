# Budget App: Development Plan

A personal budgeting app in the spirit of Monarch Money and Copilot Money. It runs in the browser (desktop and mobile), is hosted on GitHub Pages, and will store data in Firebase. There are no bank connections. Transactions come in through manual entry or a JSON bulk import that an AI (Claude or Gemini) generates from screenshots.

Design canvas: https://claude.ai/artifact/Av6KTxShwWMEtDGK4efEv9

## Approach

The UI comes first, with Firebase connected last. All screens talk to a single data layer (`src/data/`). Until week 10 that layer saves to `localStorage` and loads sample data; after that it's swapped for Firestore. Screens don't change during the swap.

> Until Firebase is connected, data lives in one browser only. Don't enter real history before week 10.

## Stack

- Vite + React + TypeScript
- Hand-drawn SVG charts; hand-written import validation (no chart or schema libraries so far)
- Firebase Auth (Google sign-in) + Firestore, with no backend of our own
- GitHub Pages, deployed by GitHub Actions on push to `main`; `HashRouter` for routing

## Timeline

Assumes one developer at about 8–10 hours a week, starting Monday, Sep 28, 2026.

| Week | Dates | Phase | Milestone |
|---|---|---|---|
| 1 | Sep 28 – Oct 4 | Setup + local data layer | Empty app live on Pages |
| 2–3 | Oct 5 – 18 | Transactions + categories | Add and categorize by hand |
| 4 | Oct 19 – 25 | Rules | Categorization happens automatically |
| 5 | Oct 26 – Nov 1 | Bulk import | Import from AI JSON |
| 6–7 | Nov 2 – 15 | Budgets | Fixed, flexible, sinking funds |
| 8 | Nov 16 – 22 | Dashboard | Full overview |
| 9 | Nov 23 – 29 | Mobile polish | Installed on your phone (Thanksgiving week, so expect some slip) |
| 10 | Nov 30 – Dec 6 | Connect Firebase | Data synced across devices |
| 11 | Dec 7 – 13 | Hardening | **v1 done** |

## Tasks

### Phase 0: Setup + local data layer (week 1)
- [x] Vite + React + TS project
- [ ] ESLint + Prettier
- [x] Actions workflow deploying to Pages (`.github/workflows/deploy.yml`)
- [ ] Create the GitHub repo, push, enable Pages (Settings → Pages → Source: GitHub Actions)
- [x] Design tokens (`src/styles/tokens.css`): #004F2D greens and pastel categories from the style guide; layout, cards and serif titles from the original boards
- [x] Base components: Button, CategoryTag, Pill, Card, Progress, PageHeader, Icon
- [x] App layout: sidebar (desktop), bottom tab bar (mobile), placeholder pages, dev-only `/styleguide`
- [x] Data contract for Transaction, Category, Budget, Contribution, Rule (`src/data/types.ts`)
- [x] `Repository` interface + `localStorage` version + sample data (`src/data/`)

### Phase 1: Transactions + categories (weeks 2–3)
- [x] Transaction list grouped by day, search, filters
- [x] Month switcher on the transaction list
- [x] Add transaction panel (desktop) and sheet (mobile)
- [x] Edit an existing transaction
- [x] Set and remove a transaction's category from the list
- [x] Categories screen: create, edit, delete, with icon and color
- [x] Delete with undo message

### Phase 2: Rules (week 4)
- [x] Rule matching: description and/or amount conditions, top to bottom, first match wins
- [x] Rules tab: create, delete, reorder
- [x] "Always file X under Y" option when adding, and "Create rule" after picking a category
- [x] Optionally re-apply a new rule to existing transactions
- [ ] Unit tests for rule matching

### Phase 3: Bulk import (week 5)
- [x] Import format (JSON, v1) + validation (hand-written in `src/domain/importFormat.ts`, no Zod needed)
- [x] Paste → review → import screen
- [x] Duplicate check (`importId`, or same date + amount + description)
- [x] New category names in the import create categories
- [x] "Copy AI prompt" button with a tested prompt for Claude and Gemini

### Phase 4: Budgets (weeks 6–7)
- [x] Fixed budgets (month/year), progress bars, even-pace marker for yearly
- [x] Flexible budgets: monthly contribution records, balance worked out from them
- [x] Sinking funds: target + due date, auto-calculated monthly amount
- [x] Write the new month's contributions when the month starts
- [x] Manual top-ups / withdrawals
- [x] Budgets screen + "New budget" dialog
- [ ] Unit tests for budget math (write before the UI)

### Phase 5: Dashboard (week 8)
- [x] Cards: spent so far, left to spend, income
- [x] This month vs last month spending chart
- [x] Budget check-in, recent transactions, flexible funds
- [x] Spending by category: every category with spending, budgeted or not, linking to its transactions for that month

### Phase 6: Mobile polish (week 9)
- [x] Mobile tab bar with a More page for Categories, Rules, Import, Settings
- [ ] Responsive pass on every screen
- [ ] Installable to the phone home screen (manifest + icon)
- [ ] Touch targets, loading and empty states

### Phase 7: Connect Firebase
- [x] Firebase SDK, config from env vars (`.env.local`, GitHub secrets), local mode when unset
- [x] Google sign-in screen; the app waits for sign-in and for data to load
- [x] `createFirestoreRepository(db, uid)` implementing `Repository`, swapped in on sign-in (`src/data/auth.tsx`)
- [x] Offline cache (persistent local cache, multi-tab)
- [x] Firestore security rules (`firestore.rules`): only you can read or write `users/{uid}/**`
- [x] Settings: signed-in account, sign out, one-time "move this browser's data to your account"
- [x] Create the Firebase project and fill in `.env.local` (see [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md))
- [x] Sign in and move your data (verified on the server: 104 transactions, 17 categories, 54 rules, 3 accounts)
- [ ] Push to GitHub, add the four secrets, check the live site on your phone

### Phase 8: Hardening (week 11)
- [x] Export all data as JSON (backup)
- [ ] Error handling and offline message
- [ ] Final pass on Firestore rules and indexes
- [ ] Clear test data, import real history

## Data model

The contract lives in [`src/data/types.ts`](src/data/types.ts); that file is the source of truth. The summary:

- Path: `users/{uid}/{collection}/{id}`, the same for localStorage today and Firestore later.
- Every document has `id`, `createdAt`, `updatedAt` (set by the data layer).
- Money is **integer cents** (`amountCents`, `targetCents`, …). Never floating dollars.
- Dates are strings: `ISODate` "2026-09-24", `MonthKey` "2026-09".
- JSON-safe only: no `Date` objects, no `undefined` (use `null`).
- Totals, balances and progress are computed ([`src/domain/budgets.ts`](src/domain/budgets.ts)), never stored.

| Collection | Key fields |
|---|---|
| `accounts` | `name`, `currency` (`USD`/`CAD`), `kind` (`checking`/`savings`/`credit`) |
| `settings` | one document: `cadToUsd` (USD per 1 CAD) |
| `categories` | `name`, `color`, `icon`, `kind` (`spending`/`income`/`transfer`; transfers count as neither) |
| `transactions` | `date`, `amountCents` (USD, negative = money out), `description` (clean name), `rawDescription` (bank text), `categoryId`, `accountId`, `original` (`{amountCents, currency}` for non-USD accounts), `note`, `source`, `importId` |
| `budgets` | `type: 'fixed'` + `amountCents`, `period` (`month`/`year`); `type: 'flexible'` + `amountCents` (per month), `startMonth`, `startBalanceCents`; `type: 'sinking'` + `targetCents`, `targetMonth`, `startMonth`, `startBalanceCents` |
| `contributions` | `budgetId`, `month`, `amountCents`, `kind` (`monthly`/`adjustment`), `note`. Top-level with `budgetId` so it's one Firestore query |
| `rules` | `order`, `categoryId`, `conditions[]` on `description` (`contains`/`starts`/`is`) or amount (`equals`/`greaterThan`/`lessThan`/`between`, in cents) |

- **Flexible/sinking balance:** `startBalanceCents` + all contributions − spending in that category since `startMonth`.
- **Monthly contributions:** written the first time the app opens in a new month (`useContributionSync`). Past months are never rewritten.
- **Sinking fund monthly amount:** (target − balance) ÷ months left, rounded up to whole dollars.

**Connecting Firebase (Phase 7):** write `createFirestoreRepository(uid)` implementing [`Repository`](src/data/repository.ts) (`subscribe` → `onSnapshot`, `createMany`/`removeMany` → `writeBatch`) and swap it in [`src/data/live.ts`](src/data/live.ts). No screen changes.

## Import format

The Import page takes three kinds of input (detected automatically), for the account you pick:

1. **Lines from an AI** (the "Copy AI prompt" button). One transaction per line, category optional:
   ```
   2026-09-24 | AplPay TRADER JOE S #552 | -64.18 | Groceries
   2026-09-22 | ACH Debit: VENMO - PAYMENT | -80.00 |
   ```
   Description exactly as the bank shows it; money out negative.
2. **A bank CSV** with Date, Description and Amount columns. For credit card accounts, positive amounts are read as purchases.
3. **JSON**: `{ "transactions": [{ "date", "amount", "description", "category", "id" }] }`.

Then, for each row: CAD accounts convert to USD at the Settings rate (keeping the original), the name is cleaned for display, and the category is picked in this order: **matching rule → AI's category (if it's one of yours) → blank**. Likely duplicates are unticked. You review, change anything, and approve the whole batch in one go.

## Risks
- **Budget math:** contributions and carryover are where bugs will hide. Write the tests first.
- **AI output:** it won't always be clean JSON. The Zod check plus the review screen guard against bad data.
- **Firebase config:** it ends up in the page, which is normal. Security depends entirely on Firestore rules, so don't skip them.
