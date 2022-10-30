This Home Assistand Community app adds support for devices added on a Home Assistant installation.

Currently supported types:
- Lights
- Switches / Boolean Switches
- Sensors / Binaire Sensors
- Media Players
- Scene's
- Scripts
- Services (started via flow)

Getting started:
To connect the app to your Home Assistant instance you will need to create a 'Long Lived Access Token' in Home Assistant. Create a token on your Home Assistant account profile page (https://www.home-assistant.io/docs/authentication/).
You will also need to know the IP address/hostname and port of your Home Assistant instance.
In the pairing process to add new devices, you will be asked the first time to fill in your IP address and token.

Compounds:
Because Homey and Home Assistant are modeled differently when it comes to devices it makes sense to group multiple sensors from Home Assistant into one Homey device.
To do so you will have to install a custom component in your Home Assistant installation.
After adding the custom component you can now declare the homey platform in your home-assistant configuration and define your devices.
For details and examples please check the repository: https://github.com/RonnyWinkler/io.home-assistant.community/tree/main/custom_components/homey

