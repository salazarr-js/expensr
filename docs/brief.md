# expensr

Modern and simple expense tracker.

Minimal tool designed to understand personal finances with zero friction. Focuses on recording money movements quickly and making financial behavior easy to understand.

## Goal

Answer a few simple but important questions:

- Where does my money go?
- Who owes me money? Who do I owe?
- How much money do I actually have?
- How much money do I burn on fees?

## Core Feature: Quick Record

Adding a record should take **seconds**. Available from anywhere in the app.

```
45 sushi
120 uber
30 beer wilmer
12 coffee
```

The system interprets the input, assigns tags and categories automatically. Partial records are valid — only amount, date, and account are required. Everything else can be completed later.

## Core Concepts

### Accounts

Where money lives. Bank accounts, credit cards, cash, digital wallets. Each has a currency, color, icon, and starting balance. Dashboard shows balances and recent activity per account.

### Records

Any financial movement: expense, shared spending, money owed/lent, transfer, currency exchange, or fee. Intentionally simple and flexible to represent real-life situations.

### People

Individuals involved in financial interactions. Enables tracking shared expenses, money owed, and money lent. The system can recognize frequent transfers and associate them with people.

### Categories

High-level spending groups. Defaults: Food, Transport, Housing, Utilities, Subscriptions, Shopping, Health, Entertainment, Travel, Personal, Education, Finance, Debt, Gifts, Other. Fully customizable.

### Tags

Specific context for a record. Each record has one main tag, each tag belongs to a category. `uber` -> Transport, `sushi` -> Food. The system learns tag-to-category relationships over time (**Smart Categorization**).

## Record Types

- **Expense** — standard spending
- **Shared** — expense involving a person (creates debt tracking)
- **Transfer** — money between accounts (two linked records, not counted as spending)
- **Exchange** — currency conversion with fee tracking
- **Fee** — financial costs (ATM, bank ops, card payments)

## Key Workflows

- **Quick Record** — fastest manual entry
- **Bank Import** — bulk capture from CSV/XLS/XLSX statements
- **Review Mode** — validate records missing tags, categories, or with uncertain categorization

Philosophy: **capture fast -> categorize automatically -> review later**

## Views

### Dashboard
Monthly/quarterly/yearly overview. Account balances, category breakdown, recent records, debt summary. Period comparison (this month vs last).

### Records Page
Browse and filter all records by account, date range, category, tag, or person. Table view and account column view.

## Multi-Currency

Currency is user-defined on each account — purely visual. What matters are the amounts and the accounts they belong to. No hardcoded rates (they change too much). Exchanges between currencies track both amounts and fees, revealing real costs.

## Data Models

### Account
name, code, type, currency, color, icon, starting balance

### Record
amount, date, account, tag, category, person (optional), note (optional)

### Tag
name, category, color, icon

### Category
name, color, icon

### Person
name, avatar (optional)

## Tech Stack

- **Monorepo:** pnpm workspaces (shared, api, web)
- **API:** Hono on Cloudflare Workers
- **Frontend:** Vue 3 + Nuxt UI 4 + Tailwind CSS 4 + TypeScript
- **Deploy:** Single Cloudflare Worker (SPA + API)
- **Storage:** KV initially, D1 later
- **Design:** Light-only theme (no dark mode)
- **Fonts:** Bricolage Grotesque, Manrope, JetBrains Mono

## Product Principles

- **Simplicity First** — obvious, clean, easy
- **Frictionless Input** — seconds, not minutes
- **Clarity Over Features** — meaningful insights, not feature count
- **Fast by Default** — instant, responsive, lightweight
- **Your Data, Your Control** — transparent and user-owned
