CREATE OR REPLACE VIEW public.revenue_mix AS
SELECT
  date_part('year', accepted_at)::integer AS anno,
  COALESCE(sum(valore_venduto) FILTER (WHERE product_nature = 'ricorrente'), 0)::numeric(12,2) AS ricorrente,
  COALESCE(sum(valore_venduto) FILTER (WHERE product_nature <> 'ricorrente'), 0)::numeric(12,2) AS una_tantum,
  COALESCE(sum(valore_venduto), 0)::numeric(12,2) AS totale,
  CASE WHEN COALESCE(sum(valore_venduto), 0) > 0
       THEN round(100 * COALESCE(sum(valore_venduto) FILTER (WHERE product_nature = 'ricorrente'), 0) / sum(valore_venduto), 1)
       ELSE 0
  END AS quota_ricorrente_percentuale
FROM public.sales_lines
GROUP BY 1;

ALTER VIEW public.revenue_mix SET (security_invoker = on);
GRANT SELECT ON public.revenue_mix TO authenticated;

CREATE OR REPLACE VIEW public.sales_by_salesperson AS
SELECT
  date_part('year', sl.accepted_at)::integer AS anno,
  sl.salesperson_id,
  COALESCE(pr.full_name, '(non attribuito)') AS salesperson_name,
  count(DISTINCT sl.offer_id) AS offerte,
  COALESCE(sum(sl.valore_venduto), 0)::numeric(12,2) AS venduto,
  COALESCE(sum(sl.valore_venduto) FILTER (WHERE sl.product_nature = 'ricorrente'), 0)::numeric(12,2) AS venduto_ricorrente
FROM public.sales_lines sl
LEFT JOIN public.profiles pr ON pr.id = sl.salesperson_id
GROUP BY 1, 2, 3;

ALTER VIEW public.sales_by_salesperson SET (security_invoker = on);
GRANT SELECT ON public.sales_by_salesperson TO authenticated;

CREATE OR REPLACE VIEW public.offer_conversion AS
WITH per_offerta AS (
  SELECT
    o.id AS offer_id,
    o.year,
    o.origin,
    COALESCE(c.account_user_id, (SELECT v.created_by FROM public.offer_versions v WHERE v.offer_id = o.id ORDER BY v.version_number LIMIT 1)) AS salesperson_id,
    (SELECT v.status FROM public.offer_versions v
      WHERE v.offer_id = o.id
      ORDER BY CASE v.status
                 WHEN 'accettata' THEN 1 WHEN 'sostituita' THEN 2
                 WHEN 'rifiutata' THEN 3 WHEN 'scaduta' THEN 4
                 WHEN 'vista' THEN 5 WHEN 'inviata' THEN 6
                 WHEN 'in_approvazione' THEN 7 WHEN 'superata' THEN 8
                 ELSE 9 END
      LIMIT 1) AS stato,
    (SELECT max(v.offered_total) FROM public.offer_versions v WHERE v.offer_id = o.id) AS valore,
    (SELECT min(e.occurred_at) FROM public.offer_events e
      JOIN public.offer_versions v ON v.id = e.offer_version_id
      WHERE v.offer_id = o.id AND e.new_status = 'inviata') AS inviata_il,
    (SELECT min(e.occurred_at) FROM public.offer_events e
      JOIN public.offer_versions v ON v.id = e.offer_version_id
      WHERE v.offer_id = o.id AND e.new_status = 'accettata') AS accettata_il
  FROM public.offers o
  JOIN public.clients c ON c.id = o.client_id
)
SELECT
  year AS anno,
  origin,
  salesperson_id,
  count(*) FILTER (WHERE stato IN ('inviata', 'vista', 'accettata', 'sostituita', 'rifiutata', 'scaduta', 'superata')) AS offerte_uscite,
  count(*) FILTER (WHERE stato IN ('accettata', 'sostituita')) AS accettate,
  count(*) FILTER (WHERE stato = 'rifiutata') AS rifiutate,
  count(*) FILTER (WHERE stato = 'scaduta') AS scadute,
  count(*) FILTER (WHERE stato IN ('inviata', 'vista')) AS in_attesa,
  CASE WHEN count(*) FILTER (WHERE stato IN ('inviata', 'vista', 'accettata', 'sostituita', 'rifiutata', 'scaduta', 'superata')) > 0
       THEN round(100.0 * count(*) FILTER (WHERE stato IN ('accettata', 'sostituita'))
                  / count(*) FILTER (WHERE stato IN ('inviata', 'vista', 'accettata', 'sostituita', 'rifiutata', 'scaduta', 'superata')), 1)
  END AS tasso_conversione_percentuale,
  round(avg(EXTRACT(EPOCH FROM (accettata_il - inviata_il)) / 86400)
        FILTER (WHERE accettata_il IS NOT NULL AND inviata_il IS NOT NULL), 1) AS giorni_medi_alla_firma,
  COALESCE(sum(valore) FILTER (WHERE stato IN ('accettata', 'sostituita')), 0)::numeric(12,2) AS valore_accettato,
  COALESCE(sum(valore) FILTER (WHERE stato IN ('inviata', 'vista')), 0)::numeric(12,2) AS valore_in_attesa
FROM per_offerta
GROUP BY 1, 2, 3;

COMMENT ON VIEW public.offer_conversion IS 'Tasso di conversione e tempo medio dall''invio alla firma (FR-37). Il denominatore e lo stato raggiunto e non l''evento registrato.';

ALTER VIEW public.offer_conversion SET (security_invoker = on);
GRANT SELECT ON public.offer_conversion TO authenticated;