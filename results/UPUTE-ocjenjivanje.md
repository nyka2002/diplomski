# Upute za ocjenjivanje relevantnosti

Cilj: za svaki oglas ocijeniti **koliko dobro odgovara upitu** iz stupca **Upit**.
Ocjenom se mjeri kvaliteta poretka koji vraća pretraga (mjere nDCG i Cohenova kappa).

## Tko ocjenjuje

Ocjenjuju **dvije osobe neovisno**:
- osoba A upisuje ocjene u stupac **Ocjena A**,
- osoba B upisuje ocjene u stupac **Ocjena B**,
- **ne gledajte ocjene one druge osobe** dok ocjenjujete (zato su dva stupca).

## Ljestvica ocjena (0–3)

| Ocjena | Značenje | Kada ju dati |
|:---:|---|---|
| **3** | vrlo relevantan | oglas jasno ispunjava ono što se u upitu traži (npr. za „blizu parka" oglas izričito spominje park ili pogled na park; za „u centru grada" nalazi se u centru) |
| **2** | relevantan | dobro odgovara, ali nešto iz upita nije potvrđeno ili je slabije izraženo |
| **1** | djelomično | to jest stan tražene vrste, ali ništa u oglasu ne potvrđuje ključni uvjet upita |
| **0** | nije relevantan | ne odgovara upitu (kriva vrsta, kriva lokacija ili suprotno od traženog) |

Ocjenjuje se **sadržaj oglasa** (naslov, grad, sobe, površina, cijena, a po potrebi
otvoriti poveznicu radi opisa) u odnosu na **smisao upita** — ne doslovno
podudaranje riječi. Redoslijed redaka **nije** poredak pretrage i ne smije utjecati
na ocjenu; svaki oglas ocijeni zasebno.

## Primjeri

Upit: **„svijetao miran stan blizu parka"**
- oglas „Svijetao stan uz Bundek, pogled na park" → **3**
- oglas „Dvosoban stan, mirna ulica, blizu zelenila" → **2** (miran + zelenilo, park nije potvrđen)
- oglas „Dvosoban stan u centru, kod glavne ceste" → **1** (stan jest, ali ništa ne podupire „svijetao/miran/park")
- oglas „Poslovni prostor" ili „kuća" → **0**

## Kako ispuniti

1. Datoteku `relevance-sheet.csv` otvori kao tablicu (vidi dolje) radi preglednosti.
2. Popuni **oba** stupca `Ocjena A (0-3)` i `Ocjena B (0-3)` za **sve** retke, brojem 0–3.
3. **Ne mijenjaj** posljednji stupac `id (ne mijenjaj)` ni nazive stupaca — po njima
   se ocjene poslije spajaju s rezultatima.
4. Spremi datoteku (ako je uređivana u Excelu/Numbersu: izvoz natrag u CSV, UTF-8).

## Napomena o poveznicama

Poveznice vode na `localhost:3000`, pa rade **samo dok je aplikacija pokrenuta**
(`npm run dev` u mapi projekta). Ako poveznica ne radi, pokreni aplikaciju pa
osvježi. Većina se oglasa može ocijeniti i bez otvaranja — iz naslova, grada,
broja soba, površine i cijene u retku; poveznicu otvori kad ti treba opis.
Ocjenjivanje obavi ubrzo nakon primitka tablice, jer se s vremenom neki oglasi
skidaju s izvora pa im poveznica prestane raditi.

## Kako je otvoriti u preglednijem obliku

- **Numbers (Mac):** Datoteka → Otvori → odaberi `relevance-sheet.csv`. Numbers ga
  sam složi u tablicu; na kraju: Datoteka → Izvezi u → CSV.
- **Excel:** Podaci → Iz teksta/CSV-a → odaberi datoteku → razdvajač zarez, kodiranje
  UTF-8. Spremi natrag kao CSV (UTF-8).
- **Google Sheets:** Datoteka → Uvezi → Prenesi → razdvajač zarez. Na kraju: Datoteka
  → Preuzmi → CSV.
