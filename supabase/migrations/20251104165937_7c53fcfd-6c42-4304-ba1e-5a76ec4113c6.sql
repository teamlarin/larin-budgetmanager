-- Create enum for contract types
CREATE TYPE public.contract_type AS ENUM ('full-time', 'part-time', 'freelance');

-- Create enum for contract hours period
CREATE TYPE public.contract_hours_period AS ENUM ('daily', 'weekly', 'monthly');

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN hourly_rate numeric DEFAULT 0,
ADD COLUMN contract_type contract_type DEFAULT 'full-time',
ADD COLUMN contract_hours numeric DEFAULT 0,
ADD COLUMN contract_hours_period contract_hours_period DEFAULT 'monthly';