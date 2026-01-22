-- Drop the old trigger and function that uses pg_net
DROP TRIGGER IF EXISTS trigger_notify_vendor_on_review ON public.vendor_reviews;
DROP FUNCTION IF EXISTS public.notify_vendor_on_new_review();