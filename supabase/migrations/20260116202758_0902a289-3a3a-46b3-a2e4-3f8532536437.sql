-- Drop the foreign key constraint so we can pre-create profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Update the handle_new_user trigger to link existing profiles by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_profile_id uuid;
BEGIN
  -- Check if a profile already exists with this email (pre-seeded from Airtable)
  SELECT id INTO existing_profile_id 
  FROM public.profiles 
  WHERE email = NEW.email;
  
  IF existing_profile_id IS NOT NULL THEN
    -- Update the existing profile to link to the new auth user
    UPDATE public.profiles
    SET 
      id = NEW.id,
      first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
      last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name)
    WHERE email = NEW.email;
  ELSE
    -- Create new profile with free tier
    INSERT INTO public.profiles (id, email, tier, first_name, last_name)
    VALUES (
      NEW.id, 
      NEW.email, 
      'free',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, profiles.last_name);
  END IF;
  
  -- Insert default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;