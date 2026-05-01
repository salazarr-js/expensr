---
name: Multi-currency debt tracking + loans
description: People page should show debt per currency, add loan record type
type: project
---

**Multi-currency debt:** People balance is currently a single number, but shared expenses can be in different currencies (USD, ARS). API should group debt by account currency and return per-currency balances. People page + dashboard debts widget should show multiple lines per person.

**Loans:** "I lent 500 USD to Gusmely" doesn't fit current patterns cleanly. Workaround: expense with manual split where person owes 100%. A proper `loan` record type would be cleaner — no category, pure debt, separate dashboard widget showing total lent out.

**Related:** "Who paid?" feature (already in memory) — tracking expenses others paid on your behalf.

**How to apply:** API `GET /people` needs to join records → accounts for currency. Return `balances: {currency: string, amount: number}[]` instead of single `balance: number`. Frontend People page + dashboard debts widget adapt to show per-currency lines.
