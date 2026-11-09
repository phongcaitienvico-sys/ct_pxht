-- ==============================================================================
-- MIGRATION 2026-11: Them "Ma don hang" va "Ngay xuat hang" cho Danh muc san pham
-- Dan toan bo file nay vao Supabase SQL Editor va bam Run. An toan khi chay lai nhieu lan.
-- ==============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS order_code TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ship_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_ship_date ON products(ship_date);

-- Bao PostgREST nap lai cau truc bang de API nhan cot moi ngay lap tuc
NOTIFY pgrst, 'reload schema';

