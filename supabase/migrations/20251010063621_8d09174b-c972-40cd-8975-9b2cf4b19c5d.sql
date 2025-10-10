-- Approve alessandro@larin.it and set as admin
UPDATE public.profiles 
SET approved = true 
WHERE email = 'alessandro@larin.it';

-- Update role to admin
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'alessandro@larin.it');