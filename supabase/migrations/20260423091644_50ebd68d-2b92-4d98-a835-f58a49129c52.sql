-- Aggiorna lo schedule del cron giovedì per la generazione bozze progress update
-- da 10:00 UTC (12:00 ora legale IT) a 11:00 UTC (13:00 ora legale IT)
SELECT cron.alter_job(
  job_id := 21,
  schedule := '0 11 * * 4'
);

-- Verifica esplicita anche del martedì (già corretto: 19:00 UTC = 21:00 ora legale IT)
SELECT cron.alter_job(
  job_id := 20,
  schedule := '0 19 * * 2'
);