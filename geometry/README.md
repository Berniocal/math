# Geometry

Česká rýsovací plocha pro výuku geometrie. Otevři `index.html`; funguje bez sestavení a externích knihoven. Nástroje jsou vlevo v rozbalovacích skupinách, vlastnosti pod plochou. Stav rozbalení panelů se pamatuje v prohlížeči.

## Útvary a změna rozměrů

- Trojúhelník: obecný, ostroúhlý, pravoúhlý nebo tupoúhlý; lze přidat rovnoramennost. Rovnostrannost vynutí ostroúhlý typ.
- Čtyřúhelníky: čtverec, obdélník, kosodélník, kosočtverec, deltoid. Tlačítko Lichoběžník nabízí obecný, rovnoramenný a pravoúhlý typ.
- Pravidelné mnohoúhelníky: 3–40 vrcholů.

Tažení vrcholu standardně mění velikost celého útvaru při zachování poměru stran. Vypnutím volby „Při tažení vrcholu zachovat poměr stran“ lze měnit jednotlivé rozměry při zachování druhu útvaru. Obdélník a kosodélník lze měnit v obou rozměrech, kosočtverec pomocí délek úhlopříček. Čtverec, rovnostranný/pravoúhlý rovnoramenný trojúhelník a pravidelný mnohoúhelník se mění podobností. U ostatních trojúhelníků se hlídá zvolený typ úhlů a rovnost ramen. Tažení vnitřku přesouvá celý útvar. Geometrické vlastnosti mají přednost před zaokrouhlením vrcholů do mřížky.

Kliknutím na druh útvaru se zapne náhled na myši. Kliknutí do plochy jej vloží; na dotykovém zařízení jej lze přidržet, posunout a vložit až uvolněním prstu. Další kliknutí vloží stejný útvar se stejnými rozměry, natočením a barvou. Esc nebo Vybrat a upravit režim opustí. Základní nástroje, trojúhelníky a čtyřúhelníky mají rozbalovací skupiny; pravidelný n-úhelník samostatné tlačítko.

Před vložením lze zapnout „Zadat rozměry v cm“. Rovnostranný trojúhelník a čtverec vyžadují jednu stranu, obdélník dvě, obecný trojúhelník tři, pravoúhlý dvě odvěsny; rovnoramenný základnu a rameno. Další útvary nabízejí nezbytné strany, výšku či úhel. Neplatné nebo neslučitelné rozměry blokují vložení a mají konkrétní vysvětlení. Přesné rozměry neovlivňuje posuvník náhodné počáteční velikosti ani přichytávání jednotlivých vrcholů.

Natočení před vložením se nastavuje u plochy posuvníkem, tlačítky ±15° nebo klávesami R a Shift+R. Po vložení se útvar otáčí tažením úchytu ⟳ nad útvarem (Shift zaokrouhluje po 15°) nebo tlačítky ve vlastnostech. Otáčení ani podobnostní změna velikosti nenaruší navázané konstrukce. Obojí podporuje vracení změn a kroky konstrukce.

## Rýsování v centimetrech

1 jednotka nákresu = 1 cm. Velikost na obrazovce závisí na přiblížení a nejde o kalibrované fyzické centimetry monitoru.

Mřížku lze zobrazit i skrýt nezávisle na přichytávání; oka jsou 1 mm, 5 mm, 1 cm, 2 cm nebo 5 cm. Kreslení úseček nabízí volnou nebo předem zadanou pevnou délku. Při volbě konce se zobrazuje délka v cm. Volnou délku lze zaokrouhlovat po 1 mm, 5 mm či 1 cm, přičemž existující bod/průsečík a mřížka mají přednost. Pro radiální délkový krok vypni přichytávání k mřížce.

Ve vlastnostech úsečky lze délku dodatečně zadat a uzamknout. Volný koncový bod se pak otáčí kolem druhého bodu při zachování délky; posun počátečního bodu přenese úsečku. U koncového bodu, který už závisí na jiné konstrukci, použij nový nástroj Úsečka s pevnou délkou.

