-- PRICE BOOK + INVOICE DISCOUNT SUPPORT
-- Adds:
--   - price_book classification + discount metadata (percent/fixed)
--   - invoice_items line typing + price_book linkage
--   - helper functions to calculate + apply a discount as a negative invoice line
--
-- Notes:
-- - Additive/idempotent where possible (safe to run on live).
-- - Existing code continues to work if it ignores the new columns.
-- - This does NOT automatically recalculate invoices.total_amount/subtotal; it only manages invoice_items lines.

-- =========================================================
-- PRICE BOOK ENHANCEMENTS
-- =========================================================

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'service';
ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS discount_type text;
ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2);
ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS discount_eligible boolean NOT NULL DEFAULT true;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_book_item_type_check'
  ) THEN
    ALTER TABLE public.price_book
      ADD CONSTRAINT price_book_item_type_check
      CHECK (item_type IN ('service', 'fee', 'discount'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_book_discount_type_check'
  ) THEN
    ALTER TABLE public.price_book
      ADD CONSTRAINT price_book_discount_type_check
      CHECK (discount_type IS NULL OR discount_type IN ('percent', 'fixed'));
  END IF;
END $$;
-- Guardrail:
-- - If item_type = discount, require discount_type + discount_value
-- - If percent, require 0..100
-- - If fixed, require >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_book_discount_fields_check'
  ) THEN
    ALTER TABLE public.price_book
      ADD CONSTRAINT price_book_discount_fields_check
      CHECK (
        (item_type <> 'discount')
        OR
        (
          item_type = 'discount'
          AND discount_type IS NOT NULL
          AND discount_value IS NOT NULL
          AND (
            (discount_type = 'percent' AND discount_value >= 0 AND discount_value <= 100)
            OR
            (discount_type = 'fixed' AND discount_value >= 0)
          )
        )
      );
  END IF;
END $$;
-- Best-effort backfill for existing fixed discount-style rows.
-- (This repo historically represented discounts via negative base_price/category='discount'.)
UPDATE public.price_book
SET
  item_type = 'discount',
  discount_type = COALESCE(discount_type, 'fixed'),
  discount_value = COALESCE(discount_value, ABS(base_price)),
  discount_eligible = false
WHERE
  COALESCE(item_type, '') <> 'discount'
  AND (
    COALESCE(category, '') = 'discount'
    OR COALESCE(base_price, 0) < 0
  );
-- Ensure non-discount items default to service classification.
UPDATE public.price_book
SET item_type = 'service'
WHERE item_type IS NULL;
-- =========================================================
-- SEED: MILITARY DISCOUNT (10% eligible subtotal)
-- =========================================================

INSERT INTO public.price_book (
  id,
  tenant_id,
  code,
  name,
  category,
  base_price,
  price_type,
  description,
  active,
  created_at,
  item_type,
  discount_type,
  discount_value,
  discount_eligible
)
VALUES (
  '8a9bbab9-68c5-4cd3-9a86-6a05be5c68e6',
  'default',
  'DISC-MIL-10PCT',
  'Military Discount',
  'discount',
  0.00,
  'percent',
  '10 percent discount for eligible military customers.',
  true,
  NOW(),
  'discount',
  'percent',
  10.00,
  false
)
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  price_type = EXCLUDED.price_type,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  item_type = EXCLUDED.item_type,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  discount_eligible = EXCLUDED.discount_eligible;
-- Optional examples: only fill description when blank/missing.
UPDATE public.price_book
SET description = 'Professional air duct cleaning focused on removing dust, debris, and buildup from the HVAC duct system.'
WHERE name = 'Air Duct Cleaning'
  AND COALESCE(NULLIF(description, ''), '') = '';
UPDATE public.price_book
SET description = 'Professional dryer vent cleaning to remove lint buildup, improve airflow, and reduce fire risk.'
WHERE name = 'Dryer Vent Cleaning'
  AND COALESCE(NULLIF(description, ''), '') = '';
UPDATE public.price_book
SET description = 'Treatment applied to key HVAC components to support cleaner system conditions.'
WHERE name = 'Air Handler Sanitization'
  AND COALESCE(NULLIF(description, ''), '') = '';
