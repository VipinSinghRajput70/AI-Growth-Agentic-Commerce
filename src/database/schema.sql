-- OmniAgent Commerce — SQLite Database Schema

-- Product Catalog
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  inventory INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  tags TEXT,
  related_products TEXT,
  discount_allowed INTEGER DEFAULT 1,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Merchant Policies
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY DEFAULT 'default',
  max_autonomous_limit REAL DEFAULT 10000,
  max_ai_discount_percent REAL DEFAULT 20,
  daily_spend_cap REAL DEFAULT 50000,
  require_approval_above_limit INTEGER DEFAULT 1,
  upselling_enabled INTEGER DEFAULT 1,
  cross_selling_enabled INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shopping Cart
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders with State Machine
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  cart_hash TEXT NOT NULL,
  total_amount REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  final_amount REAL NOT NULL,
  state TEXT CHECK(state IN (
    'CART', 'POLICY_CHECK', 'APPROVAL_REQUIRED', 'APPROVED', 'REJECTED',
    'RAZORPAY_ORDER_CREATED', 'PAYMENT_PENDING', 'PAYMENT_VERIFIED', 'PAID',
    'PAYMENT_FAILED', 'TIMEOUT', 'CANCELLED', 'INVENTORY_FAILED'
  )) NOT NULL DEFAULT 'CART',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  failure_reason TEXT,
  cart_snapshot TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Merchant Approval Gate
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  decided_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  policy_evaluation TEXT DEFAULT 'N/A',
  amount REAL,
  razorpay_order_id TEXT,
  status TEXT NOT NULL,
  error_details TEXT
);