Přímka a úsečka se zadávají dvěma body. Kolmice a rovnoběžka bodem a přímkou nebo stranou útvaru v libovolném pořadí. Při rýsování jsou vidět průhledná pravítka, jejich měřítko odpovídá cm nákresu. Kružnice se určí středem a bodem; oblouk středem, polohou tuhy a dalším stiskem a tažením. Celá otočka vytvoří kružnici. Konec oblouku se přichytí jen k bodu na dané kružnici.

Úhel: klikni na vrchol, na bod prvního ramene a potom na úhloměru na požadovanou velikost. Druhé rameno vznikne automaticky jako přímka. Lze vybrat obě strany prvního ramene, krok 1°, 5°, 10°, 15° nebo zadat přesný úhel od 0° do 180°. Úhel zůstává svázaný s prvním ramenem při posouvání bodů.

## Měření, názvy a vzhled

Skupina Měření nabízí délku (úsečka/strana nebo dva body), úhel (tři body v pořadí A, vrchol, B) a obsah (mnohoúhelník/kružnice). Ve vlastnostech zapneš délky, úhly a obsah přímo na nákresu. Hodnoty se průběžně přepočítávají v cm, stupních a cm².

Body se zobrazují křížkem. Samostatně lze přichytávat k bodům/průsečíkům i k polovinám, třetinám, čtvrtinám, pětinám a osminám úseček. Průsečíky fungují pro přímky, úsečky, mnohoúhelníky, kružnice i oblouky.

Výchozí kresba je černá a útvary nemají výplň. Barva nové kresby se volí samostatně nahoře vlevo, platí pro další objekty všech typů a pamatuje se v prohlížeči. Změna barvy vybraného objektu tuto sázecí barvu nemění. Výběrem upravíš barvu, plnou/čárkovanou/čerchovanou čáru, tloušťku a popisky bodů či křivek. Souhrnná označení ABCD uvnitř útvarů se nevykreslují ani u starších nákresů. Běžná úsečka nemá automatický popisek AB; pojmenování rozpoznaných těžnic, výšek a úhlopříček zůstává dostupné. Popisek lze přepsat kliknutím a přesunout tažením. Dolní index se zadává podtržítkem: `t_a`, `S_a`, `A_0`. Automaticky se rozeznávají těžnice, středy stran, výšky a jejich paty i úhlopříčky `e`, `f`. Splývající body mohou mít společné označení.

## Postup a sdílení

Rozbalovací Postup konstrukce vzniká automaticky: například `AB; |AB| = 5 cm`. Tlačítka přehrávají začátek, předchozí/další krok a konec; kliknout lze i přímo na jednotlivý krok. Změny vzhledu se promítají do příslušného kroku a nevytvářejí zbytečné nové položky. Při procházení je nákres chráněný před změnou; tlačítkem Upravit celý nákres se vrátíš do editace. Vymazání plochy zahájí nový postup, předchozí stav lze vrátit tlačítkem Zpět.

Sdílet odkaz uloží výchozí scénu a jednotlivé změny, nikoliv kopii celé scény pro každý krok. Data se komprimují pomocí vestavěného Deflate a zapisují do fragmentu URL jako base64url. V prohlížeči bez komprese se použije nekomprimované UTF-8. Po otevření odkazu se zobrazí začátek postupu. Celý nákres je obsažen v odkazu, není potřeba účet ani serverové ukládání dat. JSON ukládání obsahuje také postup; PNG exportuje aktuální výřez ve dvojnásobném rozlišení.

Kolečko přibližuje k myši; mezerník + tažení nebo prostřední tlačítko posouvá plochu. Esc ruší rozpracovanou konstrukci, Delete maže výběr a závislé konstrukce. Ctrl+Z / Ctrl+Y vrací a opakuje úpravy. Nákres se ukládá do místního úložiště prohlížeče.

## Kontroly

```sh
node --test geometry/*.test.cjs
```

Testy kontrolují vlastnosti generovaných a přetvářených útvarů, průsečíky, měření, úhlové a délkové vazby, automatické názvy, konstrukční kroky, kompresi/rozbalení sdílených odkazů, vracení změn a celé otočky kružítkem v obou směrech.
