# Svatba web — větev `demo`

⚠️ **Tuhle větev NIKDY neslučuj do `main`.**

Je to ukázková (portfolio) verze svatebního webu, určená k nahrání na
prezentační web jako živé demo. Oproti `main` se liší takto:

- **anonymizovaní lidé** — Anna & Petr, 12. 6. 2027, řidič Tomáš
  (777 123 456). Žádné skutečné jméno snoubenců ani soukromé
  telefonní číslo.
- **místo a ubytování zůstávají skutečné** (Jitkovský mlýn, Penzion
  Račín) — záměrně. Jsou to veřejné podniky, ne soukromé osoby, a
  ukázka díky tomu obsahuje funkční odkaz na mapu i na web penzionu.
  Konkrétní místo, na které se dá kliknout a nechat si najít trasu,
  působí věrohodněji než obecné vyhledávání.
- **metadata** — bez kanonické adresy a bez absolutních URL na ostrý web,
  navíc `<meta name="robots" content="noindex, nofollow">`, aby ukázka
  nekonkurovala webům klientů ve vyhledávání.
- **obrázky** — převedené do WebP a zmenšené na rozumné rozměry
  (30 MB → 2,5 MB). Originály v plné kvalitě zůstávají v `main`.

`main` je zdroj pravdy a nasazuje se na ostrý web. Pokud se tam něco změní
a má se to promítnout i do ukázky, slučuje se **`main` do `demo`** —
jednosměrně, nikdy naopak.
