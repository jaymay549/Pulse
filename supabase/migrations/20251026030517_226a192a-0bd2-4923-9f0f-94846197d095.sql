-- Create a function to send confirmation email via edge function
CREATE OR REPLACE FUNCTION public.send_signup_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hook_secret text;
  payload jsonb;
BEGIN
  -- Get the hook secret
  hook_secret := current_setting('app.settings.send_email_hook_secret', true);
  
  -- Prepare payload for the edge function
  payload := jsonb_build_object(
    'user', jsonb_build_object('email', NEW.email),
    'email_data', jsonb_build_object(
      'token', NEW.confirmation_token,
      'token_hash', encode(digest(NEW.confirmation_token, 'sha256'), 'hex'),
      'redirect_to', current_setting('app.settings.site_url', true),
      'email_action_type', 'signup'
    )
  );
  
  -- Call the edge function using pg_net (if available)
  -- Note: This requires pg_net extension to be enabled
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-confirmation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'webhook-signature', hook_secret
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block signup
    RAISE WARNING 'Failed to send confirmation email: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to send email on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;
CREATE TRIGGER on_auth_user_created_send_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.confirmation_token IS NOT NULL)
  EXECUTE FUNCTION public.send_signup_confirmation_email();