Community: Home Assistant x Homey connector.


This Homey app adds support for many devices, scripts & scenes of your Home Assistant installation.

Currently the following device types are supported:

Compound (combined & customizable device)
Lights
Media Players
Sensors
Binary Sensors 
Scenes
Scripts
Switches
Services (start via flowss)


- Installing / using the app

To use this app, just install it from the Homey app store https://homey.app/a/io.home-assistant.community/

There's no need for configuring things up front, you can start right away by adding your first device, only now you will have to enter your Home Assistant instance's local IP address, along with the "Longlived token" 
→ when you don't have one, create it by scrolling down at 'http://your.homeassistant.IPaddress:8123/profile';

from here we will use HA as short for Home Assistant  -

When successfully saved, you can install devices without interruption.
When you add a new device on your HA instance, you'll need to refresh the entity list in the Homey HA app, by either restarting it or by pressing the 'reconnect' button via the settings of any already paired HA app device.

- Device types explained 

- Lights
Lights will be paired with their matching capabilities (as available on HA); 
this includes: brightness, colour and temperature
Lights also can be dimmed with duration, in Advanced flows, after adding a 'dim to' flowcard, right click the card and select "duration";  
With standard flows, you'll find "duration" above "delay" when adding a 'dim to' card.

- Media Players
Media players can be paired, that includes TV sets, satellite / cable settop-boxes, home cinema receivers and more.
- Scenes
Scenes you've created in HA are paired as buttons, just press it to start a linked scene

- Scripts
Scripts you've created in HA are paired as buttons, just press it to start a linked script

- Sensors
Sensors are devices which return numeric values, like measuring and metering devices, weather data like rain, wind and such.
Binary Sensors are devices which return an on/off or true/false state, like motion or contact sensors

- Switches
Any switch can be paired

And a special device:
- Compound
Compound is a custom device; in your HA instance, you can create a device which combines any sensors or entities present, which you then can pair with Homey as one device.
There will be examples in this app's forum topic. See link below.

There's a little extra you'll need to do:
Install the app's 'custom_components' by dragging the "Homey" folder into the "custom_components" folder on the config share of HA
The files should reside in '/config/custom_components/homey/'
Or, you can download the files from 
https://github.com/RonnyWinkler/io.home-assistant.community/tree/main/custom_components/homey and copy/paste them into '/config/custom_components/homey/'
You'll find example files and a how-to in that folder.
