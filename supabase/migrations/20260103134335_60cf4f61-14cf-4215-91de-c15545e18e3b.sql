-- Add 'coordinator' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'coordinator' AFTER 'team_leader';