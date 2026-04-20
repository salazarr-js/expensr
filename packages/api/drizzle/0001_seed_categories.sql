INSERT OR IGNORE INTO `categories` (`name`, `icon`, `color`) VALUES
  ('Digital', 'i-lucide-monitor', 'Teal'),
  ('Dining', 'i-lucide-utensils', 'Orange'),
  ('Finance', 'i-lucide-landmark', 'Indigo'),
  ('Health', 'i-lucide-heart-pulse', 'Red'),
  ('Housing', 'i-lucide-home', 'Stone'),
  ('Income', 'i-lucide-wallet', 'Green'),
  ('Leisure', 'i-lucide-gamepad-2', 'Purple'),
  ('Personal', 'i-lucide-user', 'Pink'),
  ('Pets', 'i-lucide-paw-print', 'Amber'),
  ('Shopping', 'i-lucide-shopping-bag', 'Yellow'),
  ('Transport', 'i-lucide-car', 'Blue'),
  ('Travel', 'i-lucide-plane', 'Sky');

INSERT OR IGNORE INTO `tags` (`name`, `icon`, `category_id`) VALUES
  -- Digital
  ('Cloud', 'i-lucide-cloud', (SELECT id FROM categories WHERE name = 'Digital')),
  ('Software', 'i-lucide-code', (SELECT id FROM categories WHERE name = 'Digital')),
  ('Subscriptions', 'i-lucide-tv', (SELECT id FROM categories WHERE name = 'Digital')),
  -- Dining
  ('Bar', 'i-lucide-wine', (SELECT id FROM categories WHERE name = 'Dining')),
  ('Cafe', 'i-lucide-coffee', (SELECT id FROM categories WHERE name = 'Dining')),
  ('Delivery', 'i-lucide-truck', (SELECT id FROM categories WHERE name = 'Dining')),
  ('Restaurante', 'i-lucide-utensils', (SELECT id FROM categories WHERE name = 'Dining')),
  ('Salida', 'i-lucide-party-popper', (SELECT id FROM categories WHERE name = 'Dining')),
  -- Finance
  ('Fees', 'i-lucide-percent', (SELECT id FROM categories WHERE name = 'Finance')),
  ('Impuestos', 'i-lucide-receipt', (SELECT id FROM categories WHERE name = 'Finance')),
  ('Monotributo', 'i-lucide-file-text', (SELECT id FROM categories WHERE name = 'Finance')),
  ('Seguros', 'i-lucide-shield-check', (SELECT id FROM categories WHERE name = 'Finance')),
  -- Health
  ('Farmacia', 'i-lucide-pill', (SELECT id FROM categories WHERE name = 'Health')),
  ('Prepaga', 'i-lucide-shield', (SELECT id FROM categories WHERE name = 'Health')),
  ('Terapia', 'i-lucide-brain', (SELECT id FROM categories WHERE name = 'Health')),
  -- Housing
  ('Alquiler', 'i-lucide-key', (SELECT id FROM categories WHERE name = 'Housing')),
  ('Electricidad', 'i-lucide-lightbulb', (SELECT id FROM categories WHERE name = 'Housing')),
  ('Expensas', 'i-lucide-building-2', (SELECT id FROM categories WHERE name = 'Housing')),
  ('Internet', 'i-lucide-wifi', (SELECT id FROM categories WHERE name = 'Housing')),
  ('Limpieza', 'i-lucide-sparkles', (SELECT id FROM categories WHERE name = 'Housing')),
  -- Income
  ('Freelance', 'i-lucide-laptop', (SELECT id FROM categories WHERE name = 'Income')),
  ('Reembolso', 'i-lucide-undo-2', (SELECT id FROM categories WHERE name = 'Income')),
  ('Salario', 'i-lucide-banknote', (SELECT id FROM categories WHERE name = 'Income')),
  ('Venta', 'i-lucide-tag', (SELECT id FROM categories WHERE name = 'Income')),
  -- Leisure
  ('Games', 'i-lucide-gamepad-2', (SELECT id FROM categories WHERE name = 'Leisure')),
  ('Gym', 'i-lucide-dumbbell', (SELECT id FROM categories WHERE name = 'Leisure')),
  ('Padel', 'i-lucide-circle-dot', (SELECT id FROM categories WHERE name = 'Leisure')),
  ('Snowboard', 'i-lucide-snowflake', (SELECT id FROM categories WHERE name = 'Leisure')),
  ('Wake', 'i-lucide-waves', (SELECT id FROM categories WHERE name = 'Leisure')),
  -- Personal
  ('Celular', 'i-lucide-phone', (SELECT id FROM categories WHERE name = 'Personal')),
  ('Peluqueria', 'i-lucide-scissors', (SELECT id FROM categories WHERE name = 'Personal')),
  ('Regalo', 'i-lucide-gift', (SELECT id FROM categories WHERE name = 'Personal')),
  ('Ropa', 'i-lucide-shirt', (SELECT id FROM categories WHERE name = 'Personal')),
  ('Skincare', 'i-lucide-droplets', (SELECT id FROM categories WHERE name = 'Personal')),
  -- Pets
  ('Comida Mascota', 'i-lucide-utensils', (SELECT id FROM categories WHERE name = 'Pets')),
  ('Juguetes Mascota', 'i-lucide-bone', (SELECT id FROM categories WHERE name = 'Pets')),
  ('Vet', 'i-lucide-stethoscope', (SELECT id FROM categories WHERE name = 'Pets')),
  -- Shopping
  ('Carniceria', 'i-lucide-beef', (SELECT id FROM categories WHERE name = 'Shopping')),
  ('Groceries', 'i-lucide-shopping-basket', (SELECT id FROM categories WHERE name = 'Shopping')),
  ('Kiosko', 'i-lucide-candy', (SELECT id FROM categories WHERE name = 'Shopping')),
  ('Supermercado', 'i-lucide-shopping-cart', (SELECT id FROM categories WHERE name = 'Shopping')),
  ('Verduras', 'i-lucide-carrot', (SELECT id FROM categories WHERE name = 'Shopping')),
  -- Transport
  ('Uber', 'i-lucide-car', (SELECT id FROM categories WHERE name = 'Transport')),
  -- Travel
  ('Excursion', 'i-lucide-map-pin', (SELECT id FROM categories WHERE name = 'Travel')),
  ('Hotel', 'i-lucide-hotel', (SELECT id FROM categories WHERE name = 'Travel')),
  ('Vuelo', 'i-lucide-plane', (SELECT id FROM categories WHERE name = 'Travel'));
