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
After adding a new device on your HA instance, the entity list in Homey is refreshed instantly and you can directly add your new entity as Homey device.