-- Webhook Event Idempotency
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Spend Tracking
CREATE TABLE IF NOT EXISTS daily_spend (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  date TEXT NOT NULL,
  total_spent REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Merchant Policy
INSERT OR IGNORE INTO policies (id, max_autonomous_limit, max_ai_discount_percent, daily_spend_cap, require_approval_above_limit, upselling_enabled, cross_selling_enabled)
VALUES ('default', 10000, 20, 50000, 1, 1, 1);

-- Seed Product Catalog (individual inserts for sql.js compatibility)
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_001', 'Pro Running Shoes', 'Footwear', 2499, 25, 'Lightweight running shoes with advanced cushioning technology. Perfect for daily runs and marathon training.', '["running","sports","fitness","shoes"]', '["prod_002","prod_003","prod_010"]', 1, '🏃');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_002', 'Performance Running Socks (3-Pack)', 'Accessories', 199, 100, 'Moisture-wicking running socks with arch support. Anti-blister design for long-distance comfort.', '["running","socks","accessories"]', '["prod_001","prod_003"]', 1, '🧦');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_003', 'Insulated Sports Bottle 750ml', 'Accessories', 299, 60, 'Double-walled stainless steel bottle. Keeps water cold for 24 hours. Leak-proof sport cap.', '["bottle","hydration","sports"]', '["prod_001","prod_002"]', 1, '🍶');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_004', 'Elite Running Shoes Pro', 'Footwear', 3999, 15, 'Carbon-plate racing shoes with responsive foam technology. For competitive runners seeking personal bests.', '["running","shoes","premium","racing"]', '["prod_001","prod_005","prod_002"]', 1, '👟');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_005', 'GPS Running Watch', 'Electronics', 4999, 20, 'Advanced GPS watch with heart rate monitor, pace tracking, and 7-day battery life. Water resistant to 50m.', '["watch","gps","fitness","electronics"]', '["prod_004","prod_006"]', 1, '⌚');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_006', 'Wireless Sport Earbuds', 'Electronics', 1999, 30, 'IPX7 waterproof earbuds with 8-hour battery. Secure ear-hook design for intense workouts.', '["earbuds","music","electronics","wireless"]', '["prod_005","prod_007"]', 1, '🎧');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_007', 'Compression Running Tights', 'Apparel', 1499, 35, 'High-performance compression tights with reflective strips. Muscle support and moisture management.', '["apparel","running","compression","tights"]', '["prod_001","prod_008"]', 1, '👖');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_008', 'Dri-Fit Running T-Shirt', 'Apparel', 799, 50, 'Ultra-light moisture-wicking t-shirt. Flatlock seams to prevent chafing during long runs.', '["apparel","running","tshirt","drifit"]', '["prod_007","prod_001"]', 1, '👕');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_009', 'Running Armband Phone Holder', 'Accessories', 399, 40, 'Adjustable armband for phones up to 6.7 inches. Sweat-proof with key pocket and headphone port.', '["armband","phone","accessories","running"]', '["prod_006","prod_001"]', 1, '📱');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_010', 'Trail Running Backpack 10L', 'Accessories', 1299, 20, 'Lightweight hydration-compatible backpack. Multiple pockets, adjustable chest straps, and reflective accents.', '["backpack","trail","running","hydration"]', '["prod_003","prod_001"]', 1, '🎒');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_011', 'Foam Roller Recovery Kit', 'Recovery', 899, 25, 'High-density foam roller with massage ball and resistance band. Essential post-run recovery bundle.', '["recovery","foam roller","massage","fitness"]', '["prod_012","prod_001"]', 1, '🧘');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_012', 'Electrolyte Hydration Mix (30 sachets)', 'Nutrition', 599, 80, 'Zero-sugar electrolyte mix with sodium, potassium and magnesium. Designed for endurance athletes.', '["nutrition","electrolyte","hydration","endurance"]', '["prod_003","prod_011"]', 1, '⚡');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_013', 'Reflective Running Vest', 'Safety', 699, 30, '360-degree reflective vest for night running. Adjustable fit, lightweight mesh construction.', '["safety","reflective","night","running"]', '["prod_007","prod_008"]', 1, '🦺');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_014', 'Gaming Mechanical Keyboard', 'Gaming', 2999, 15, 'RGB mechanical keyboard with Cherry MX switches. N-key rollover and aluminum frame construction.', '["gaming","keyboard","mechanical","rgb"]', '["prod_015","prod_016"]', 1, '⌨️');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_015', 'Gaming Mouse 16000 DPI', 'Gaming', 1499, 20, 'Precision gaming mouse with 16000 DPI sensor. Programmable buttons and adjustable weight system.', '["gaming","mouse","precision","dpi"]', '["prod_014","prod_016"]', 1, '🖱️');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_016', 'Gaming Headset 7.1 Surround', 'Gaming', 2499, 18, '7.1 surround sound headset with noise-canceling microphone. Memory foam ear cushions for extended sessions.', '["gaming","headset","surround","audio"]', '["prod_014","prod_015"]', 1, '🎮');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_017', 'Large Gaming Mouse Pad', 'Gaming', 599, 40, 'Extended mouse pad 800x300mm. Anti-slip rubber base with stitched edges. Smooth micro-weave surface.', '["gaming","mousepad","accessories"]', '["prod_014","prod_015"]', 1, '🖥️');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_018', 'USB-C Hub 7-in-1', 'Electronics', 1799, 25, '7-in-1 USB-C hub with HDMI 4K, USB 3.0, SD card reader, and 100W PD charging. Aluminum build.', '["electronics","usb","hub","accessories"]', '["prod_014","prod_005"]', 1, '🔌');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_019', 'Yoga Mat Premium 6mm', 'Fitness', 999, 30, 'Non-slip TPE yoga mat with alignment markers. Eco-friendly material with carrying strap included.', '["yoga","mat","fitness","exercise"]', '["prod_011","prod_020"]', 1, '🧘‍♀️');
INSERT OR IGNORE INTO products (id, name, category, price, inventory, description, tags, related_products, discount_allowed, image_url) VALUES ('prod_020', 'Resistance Bands Set (5 levels)', 'Fitness', 499, 45, 'Set of 5 latex resistance bands with door anchor, handles, and ankle straps. Portable gym solution.', '["fitness","bands","resistance","workout"]', '["prod_019","prod_011"]', 1, '💪');
