-- Create a function to notify vendors when a new review is added
CREATE OR REPLACE FUNCTION public.notify_vendor_on_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use pg_net to call the edge function asynchronously
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-vendor-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block the insert
    RAISE WARNING 'Failed to send vendor notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to fire on new review inserts
CREATE TRIGGER trigger_notify_vendor_on_review
AFTER INSERT ON public.vendor_reviews
FOR EACH ROW
EXECUTE FUNCTION public.notify_vendor_on_new_review();