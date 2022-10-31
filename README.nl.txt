Deze Homey app voegt ondersteuning toe voor veel apparaten, scripts en scènes van je Home Assistant installatie.

Momenteel worden de volgende apparaattypen ondersteund:

Compound (gecombineerd en aanpasbaar apparaat)
Lichten
Mediaspelers
Sensoren
Binaire sensoren
Scènes
Scripts
Schakelaars
Diensten (start via flows)


- Installeren / gebruiken van de app

Om deze app te gebruiken, installeer je hem gewoon vanuit de Homey app store https://homey.app/a/io.home-assistant.community/

Je hoeft niets vooraf te configureren, je kunt meteen beginnen met je eerste apparaat toevoegen, alleen moet je nu het lokale IP-adres van je Home Assistant systeem invoeren, samen met de zg. "Longlived token"
→ als je er geen hebt, maak er één aan door naar beneden te scrollen op 'http://your.homeassistant.IPaddress:8123/profile';

vanaf hier zullen we HA gebruiken als afkorting voor Home Assistant -

Als het succesvol is opgeslagen, kunt je nieuwe HA apparaten zonder onderbreking installeren.
Wanneer je een nieuw apparaat toevoegt aan je HA systeem, moet je de entiteitenlijst in de Homey HA-app vernieuwen door deze opnieuw te starten, 
of door op de knop 'opnieuw verbinden' te drukken, via de instellingen (settings) van een al gekoppeld HA app apparaat.

- Apparaattypes uitgelegd

- Lichten
Lichten worden gekoppeld met hun overeenkomende mogelijkheden (zoals beschikbaar op HA);
dit omvat: helderheid, kleur en temperatuur
Verlichting kan ook gedimd worden met duur, 
in Geavanceerde flows, na het toevoegen van een 'dim naar' flowkaart, klik met de rechtermuisknop op de kaart en selecteer "duur";
Bij standaard flows vindt je "duur" boven 'vertraging" tijdensj het toevoegen van een 'dim naar' -kaart.

- Mediaspelers
Mediaspelers kunnen worden gekoppeld, waaronder TV's, satelliet-/kabel settop boxen, home cinema ontvangers en meer.

- Scènes
Scènes die je in HA hebt gemaakt, worden gekoppeld als knoppen, klik er op om een ​​gekoppelde scène te starten

- Scripts
Scripts die je in HA hebt gemaakt, zijn gekoppeld als knoppen, klik er op om een ​​gekoppeld script te starten

- Sensoren
Sensoren zijn apparaten die numerieke waarden melden, zoals meetapparatuur, weergegevens zoals regen, wind en dergelijke.
Binaire sensoren zijn apparaten die een aan/uit of waar/onwaar status melden, zoals bewegings- of contact sensoren

- Schakelaars
Elke schakelaar kan worden gekoppeld

En een speciaal apparaat:
- Compound
Compound is een speciaal aanpasbaar apparaat; 
in je HA systeem kun je een apparaat maken dat alle aanwezige sensoren of entiteiten combineert, die je vervolgens als één apparaat met Homey kunt koppelen.
Er zullen voorbeelden zijn in het forumonderwerp van deze app. Zie onderstaande link.

Er is nog een klein extraatje dat je moet doen:
Installeer de 'custom_components' van de app door de map 'homey' naar de map 'custom_component' op de configuratieshare van HA te slepen.
De bestanden moeten zich bevinden in '/config/custom_components/homey/'
Of je kunt de bestanden downloaden van
https://github.com/RonnyWinkler/io.home-assistant.community/tree/main/custom_components/homey en kopieer/plak ze in '/config/custom_components/homey/'
In die map vind je voorbeeldbestanden en een how-to.
