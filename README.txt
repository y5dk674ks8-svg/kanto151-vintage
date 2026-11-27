KANTO 151 VINTAGE v2.1

Nieuw:
- Snelle setknoppen voor Engelse en Japanse vintage reeksen.
- Japanse setnamen bij zoeken in de Japanse TCGdex-catalogus.
- Alleen sets met een releasejaar 1996–2002 worden standaard getoond.
- Setresultaten tonen releasedatum.
- 'Alleen Pokémon' filter is geactiveerd op basis van Kanto-Pokémonnamen.
- OCR probeert Engelse én Japanse tekst (eng+jpn); Japanse OCR kan extra downloadtijd vragen.
- Overige functies van v2.0 behouden.

Beperkingen:
- OCR is een hulpmiddel en identificeert niet betrouwbaar de exacte kaart, set of druk.
- Controleer Pokémon, set, kaartnummer, taal en variant vóór opslaan.
- TCGdex is community-onderhouden; Japanse vintage dekking kan per kaart verschillen.
- Lokale opslag blijft browsergebonden. Exporteer back-ups.
- API en OCR moeten op een HTTPS-site op een echte iPhone worden getest.

Installatie:
1. Publiceer de inhoud van deze map op een HTTPS-host.
2. Open de URL in Safari op iPhone.
3. Deel -> Zet op beginscherm.


OFFLINE SCANNER BRANCH (in ontwikkeling)
- Offline catalogusdownload toegevoegd via offline.js.
- Set- en kaartmetadata worden per taal lokaal opgeslagen in IndexedDB.
- De catalogus-API leest eerst uit de lokale cache en gebruikt internet alleen voor ontbrekende records.
- Download vanuit Meer > Offline kaartcatalogus terwijl je internet hebt; laat de pagina open.
- Dit is nog geen volledig offline scanner: kaartafbeeldingen en de OCR-engine worden in volgende stappen lokaal beschikbaar gemaakt.
- De hoofdbranch/main is niet aangepast.
