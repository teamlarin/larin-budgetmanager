-- Normalize project area values to lowercase to match profiles and team_leader_areas
UPDATE projects SET area = LOWER(area) WHERE area IS NOT NULL AND area != LOWER(area);