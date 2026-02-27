
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  lower_query text;
BEGIN
  lower_query := lower(trim(query_text));
  
  -- Only allow SELECT and WITH (CTE) queries
  IF NOT (lower_query LIKE 'select%' OR lower_query LIKE 'with%') THEN
    RAISE EXCEPTION 'Solo query SELECT sono permesse';
  END IF;
  
  -- Block dangerous keywords
  IF lower_query ~ '\y(delete|drop|insert|update|alter|truncate|create|grant|revoke)\y' THEN
    RAISE EXCEPTION 'Query non permessa: contiene operazioni di scrittura';
  END IF;
  
  -- Execute and return as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Only allow service role to call this function (not exposed via API to regular users)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
