# Categories & Tags — Final

## 12 categories

Simple rule for each: **one question determines the category.**
| # | Category | Icon | Color | Rule | Tags (examples) |
|---|---|---|---|---|---|
| 1 | **Transport** | i-lucide-car | Blue | Getting around? | Uber, Taxi, Parking, Nafta, Subte, Peaje |
| 2 | **Housing** | i-lucide-home | Stone | Rent, bills, household? | Alquiler, Expensas, Limpieza, Electricidad, Internet, Agua, Gas |
| 3 | **Health** | i-lucide-heart-pulse | Red | Medical, wellness, fitness? | Prepaga, Farmacia, Terapia, Gym |
| 4 | **Pets** | i-lucide-paw-print | Amber | For the pet? | Comida Mascota, Vet, Juguetes Mascota |
| 5 | **Income** | i-lucide-wallet | Green | Money coming in? | Salario, Freelance, Reembolso, Venta |
| 6 | **Shopping** | i-lucide-shopping-bag | Yellow | Bought at a store? | Supermercado, Kiosko, Carniceria, Verduras |
| 7 | **Dining** | i-lucide-utensils | Orange | Someone prepared it for me? | Restaurante, Cafe, Bar, Delivery, Salida |
| 8 | **Leisure** | i-lucide-gamepad-2 | Purple | Fun activity? | Padel, Wake, Snowboard, Games, Gym |
| 9 | **Personal** | i-lucide-user | Pink | Clothing, care, phone, gifts? | Ropa, Indumentaria, Skincare, Peluqueria, Celular, Regalo |
| 10 | **Finance** | i-lucide-landmark | Indigo | Fees, taxes? | Fees, Impuestos, Monotributo |
| 11 | **Digital** | i-lucide-monitor | Teal | Software, cloud, subscriptions? | Subscriptions, Software, Cloud |
| 12 | **Travel** | i-lucide-plane | Sky | Trip-related? | Vuelo, Hotel, Excursion |

## Category rules

- **Shopping vs Dining**: "Did I buy ingredients/products?" → Shopping. "Did someone prepare it for me?" → Dining.
- **Leisure vs Digital**: Physical/social activity → Leisure. Digital service → Digital.
- **Health includes gym** — recurring fitness is a health investment, not leisure.
- **Transfers/exchanges are record types, not tags** — handled by the record type field, not categories.
- **Travel is separate** — trip expenses get their own category even if they overlap (eating at a hotel restaurant → Travel, not Dining).

## Design decisions

- **Tags inherit category color** — no individual tag color
- **Tags keep optional icon** — fallback is `#` (i-lucide-hash)
- **Tags are managed inline** inside the category modal (no separate tag modal)
- **Categories in English**, tags in any language (user-defined)
- **No "Other" category** — forces better categorization
- **12 categories** — lean vs YNAB (60+) and Monarch (20+), tags provide the detail

## Smart categorization (future, feature 7)

```
1. Merchant memory (known merchants → auto-tag)     → 50-70% of records
2. Pattern rules (text contains "uber" → transport)  → 10-20%
3. LLM fallback (ambiguous text → AI categorizes)    → 10-30%
4. Manual review (uncertain → user confirms)          → 1-5%
```
