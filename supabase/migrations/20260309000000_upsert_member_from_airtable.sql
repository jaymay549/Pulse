-- Upsert function for Airtable → Supabase member sync.
-- Matches on email (primary) or whatsapp_number (fallback).
-- Preserves Supabase-only fields (clerk_user_id, id, created_at, updated_at).
-- Uses COALESCE to skip null Airtable values on update.

CREATE OR REPLACE FUNCTION public.upsert_member_from_airtable(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_whatsapp_number TEXT,
  p_dealership_name TEXT,
  p_role TEXT,
  p_role_band TEXT,
  p_oems TEXT[],
  p_rooftops INTEGER,
  p_city TEXT,
  p_state TEXT,
  p_zip TEXT,
  p_region TEXT,
  p_tier TEXT,
  p_cohort_id TEXT,
  p_status TEXT,
  p_amount_paid NUMERIC,
  p_payment_status TEXT,
  p_stripe_customer_id TEXT,
  p_biggest_focus TEXT,
  p_area_of_interest TEXT,
  p_annual_revenue TEXT,
  p_volunteer_group_leader BOOLEAN,
  p_source_ref TEXT,
  p_additional_notes TEXT
)
RETURNS TEXT  -- 'inserted' | 'updated' | 'skipped'
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_result TEXT;
BEGIN
  -- Try to find existing member by email first, then whatsapp_number
  SELECT id INTO v_existing_id
    FROM public.members
   WHERE (p_email IS NOT NULL AND lower(email) = lower(p_email))
      OR (p_whatsapp_number IS NOT NULL AND whatsapp_number = p_whatsapp_number)
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing, preserving Supabase-only fields, skip nulls from Airtable
    UPDATE public.members SET
      name              = COALESCE(p_name, name),
      email             = COALESCE(p_email, email),
      phone             = COALESCE(p_phone, phone),
      whatsapp_number   = COALESCE(p_whatsapp_number, whatsapp_number),
      dealership_name   = COALESCE(p_dealership_name, dealership_name),
      role              = COALESCE(p_role, role),
      role_band         = COALESCE(p_role_band, role_band),
      oems              = CASE WHEN p_oems IS NOT NULL AND array_length(p_oems, 1) > 0 THEN p_oems ELSE oems END,
      rooftops          = COALESCE(p_rooftops, rooftops),
      city              = COALESCE(p_city, city),
      state             = COALESCE(p_state, state),
      zip               = COALESCE(p_zip, zip),
      region            = COALESCE(p_region, region),
      tier              = COALESCE(p_tier, tier),
      cohort_id         = COALESCE(p_cohort_id, cohort_id),
      status            = COALESCE(p_status, status),
      amount_paid       = COALESCE(p_amount_paid, amount_paid),
      payment_status    = COALESCE(p_payment_status, payment_status),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      biggest_focus     = COALESCE(p_biggest_focus, biggest_focus),
      area_of_interest  = COALESCE(p_area_of_interest, area_of_interest),
      annual_revenue    = COALESCE(p_annual_revenue, annual_revenue),
      volunteer_group_leader = COALESCE(p_volunteer_group_leader, volunteer_group_leader),
      source_ref        = COALESCE(p_source_ref, source_ref),
      additional_notes  = COALESCE(p_additional_notes, additional_notes)
    WHERE id = v_existing_id;
    v_result := 'updated';
  ELSE
    -- Insert new member
    INSERT INTO public.members (
      name, email, phone, whatsapp_number, dealership_name,
      role, role_band, oems, rooftops,
      city, state, zip, region,
      tier, cohort_id, status, amount_paid, payment_status, stripe_customer_id,
      biggest_focus, area_of_interest, annual_revenue,
      volunteer_group_leader, source_ref, additional_notes
    ) VALUES (
      COALESCE(p_name, 'Unknown'), p_email, p_phone, p_whatsapp_number, p_dealership_name,
      p_role, p_role_band, COALESCE(p_oems, '{}'), p_rooftops,
      p_city, p_state, p_zip, p_region,
      COALESCE(p_tier, 'free'), p_cohort_id, COALESCE(p_status, 'active'),
      p_amount_paid, p_payment_status, p_stripe_customer_id,
      p_biggest_focus, p_area_of_interest, p_annual_revenue,
      COALESCE(p_volunteer_group_leader, false), p_source_ref, p_additional_notes
    );
    v_result := 'inserted';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_member_from_airtable TO service_role;
