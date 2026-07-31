-- Collapse the "Novi Zagreb" halves into a single kvart.
--
-- Novi Zagreb is officially two city districts ("Novi Zagreb - istok" and
-- "Novi Zagreb - zapad"); in the app they are treated as one neighborhood
-- "Novi Zagreb" (mirrors splitLocation() + fetchLocations()). This backfills
-- existing rows so the browse filter offers a single "Novi Zagreb" kvart.
--
-- Idempotent: safe to re-run.
update public.listings
set city = 'Zagreb, Novi Zagreb'
where city like 'Zagreb, Novi Zagreb%'
  and city <> 'Zagreb, Novi Zagreb';
