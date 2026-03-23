import { sqliteTable, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { records } from "./records";
import { people } from "./people";

/** Junction table linking records to people for shared expenses. */
export const recordPeople = sqliteTable(
  "record_people",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recordId: integer("record_id")
      .notNull()
      .references(() => records.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
  },
  (table) => [
    uniqueIndex("record_people_unique").on(table.recordId, table.personId),
    index("record_people_record_idx").on(table.recordId),
    index("record_people_person_idx").on(table.personId),
  ]
);
