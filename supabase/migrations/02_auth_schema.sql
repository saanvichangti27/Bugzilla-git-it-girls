-- Person B: Users & Roles Table
-- This table extends the built-in Supabase `auth.users` table 
-- to hold our custom fields like 'name' and the 3-role model.

CREATE TABLE IF NOT EXISTS public.users (
  -- The ID should match the Supabase auth.users ID exactly
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  
  -- Roles: reporter, developer, admin
  role VARCHAR NOT NULL DEFAULT 'reporter',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note for Person B: 
-- You should seed your very first 'admin' user by signing up normally, 
-- and then running this SQL command in the Supabase SQL editor:
-- UPDATE public.users SET role = 'admin' WHERE email = 'your.email@example.com';

-- ==============================================================================
-- OPTIONAL AUTOMATION:
-- If Person B wants Supabase to automatically create the public.users row 
-- whenever someone signs up via Supabase Auth, they can run this trigger:
-- ==============================================================================

/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'Unknown User'), 
    'reporter'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
*/
