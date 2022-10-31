Diese Homey-App fügt Unterstützung für viele Geräte, Skripte & Szenen deiner Home Assistant-Installation hinzu.

Aktuell werden folgende Gerätetypen unterstützt:

Compound (kombiniertes Gerät)
Beleuchtung
Media-Player
Sensoren
Binäre Sensoren
Szenen
Skripte
Schalter
Dienste (Start über Flows)


- Installation und Verwendung

Um diese App zu verwenden, installiere sie einfach aus dem Homey App Store https://homey.app/a/io.home-assistant.community/

Es muss nichts vorkonfiguriert werden. Du kannst sofort mit dem Hinzufügen des ersten Geräts beginnen. Beim ersten Gerät mmuss die lokale IP-Adresse des Home Assistant-Systems eingegeben werden, zusammen mit dem sogenannten „Longlived Token“
→ Wenn du noch keines hast, erstelle einen im Home Assistant-Profil „http://your.homeassistant.IPaddress:8123/profile“;

ab hier verwenden wir HA als Abkürzung für Home Assistant -

Wenn das Gerät erfolgreich gespeichert wurde, kannst du weitere HA-Geräte ohne weitere Einstellungen installieren.
Wenn im HA-System ein neues Gerät hinzufügt wurde, muss Sie die Entitätsliste in der Homey HA-App aktualisiesrt werde, indem die App neu gestartet wird.
Alternativ kann durch Drücken der Schaltfläche „Neu verbinden“ über die Einstellungen eines bereits gekoppelten HA-App-Geräts das Laden gestartet werden.

- Gerätetypen erklärt

- Beleuchtung
Lichter werden mit ihren entsprechenden Fähigkeiten gepaart (wie auf HA verfügbar);
dazu gehören: Helligkeit, Farbe und Temperatur
Beleuchtung kann auch mit Dauer gedimmt werden,
Klicke in Advanced Flows nach dem Hinzufügen einer „Dim zu“-Flow-Karte mit der rechten Maustaste auf die Karte und wähle „Dauer“;
Bei Standard Flows findest du „Dauer“ über „Verzögerung“, in der „Dim zu“-Karte.

- Mediaplayer
Media-Player können verbunden werden, darunter Fernseher, Satelliten-/Kabel-Set-Top-Boxen, Heimkino-Receiver und mehr.

- Szenen
Szenen, die in HA erstellt wurden, sind als Schaltflächen verknüpft. Klicke darauf, um eine verknüpfte Szene zu starten

- Skripte
Skripte, die in HA erstellt wurden, sind als Schaltflächen verknüpft. Klicke darauf, um das verknüpfte Skript zu starten

- Sensoren
Sensoren sind Geräte, die Zahlenwerte melden, wie Messgeräte, Wetterdaten wie Regen, Wind und ähnliches.
Binäre Sensoren sind Geräte, die einen Ein/Aus- oder Richtig/Falsch-Status melden, wie z. B. Bewegungs- oder Kontaktsensoren.

- Schalter
Jeder Schalter kann gekoppelt werden-

Und ein besonderes Gerät:
- Compound 
Compound ist ein spezielles anpassungsfähiges Gerät;
In Ihrem HA-System können Sie ein Gerät erstellen, das alle vorhandenen Sensoren oder Entitäten kombiniert, die dann als ein Gerät mit Homey verknüpft werden kann.
Beispiele findest du im Forum dieser App. Siehe Link weiter unten.

Installiere dazu die „custom_components“ der App, indem du den Ordner „homey“ in den Ordner „custom_components“ der HA-Konfiguration kopierst.
Die Dateien müssen sich in '/config/custom_components/homey/' befinden.
Die Dateien können heruntergeladen von:
https://github.com/RonnyWinkler/io.home-assistant.community/tree/main/custom_components/homey
In diesem Ordner befinden sich Beispieldateien und eine Anleitung.
