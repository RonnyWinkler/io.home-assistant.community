Diese Home-Assistant Community-App bietet die Möglichkeit, Home-Assistant-Geräte in Homey zur Verfügung zu stellen. 

Derzeit unterstützte Typen:
- Licht
- Schalter / Boolesche Schalter
- Sensoren / Binäre-Sensoren
- Mediaplayer
- Szenen
- Skripte
- Dienste (über Flow gestartet)

Einstieg:
Um die App mit Home Assistant zu verbinden, muss zuvor in Home Assistant ein „Long Lived Access Token“ erstellt werden (https://www.home-assistant.io/docs/authentication/).
Die IP-Adresse/Hostname und der Port der Home Assistant Instanz muss bekannt sein.
Beim Kopplungsprozess zum Hinzufügen neuer Geräte wird beim ersten Aufruf der Anmeldebildschirm angezeigt, wo die IP-Adresse und der Token einzugeben ist.

Verbund-Gerät (Compound):
Da Homey und Home Assistant in Bezug auf Geräte unterschiedlich modelliert sind, ist es sinnvoll, mehrere Sensoren von Home Assistant in einem Homey-Gerät zu gruppieren.
Dazu muss eine benutzerdefinierte Komponente in Home Assistant installiert werden.
Nach dem Hinzufügen der Komponente können mehrere Home Assistant Entitäten in der YAML Definition zu einem Verbund zusammengefasst werden.
Details und Beispiele sind in Github abrufbar: https://github.com/RonnyWinkler/homeassistant.homey