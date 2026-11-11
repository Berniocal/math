# Geometry

Česká rýsovací plocha pro výuku geometrie. Otevři `index.html`; není potřeba sestavení ani externí knihovny. Stejné rozložení jako sousední Grafy: nástroje vlevo, vlastnosti pod plochou. Levý i spodní panel lze na počítači zvětšit tažením oddělovače.

## Vkládání a rýsování

- Trojúhelník: zvol úhly a případně rovnoramennost. Rovnostrannost vynutí ostroúhlý typ. Vložení, otočení i následný posun zachovávají přesné vlastnosti, vrcholy se při generování nezaokrouhlují k mřížce.
- Čtyřúhelníky: čtverec, obdélník, kosodélník, kosočtverec, deltoid, lichoběžník. Pravidelné mnohoúhelníky mají 3–40 vrcholů.
- Přímka a úsečka: dvě kliknutí. Rovnoběžka a kolmice: bod a přímka nebo strana útvaru v libovolném pořadí. V průběhu se zobrazují průhledná pravítka, po dokončení krátce zůstanou vidět.
- Kružnice: střed a bod na kružnici. Oblouk: střed, poloha tuhy, pak další stisk a tažení kolem středu. Puštění dokončí oblouk, celá otočka vytvoří kružnici. Kružítko je při kreslení viditelné.
- Přichytávání má samostatné volby pro mřížku, body/průsečíky a díly úseček (poloviny, třetiny, čtvrtiny, pětiny, osminy). Zobrazení mřížky je nezávislé. Konec oblouku se přichytí jen k bodu, který leží na dané kružnici, aby se nezměnil poloměr.
- Body se zobrazují křížkem. Průsečíky fungují pro přímky, úsečky, strany mnohoúhelníků, kružnice i oblouky.

## Úpravy a názvy

Výběrem objektu zpřístupníš barvu, plnou/čárkovanou/čerchovanou čáru, tloušťku, popisek a výplň. Kliknutím na popisek jej přepíšeš, tažením jej přesuneš. Dolní index se zadává podtržítkem: `t_a`, `S_a`, `A_0`.

Automatické názvy rozeznávají těžnice a středy protějších stran, výšky a jejich paty, úhlopříčky čtyřúhelníku (první–třetí vrchol `e`, druhý–čtvrtý `f`). Pokud pata výšky splývá s už pojmenovaným bodem, přidá se rovnocenné označení. Vázané body, rovnoběžky a kolmice sledují své výchozí objekty při posunu. Samostatné vrcholy vložených mnohoúhelníků přesouvají celý útvar, aby jeho vlastnosti zůstaly zachované.

Kolečko přibližuje k poloze myši; mezerník + tažení nebo prostřední tlačítko posouvá plochu. Esc ruší konstrukci. Delete smaže výběr a závislé konstrukce. Ctrl+Z / Ctrl+Y vrací a opakuje úpravy.

Nákres i nastavení přichytávání se ukládají do místního úložiště prohlížeče. Tlačítka Uložit/Otevřít přenášejí JSON; PNG exportuje aktuální výřez ve dvojnásobném rozlišení.

## Kontroly

```sh
node --test geometry/*.test.cjs
```

Testy ověřují vlastnosti tisíců generovaných trojúhelníků, definice čtyřúhelníků, mnohoúhelníky, průsečíky a tečny, orientované oblouky, vazby bodů a přímek, automatické názvy, vracení změn a celý postup kreslení kružítkem v obou směrech.
