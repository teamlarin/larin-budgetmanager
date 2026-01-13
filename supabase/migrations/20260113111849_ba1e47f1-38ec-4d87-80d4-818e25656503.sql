-- Normalize area values: capitalize first letter, lowercase the rest
UPDATE projects
SET area = CONCAT(UPPER(LEFT(area, 1)), LOWER(SUBSTRING(area, 2)))
WHERE area IS NOT NULL;

UPDATE budgets
SET area = CONCAT(UPPER(LEFT(area, 1)), LOWER(SUBSTRING(area, 2)))
WHERE area IS NOT NULL;