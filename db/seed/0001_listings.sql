-- ============================================================================
-- Phase 2 seed — the 12 demo listings, with the structured fields the browse
-- UI needs (price_eur, area_m2, rooms, posted_at, attributes).
-- Idempotent: clears previously-seeded ('manual') rows, then re-inserts.
-- Run in the Supabase SQL editor after 0002_listings.sql.
-- ============================================================================

delete from public.listings where source = 'manual';  -- cascades to saved_listings

insert into public.listings
  (id, type, title, title_hr, price_eur, price_display, city, area_m2, rooms,
   description, description_hr, images, specs, seller, attributes, posted_at, source, source_url, status)
values
(
  '1', 'sale', 'Modern Studio in City Center', 'Moderni studio u centru grada',
  185000, '€185,000', 'Zagreb, Centar', 38, 0,
  'A beautifully appointed studio apartment in the heart of Zagreb. Fully renovated in 2023 with high-end finishes, this property offers excellent value in a prime location. Features include underfloor heating, a modern fitted kitchen, and floor-to-ceiling windows overlooking the city.',
  'Prekrasno opremljen studio stan u srcu Zagreba. Potpuno renoviran 2023. s vrhunskim materijalima, ova nekretnina nudi izvrsnu vrijednost na premium lokaciji. Značajke uključuju podno grijanje, modernu kuhinju i prozore od poda do stropa s pogledom na grad.',
  ARRAY[
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"38 m²"},{"label":"Floor","labelHr":"Kat","value":"4th of 8","valueHr":"4. od 8"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"1985 (renovated 2023)","valueHr":"1985. (renovirano 2023.)"},{"label":"Heating","labelHr":"Grijanje","value":"Underfloor (electric)","valueHr":"Podno (električno)"},{"label":"Parking","labelHr":"Parking","value":"None","valueHr":"Nema"},{"label":"Energy Class","labelHr":"Energetski razred","value":"B"}]'::jsonb,
  '{"name":"Ana Kovač","phone":"+385 91 234 5678","email":"ana.kovac@nekretnine.hr","agency":"Zagreb Premium Realty"}'::jsonb,
  '{"balcony":false,"parking":false,"furnished":false,"pets":false}'::jsonb,
  '2026-06-10T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '2', 'sale', 'Spacious 2BR with Balcony', 'Prostrani 2-sobni s balkonom',
  245000, '€245,000', 'Zagreb, Maksimir', 72, 2,
  'Bright and airy two-bedroom apartment in the sought-after Maksimir neighborhood, just a 5-minute walk from the park. Features a generous 12 m² balcony, separate kitchen, and spacious living room. Well-maintained building with elevator.',
  'Svijetao i prozračan dvosobni stan u traženom kvartu Maksimir, samo 5 minuta hoda od parka. Stan ima balkon od 12 m², odvojenu kuhinju i prostran dnevni boravak. Dobro održavana zgrada s liftom.',
  ARRAY[
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"72 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"2"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"1"},{"label":"Floor","labelHr":"Kat","value":"3rd of 6","valueHr":"3. od 6"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"1994"},{"label":"Parking","labelHr":"Parking","value":"1 garage space","valueHr":"1 garažno mjesto"},{"label":"Energy Class","labelHr":"Energetski razred","value":"C"}]'::jsonb,
  '{"name":"Marko Jurić","phone":"+385 98 765 4321","email":"marko.juric@realty.hr","agency":"Maksimir Homes"}'::jsonb,
  '{"balcony":true,"parking":true,"furnished":false,"pets":false}'::jsonb,
  '2026-06-17T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '3', 'sale', 'Luxury Penthouse, Panoramic View', 'Luksuzni penthouse, panoramski pogled',
  590000, '€590,000', 'Zagreb, Gornji Grad', 185, 3,
  'An exceptional penthouse on the top floor of a prestigious building in Gornji Grad. Offering 360° views of the Zagreb skyline and Cathedral, finished to the highest standard. Features include a private rooftop terrace, smart home system, and two underground parking spaces.',
  'Izniman penthouse na vrhu prestižne zgrade u Gornjem Gradu. Nudi 360° pogled na panoramu Zagreba i Katedralu, završen prema najvišim standardima. Ima privatnu krovnu terasu, sustav pametnog doma i dva podzemna parkirna mjesta.',
  ARRAY[
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"185 m² + 45 m² terrace","valueHr":"185 m² + 45 m² terasa"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"3"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"2"},{"label":"Floor","labelHr":"Kat","value":"Penthouse (12th)","valueHr":"Penthouse (12. kat)"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"2019"},{"label":"Parking","labelHr":"Parking","value":"2 underground","valueHr":"2 podzemna"},{"label":"Energy Class","labelHr":"Energetski razred","value":"A+"}]'::jsonb,
  '{"name":"Petra Blažić","phone":"+385 91 987 6543","email":"petra.blazic@luxrealty.hr","agency":"Lux Zagreb Properties"}'::jsonb,
  '{"balcony":true,"parking":true,"furnished":false,"pets":false}'::jsonb,
  '2026-05-28T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '4', 'sale', 'Bright 3BR Family Apartment', 'Svijetli 3-sobni obiteljski stan',
  320000, '€320,000', 'Zagreb, Trnje', 95, 3,
  'A wonderful family apartment in the vibrant Trnje neighborhood, close to schools, shops, and excellent transport links. Three bedrooms, large living and dining area, well-equipped kitchen. The building recently underwent full facade renovation.',
  'Odličan obiteljski stan u živahnom kvartu Trnje, blizu škola, trgovina i odlične prometne veze. Tri spavaće sobe, velik dnevni boravak i blagovaonica te dobro opremljena kuhinja. Zgrada je nedavno prošla potpunu obnovu pročelja.',
  ARRAY[
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"95 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"3"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"1"},{"label":"Floor","labelHr":"Kat","value":"2nd of 5","valueHr":"2. od 5"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"1978 (renovated 2018)","valueHr":"1978. (renovirano 2018.)"},{"label":"Parking","labelHr":"Parking","value":"1 outdoor space","valueHr":"1 vanjsko mjesto"},{"label":"Energy Class","labelHr":"Energetski razred","value":"C"}]'::jsonb,
  '{"name":"Ivan Horvat","phone":"+385 95 111 2233","email":"ivan.horvat@dom.hr","agency":"Dom Nekretnine"}'::jsonb,
  '{"balcony":false,"parking":true,"furnished":false,"pets":false}'::jsonb,
  '2026-06-05T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '5', 'sale', 'Cozy 1BR near Bundek Lake', 'Ugodan 1-sobni blizu jezera Bundek',
  159000, '€159,000', 'Zagreb, Bundek', 48, 1,
  'A charming one-bedroom apartment just two blocks from the beautiful Bundek Lake park. Perfect for young professionals or couples. Excellent condition with newly renovated bathroom and kitchen. All amenities within walking distance.',
  'Šarmantan jednosobni stan samo dva bloka od prekrasnog parka jezera Bundek. Savršen za mlade profesionalce ili parove. Odlično stanje s novom kupaonicom i kuhinjom. Svi sadržaji na pješačkoj udaljenosti.',
  ARRAY[
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"48 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"1"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"1"},{"label":"Floor","labelHr":"Kat","value":"1st of 4","valueHr":"1. od 4"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"1988"},{"label":"Parking","labelHr":"Parking","value":"None","valueHr":"Nema"},{"label":"Energy Class","labelHr":"Energetski razred","value":"D"}]'::jsonb,
  '{"name":"Maja Šimić","phone":"+385 92 444 5566","email":"maja.simic@stanovi.hr","agency":"Stanovi Zagreb"}'::jsonb,
  '{"balcony":false,"parking":false,"furnished":false,"pets":false}'::jsonb,
  '2026-06-19T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '6', 'sale', 'Renovated 4BR Villa with Pool', 'Renovirana vila s 4 spavaće sobe i bazenom',
  875000, '€875,000', 'Zagreb, Šestine', 285, 4,
  'A stunning detached villa on the forested slopes of Medvednica, offering complete privacy while remaining only 15 minutes from the city center. Recently renovated throughout with four spacious bedrooms, a large garden, swimming pool, and double garage.',
  'Prekrasna samostojeća vila na šumovitim obroncima Medvednice, koja nudi potpunu privatnost uz samo 15 minuta od centra. Nedavno u potpunosti renovirana, ima četiri prostrane spavaće sobe, veliki vrt, bazen i dvostruku garažu.',
  ARRAY[
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"285 m² + 850 m² garden","valueHr":"285 m² + 850 m² vrt"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"4"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"3"},{"label":"Stories","labelHr":"Katovi","value":"2 + basement","valueHr":"2 + podrum"},{"label":"Year Built","labelHr":"Godina izgradnje","value":"2001 (renovated 2022)","valueHr":"2001. (renovirano 2022.)"},{"label":"Parking","labelHr":"Parking","value":"Double garage + driveway","valueHr":"Dvostruka garaža + prilaz"},{"label":"Energy Class","labelHr":"Energetski razred","value":"B"}]'::jsonb,
  '{"name":"Tomislav Babić","phone":"+385 91 777 8899","email":"tomislav.babic@vilarealty.hr","agency":"Villa Zagreb"}'::jsonb,
  '{"balcony":false,"parking":true,"furnished":false,"pets":false}'::jsonb,
  '2026-04-30T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '7', 'rent', 'Furnished Studio, Bills Included', 'Namješteni studio, režije uključene',
  650, '€650/mo', 'Zagreb, Centar', 32, 0,
  'A cozy and fully furnished studio apartment in the heart of Zagreb, with all utility bills included in the rent. Ideal for students, interns, or professionals on short-term assignments. Just 5 minutes from Ban Jelačić Square with excellent public transport access.',
  'Ugodan i potpuno namješten studio stan u srcu Zagreba, s uključenim svim režijama u najamninu. Idealno za studente, praktikante ili profesionalce. Samo 5 minuta od Trga bana Jelačića s odličnim javnim prijevozom.',
  ARRAY[
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"32 m²"},{"label":"Furnished","labelHr":"Namještaj","value":"Fully furnished","valueHr":"Potpuno namješteno"},{"label":"Bills","labelHr":"Režije","value":"All included","valueHr":"Sve uključeno"},{"label":"Floor","labelHr":"Kat","value":"2nd of 5","valueHr":"2. od 5"},{"label":"Min. Lease","labelHr":"Min. najam","value":"3 months","valueHr":"3 mjeseca"},{"label":"Available","labelHr":"Dostupno","value":"Immediately","valueHr":"Odmah"}]'::jsonb,
  '{"name":"Lucia Modrić","phone":"+385 99 123 4567","email":"lucia.modric@rent.hr","agency":"Zagreb Rentals"}'::jsonb,
  '{"balcony":false,"parking":false,"furnished":true,"pets":false}'::jsonb,
  '2026-06-12T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '8', 'rent', 'Modern 2BR near Tram Stop', 'Moderni 2-sobni blizu tramvajske stanice',
  900, '€900/mo', 'Zagreb, Novi Zagreb', 68, 2,
  'A modern two-bedroom apartment in Novi Zagreb, just 200 meters from the tram stop with direct connections to the city center. Contemporary open-plan living area, fully equipped kitchen, and a sunny terrace. One covered parking space included.',
  'Moderni dvosobni stan u Novom Zagrebu, samo 200 metara od tramvajske stanice s izravnim vezama prema centru. Suvremeni otvoreni dnevni boravak, potpuno opremljena kuhinja i sunčana terasa. Uključeno jedno natkriveno parkirno mjesto.',
  ARRAY[
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"68 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"2"},{"label":"Furnished","labelHr":"Namještaj","value":"Partially furnished","valueHr":"Djelomično namješteno"},{"label":"Parking","labelHr":"Parking","value":"1 covered space","valueHr":"1 natkriveno mjesto"},{"label":"Min. Lease","labelHr":"Min. najam","value":"12 months","valueHr":"12 mjeseci"},{"label":"Available","labelHr":"Dostupno","value":"July 1, 2025","valueHr":"1. srpnja 2025."}]'::jsonb,
  '{"name":"Davor Knežević","phone":"+385 91 555 6677","email":"davor.knezevic@novizbg.hr","agency":"Novi Zagreb Realty"}'::jsonb,
  '{"balcony":true,"parking":true,"furnished":true,"pets":false}'::jsonb,
  '2026-06-18T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '9', 'rent', 'Sunny 1BR with Garden Access', 'Sunčan 1-sobni s pristupom vrtu',
  750, '€750/mo', 'Zagreb, Maksimir', 52, 1,
  'A delightful ground-floor apartment in a low-rise building in Maksimir, featuring direct access to a shared garden. Bright and sunny throughout the day, recently repainted with updated bathroom fixtures. Close to Maksimir Park and Zagreb Zoo.',
  'Divan prizemni stan u niskokatnoj zgradi u Maksimiru, s izravnim pristupom zajedničkom vrtu. Svijetao i sunčan cijeli dan, nedavno obojan s obnovljenom opremom kupaonice. Blizu parka Maksimir i Zoološkog vrta.',
  ARRAY[
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"52 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"1"},{"label":"Furnished","labelHr":"Namještaj","value":"Fully furnished","valueHr":"Potpuno namješteno"},{"label":"Garden","labelHr":"Vrt","value":"Shared access","valueHr":"Zajednički pristup"},{"label":"Pets","labelHr":"Kućni ljubimci","value":"Allowed","valueHr":"Dozvoljeno"},{"label":"Available","labelHr":"Dostupno","value":"Immediately","valueHr":"Odmah"}]'::jsonb,
  '{"name":"Helena Vidović","phone":"+385 95 888 9900","email":"helena.vidovic@maks.hr","agency":"Maksimir Living"}'::jsonb,
  '{"balcony":false,"parking":false,"furnished":true,"pets":true}'::jsonb,
  '2026-05-20T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '10', 'rent', 'Executive Apartment with Parking', 'Poslovni stan s parkingom',
  1200, '€1,200/mo', 'Zagreb, Gornji Grad', 120, 2,
  'A premium executive apartment in the prestigious Gornji Grad district, ideal for executives and diplomats. Fully furnished to a high standard with designer furniture, smart home automation, and concierge service. Two underground parking spaces and private storage included.',
  'Premium poslovni stan u prestižnom kvartu Gornji Grad, idealan za poslovnjake i diplomate. Potpuno namješten s dizajnerskim namještajem, automatizacijom pametnog doma i uslugom portira. Uključena dva podzemna parkirna mjesta i privatna ostava.',
  ARRAY[
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"120 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"2"},{"label":"Furnished","labelHr":"Namještaj","value":"Luxury furnished","valueHr":"Luksuzno namješteno"},{"label":"Parking","labelHr":"Parking","value":"2 underground spaces","valueHr":"2 podzemna mjesta"},{"label":"Smart Home","labelHr":"Pametni dom","value":"Full automation","valueHr":"Potpuna automatizacija"},{"label":"Min. Lease","labelHr":"Min. najam","value":"6 months","valueHr":"6 mjeseci"}]'::jsonb,
  '{"name":"Robert Grgić","phone":"+385 91 000 1122","email":"robert.grgic@luxrent.hr","agency":"Lux Zagreb Rentals"}'::jsonb,
  '{"balcony":false,"parking":true,"furnished":true,"pets":false}'::jsonb,
  '2026-06-01T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '11', 'rent', 'Cozy Attic Flat in Old Town', 'Ugodan mansardni stan u Starom gradu',
  580, '€580/mo', 'Zagreb, Gornji Grad', 41, 1,
  'A unique attic apartment in a historic building in Zagreb''s old town, featuring original wooden beams, exposed brick, and sloped ceilings that give it a unique character. Compact but thoughtfully designed. A great opportunity to experience life in the historic upper town.',
  'Jedinstven mansardni stan u povijesnoj zgradi u starom gradu Zagreba, s originalnim drvenim gredama, izloženom ciglom i kosim stropovima koji mu daju poseban karakter. Kompaktan ali promišljeno dizajniran. Odlična prilika za doživljaj života u gornjem gradu.',
  ARRAY[
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"41 m²"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"1"},{"label":"Furnished","labelHr":"Namještaj","value":"Furnished","valueHr":"Namješteno"},{"label":"Building","labelHr":"Zgrada","value":"Historic (19th c.)","valueHr":"Povijesna (19. st.)"},{"label":"Pets","labelHr":"Kućni ljubimci","value":"On request","valueHr":"Na upit"},{"label":"Available","labelHr":"Dostupno","value":"August 1, 2025","valueHr":"1. kolovoza 2025."}]'::jsonb,
  '{"name":"Mia Bogdanović","phone":"+385 98 333 4455","email":"mia.bogdanovic@starigrad.hr","agency":"Old Town Rentals"}'::jsonb,
  '{"balcony":false,"parking":false,"furnished":true,"pets":false}'::jsonb,
  '2026-06-15T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
),
(
  '12', 'rent', '3BR Family Home near Schools', '3-sobna obiteljska kuća blizu škola',
  1100, '€1,100/mo', 'Zagreb, Trnje', 145, 3,
  'A spacious three-bedroom house in family-friendly Trnje, within the catchment of several highly-rated schools. Features a private garden, garage, and a large basement. Well-maintained and offers plenty of space for a growing family.',
  'Prostrana trosemestrana kuća u obiteljski orijentiranom kvartu Trnje, u blizini nekoliko visoko ocijenjenih škola. Ima privatni vrt, garažu i veliku podrumsku prostoriju. Dobro održavana s puno prostora za rastuću obitelj.',
  ARRAY[
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=600&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format'
  ],
  '[{"label":"Size","labelHr":"Površina","value":"145 m² + garden","valueHr":"145 m² + vrt"},{"label":"Bedrooms","labelHr":"Spavaće sobe","value":"3"},{"label":"Bathrooms","labelHr":"Kupaonice","value":"2"},{"label":"Garden","labelHr":"Vrt","value":"Private, 200 m²","valueHr":"Privatni, 200 m²"},{"label":"Parking","labelHr":"Parking","value":"Garage + driveway","valueHr":"Garaža + prilaz"},{"label":"Min. Lease","labelHr":"Min. najam","value":"12 months","valueHr":"12 mjeseci"}]'::jsonb,
  '{"name":"Stjepan Filipović","phone":"+385 91 666 7788","email":"stjepan.filipovic@dom.hr","agency":"Dom Nekretnine"}'::jsonb,
  '{"balcony":false,"parking":true,"furnished":false,"pets":false}'::jsonb,
  '2026-05-10T09:00:00Z', 'manual', 'https://www.njuskalo.hr', 'active'
);

-- County for the demo listings (all Zagreb) so they join the county filter.
-- (Mirrors db/migrations/0006_county.sql; guarded so this seed still runs if
-- 0006 hasn't been applied yet.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'county'
  ) then
    update public.listings set county = 'Grad Zagreb'
    where source = 'manual' and city like 'Zagreb,%';
  end if;
end $$;
