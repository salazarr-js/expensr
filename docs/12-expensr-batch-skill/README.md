# /expensr-batch — Claude Code Skill

**Status:** Brief. Not yet implemented.

Replaces in-app batch features. User pastes a bank statement copy-paste, Claude Code parses it, confirms, and inserts via the API.

## Workflow

1. User runs `/expensr-batch` and pastes bank statement text
2. Skill parses lines: date, description, amount, sign (+/-)
3. Skill detects and **removes offsetting pairs** (e.g., +302.91 percepcion + -302.91 anulacion = net zero → skip both)
4. Skill maps descriptions to tags (uber → Uber, rappi → Delivery, veterinaria → Vet, etc.)
5. Unmatched descriptions → `needsReview: true`, no tag
6. Skill **reverses the order** — bank lists newest-first, API needs oldest-first for correct datetime sequencing
7. Skill shows a confirmation table to the user
8. User confirms → skill calls `POST /api/records/batch`

## Offsetting Pair Detection

Bank statements often have offsetting entries that cancel out:

```
+302.91   Anulacion percepcion rg 5617/24
-302.91   Percepcion rg 5617/24
+1,000    Dev.compra galicia 24-electron
-1,000    Uber shopper statement
```

These net to zero — no real money moved. Detect pairs where:
- Same date
- Same absolute amount
- Opposite signs
- Related descriptions (perception/anulacion, compra/dev.compra)

Flag them and ask user: "These pairs cancel out. Skip them?" Default: skip.

Note: not all same-amount opposite-sign entries are offsetting. A $5,000 income and $5,000 expense on the same day could be unrelated. Use description similarity as a signal, and when in doubt, ask.

## Order Rule

**Bank order:** newest transaction first (top of statement)
**API order:** oldest first (batch endpoint assigns sequential timestamps within each date group)

Always reverse the parsed array before inserting.

## Tag Mapping

Known patterns from Galicia ARS bank statements:

| Bank description pattern | Tag | Category |
|---|---|---|
| `Payu*ar*uber` / `Uber shopper` | Uber | Transport |
| `Dlo*rappi` | Delivery | Dining |
| `Veterinaria` | Vet | Pets |
| `Merpago*hudsonwakeboar` | Wake | Leisure |
| `Express av. chiclana` | Supermercado | Shopping |
| `Compra venta de dolares` | Venta | Income |
| `Percepcion rg` / `Anulacion percepcion` | Impuestos | Finance |
| `Dev.compra` | Reembolso | Income |
| `Transferencia a terceros` | ? (needsReview) | — |
| `Merpago*atc` | ? (needsReview) | — |

This mapping should be loaded from the DB (keyword_mappings + tag names) at runtime, not hardcoded. The table above is just initial context.

## Input Format

Any bank statement file — Excel, CSV, PDF, or raw pasted text. **No bank-specific parser code.** Claude reads the file, figures out the structure (dates, amounts, descriptions), and normalizes it.

User drops file in `resumes/` folder and runs `/expensr-batch resumes/file.xlsx`. Claude adapts to any format.

Tag mappings and offsetting patterns are stored in `.expensr/bank-patterns.json` (gitignored, per-user). Reconcile state in `.expensr/state.json`.

## Required context from user

- **Account**: which account these records belong to (ask if not obvious from bank name)
- **Confirm**: always show the parsed table before inserting

## Future

- Detect transfers between own accounts (e.g., Transferencia → MercadoPago could be a transfer, not an expense)
- Learn new tag mappings from user corrections during reconcile
- Note: "support other bank formats" is NOT needed — Claude parses any format natively. No parser code per bank.
