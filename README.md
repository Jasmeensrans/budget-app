# My Budget

A personal budgeting app in the spirit of Monarch Money and Copilot Money. React + TypeScript + Vite, with Firebase (Google sign-in + Firestore) for storage, deployed to GitHub Pages.

There are no bank connections. Transactions come in by hand, from a bank CSV, or from screenshots: the Import page gives you a short prompt for ChatGPT, Gemini or Claude, and you paste back what it returns.

## Features

- **Dashboard:** spending so far vs last month, income, a spending-pace chart, a donut of where your money went, budgets, flexible funds, recent transactions
- **Transactions:** add, edit, search, filter by month, account and category, undo delete
- **Budgets:** fixed (monthly or yearly), flexible (leftovers carry over) and sinking funds (save toward a target by a date)
- **Rules:** categorize automatically by description and/or amount, top to bottom, first match wins
- **Import:** paste AI output or upload a bank CSV, review every row (rules → AI suggestion → blank), approve in one go
- **Accounts:** checking, savings and credit cards, in USD or CAD (converted to USD at a rate you set)
- **Categories:** spending, income or transfer (transfers like card payments aren't counted twice)

## Development

```bash
npm install
npm run dev
```

Without Firebase settings the app runs in local mode (data stays in that browser). To connect Firebase, see [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

```bash
npm run build      # type-check + production build
```

## Project layout

- `src/data/` is the data contract (`types.ts`), the `Repository` interface, and its localStorage and Firestore implementations
- `src/domain/` holds pure logic: budget math, rules, the import parser, merchant name cleanup
- `src/features/` has one folder per screen
- `src/styles/tokens.css` holds the design tokens (colors, type, spacing)
- `PLAN.md` has the roadmap and data model

Personal data (`private/`) and Firebase settings (`.env.local`) are git-ignored.