UPDATE public.price_book
SET description = 'Deep cleaning of blower components and evaporator coil to improve cleanliness and system performance.'
WHERE name = 'Blower and A-Coil Cleaning'
  AND COALESCE(NULLIF(description, ''), '') = '';
UPDATE public.price_book
SET description = 'Travel charge applied for service locations outside the standard operating zone.'
WHERE name = 'Travel Charge'
  AND COALESCE(NULLIF(description, ''), '') = '';
-- =========================================================
-- INVOICE ITEMS: LINE TYPING + PRICE BOOK LINK
-- =========================================================

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'service';
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS source_price_book_id uuid;
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_items_line_type_check'
  ) THEN
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT invoice_items_line_type_check
      CHECK (line_type IN ('service', 'fee', 'discount'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_items_source_price_book_fkey'
  ) THEN
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT invoice_items_source_price_book_fkey
      FOREIGN KEY (source_price_book_id)
      REFERENCES public.price_book(id)
      ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_sort_order_idx
  ON public.invoice_items (invoice_id, sort_order, created_at, id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_line_type_idx
  ON public.invoice_items (invoice_id, line_type);
-- =========================================================
-- FUNCTIONS: DISCOUNT CALCULATION + APPLICATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.calculate_invoice_discount_amount(
  p_invoice_id uuid,
  p_discount_price_book_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discount_type text;
  v_discount_value numeric(10,2);
  v_eligible_subtotal numeric(12,2) := 0;
BEGIN
  -- Get discount rule from price_book
  SELECT
    discount_type,
    discount_value
  INTO
    v_discount_type,
    v_discount_value
  FROM public.price_book
  WHERE id = p_discount_price_book_id
    AND item_type = 'discount';

  IF v_discount_type IS NULL OR v_discount_value IS NULL THEN
    RAISE EXCEPTION 'Selected price_book item is not a valid discount';
  END IF;

  -- Sum only eligible, non-discount invoice lines
  SELECT COALESCE(SUM(CASE WHEN ii.total_price > 0 THEN ii.total_price ELSE 0 END), 0)
  INTO v_eligible_subtotal
  FROM public.invoice_items ii
  LEFT JOIN public.price_book pb
    ON pb.id = ii.source_price_book_id
  WHERE ii.invoice_id = p_invoice_id
    AND ii.line_type IN ('service', 'fee')
    AND COALESCE(pb.discount_eligible, true) = true;

  IF v_discount_type = 'percent' THEN
    RETURN ROUND(v_eligible_subtotal * (v_discount_value / 100.0), 2);
  ELSIF v_discount_type = 'fixed' THEN
    RETURN LEAST(v_discount_value, v_eligible_subtotal);
  ELSE
    RAISE EXCEPTION 'Unsupported discount type: %', v_discount_type;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.apply_invoice_discount(
  p_invoice_id uuid,
  p_discount_price_book_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discount_name text;
  v_discount_description text;
  v_discount_amount numeric(10,2);
BEGIN
  SELECT
    name,
    description
  INTO
    v_discount_name,
    v_discount_description
  FROM public.price_book
  WHERE id = p_discount_price_book_id
    AND item_type = 'discount';

  IF v_discount_name IS NULL THEN
    RAISE EXCEPTION 'Invalid discount price book item';
  END IF;

  v_discount_amount := public.calculate_invoice_discount_amount(
    p_invoice_id,
    p_discount_price_book_id
  );

  -- Remove prior instance of this exact discount
  DELETE FROM public.invoice_items
  WHERE invoice_id = p_invoice_id
    AND line_type = 'discount'
    AND source_price_book_id = p_discount_price_book_id;

  -- Only insert if there is a real amount to discount
  IF v_discount_amount > 0 THEN
    INSERT INTO public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      total_price,
      line_type,
      source_price_book_id,
      sort_order
    )
    VALUES (
      p_invoice_id,
      COALESCE(NULLIF(v_discount_name, ''), COALESCE(NULLIF(v_discount_description, ''), 'Discount')),
      1,
      -v_discount_amount,
      -v_discount_amount,
      'discount',
      p_discount_price_book_id,
      999
    );
  END IF;
END;
$$;
