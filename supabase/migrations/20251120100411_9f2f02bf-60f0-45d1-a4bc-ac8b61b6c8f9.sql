-- Fix RLS recursive queries by using the existing is_approved_user() function
-- This prevents performance issues and potential infinite recursion

-- Update projects table policies
DROP POLICY IF EXISTS "Only approved users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Only approved users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Only approved users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Only approved users can delete projects" ON public.projects;

CREATE POLICY "Only approved users can insert projects" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (public.is_approved_user(auth.uid()));

CREATE POLICY "Only approved users can view projects" ON public.projects
FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Only approved users can update projects" ON public.projects
FOR UPDATE TO authenticated
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Only approved users can delete projects" ON public.projects
FOR DELETE TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update budget_items table policies
DROP POLICY IF EXISTS "Only approved users can manage budget items" ON public.budget_items;

CREATE POLICY "Only approved users can manage budget items" ON public.budget_items
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update budget_templates table policies
DROP POLICY IF EXISTS "Only approved users can manage budget templates" ON public.budget_templates;

CREATE POLICY "Only approved users can manage budget templates" ON public.budget_templates
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update clients table policies
DROP POLICY IF EXISTS "Only approved users can manage clients" ON public.clients;

CREATE POLICY "Only approved users can manage clients" ON public.clients
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update products table policies
DROP POLICY IF EXISTS "Only approved users can manage products" ON public.products;

CREATE POLICY "Only approved users can manage products" ON public.products
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update services table policies
DROP POLICY IF EXISTS "Only approved users can manage services" ON public.services;

CREATE POLICY "Only approved users can manage services" ON public.services
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update levels table policies
DROP POLICY IF EXISTS "Only approved users can manage levels" ON public.levels;

CREATE POLICY "Only approved users can manage levels" ON public.levels
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update activity_categories table policies
DROP POLICY IF EXISTS "Only approved users can manage activity categories" ON public.activity_categories;

CREATE POLICY "Only approved users can manage activity categories" ON public.activity_categories
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));

-- Update quotes table policies
DROP POLICY IF EXISTS "Only approved users can manage quotes" ON public.quotes;

CREATE POLICY "Only approved users can manage quotes" ON public.quotes
FOR ALL TO authenticated
USING (public.is_approved_user(auth.uid()));