-- Convert existing date-only values to datetime (noon default)
UPDATE records SET date = date || 'T12:00:00' WHERE date NOT LIKE '%T%';