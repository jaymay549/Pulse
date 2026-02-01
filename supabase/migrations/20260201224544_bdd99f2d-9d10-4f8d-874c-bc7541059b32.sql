-- Drop all tables (in correct order due to foreign key dependencies)
DROP TABLE IF EXISTS public.vendor_responses CASCADE;
DROP TABLE IF EXISTS public.vendor_entry_stats CASCADE;
DROP TABLE IF EXISTS public.vendor_reviews CASCADE;
DROP TABLE IF EXISTS public.vendor_profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop the custom types
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.review_type CASCADE;

-- Drop the custom functions
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.send_signup_confirmation_email() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;