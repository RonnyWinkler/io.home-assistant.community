# Compound definition for Home-Assistant integration for Homey

[![hacs_badge](https://img.shields.io/badge/HACS-Default-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

HowTo use the compounds component in HA to create entity groups.

## Install the component in HomeAssistant
1) Copy the folder "homey" to your HomeAssistant custom_component folder.
2) Restart HomeAssistant to activate the component


## Prepare the YAML file
Copy the content of example.yaml into your configuration.yaml
Or copy the file example_include.yaml to your config folder. Rename to homey.yaml and add this line to your configuration.yaml:
homey: !include homey.yaml


##Customize the YAML file to define entity groups

Example:
livingroom_compound:
  name: Livingroom environment
  capabilities:
    measure_temperature: sensor.livingroom_temperature
    measure_temperature.temp1: sensor.livingroom_temperature_1
    measure_temperature.temp3: sensor.livingroom_temperature_2

The "livingroom_compound" will be the compound that gets importes to Homey.
You can set a name that is used as device name. You can rename it in Homey.
Add the capabilities. If you want to add more than one capability of the same type, you can use subcapabilities (capability.sub).

In addition you can set a title for each capability (optional):
    capabilitiesTitles:
      measure_temperature: "Temperature title"
      measure_temperature.temp1: "Temperature subcapability 1 title"
      measure_temperature.temp2: "Temperature subcapability 2 title"

## Use Icons
You can set an icon for your compound device:
livingroom_compound:
  name: Livingroom environment
  icon: measure_temperature

A list of icons can be found in Icons.txt
