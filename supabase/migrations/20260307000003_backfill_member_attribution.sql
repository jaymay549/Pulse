-- ============================================================
-- Backfill member_id on existing vendor_mentions
-- Joins: vendor_mentions -> wam.vendor_mentions_processed (by id)
--        -> wam.messages (first message_id) -> members (by whatsapp_number)
-- ============================================================

CREATE OR REPLACE FUNCTION public.backfill_mention_member_attribution(
  p_limit INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH resolved AS (
    SELECT
      vm.id AS mention_id,
      public.resolve_member_from_message_ids(wmp.message_ids) AS member_id
    FROM public.vendor_mentions vm
    JOIN wam.vendor_mentions_processed wmp ON wmp.id = vm.id
    WHERE vm.member_id IS NULL
      AND wmp.message_ids IS NOT NULL
      AND wmp.message_ids != ''
    LIMIT p_limit
  )
  UPDATE public.vendor_mentions vm
  SET member_id = r.member_id
  FROM resolved r
  WHERE vm.id = r.mention_id
    AND r.member_id IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_mention_member_attribution(INTEGER) TO service_role;
