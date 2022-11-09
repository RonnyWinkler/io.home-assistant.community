'use strict';

const Homey = require('homey');

const WebSocket = require('ws');
global.WebSocket = WebSocket;

const Hass = require("home-assistant-js-websocket");
const { disconnect } = require('process');

const sensorIcons = {
	'measure_co2': 'measure_co2',
	'measure_battery': 'measure_battery',
	'measure_current': 'measure_current',
	'measure_generic': 'measure_generic',
	'measure_humidity': 'measure_humidity',
	'measure_luminance': 'measure_luminance',
	'measure_noise': 'measure_noise',
	'measure_numeric': 'measure_numeric',
	'measure_power': 'measure_power',
	'measure_pressure': 'measure_pressure',
	'measure_temperature': 'measure_temperature',
	'measure_voltage': 'measure_voltage',
	'meter_power': 'meter_power',
	'alarm_contact': 'alarm_contact',
	'alarm_generic': 'alarm_generic',
	'alarm_heat': 'alarm_heat',
	'alarm_motion': 'alarm_motion',
	'alarm_pressure': 'alarm_pressure',
	'alarm_smoke': 'alarm_smoke',
	'alarm_tamper': 'alarm_tamper',
	'alarm_water': 'alarm_water'
}

class Client extends Homey.SimpleClass {
	
	constructor(app) {
		super();

		this._app = app;
		this._entities = [];
		this._lights = [];
		this._scenes = [];
		this._scripts = [];
		this._switches = [];
		this._buttons = [];
		this._sensors = [];
		this._binary_sensors = [];
		this._compounds = [];
		this._climates = [];
		this._media_players = [];
		this._entitiesLength = 0;

		this._devices = {};
		this._connection = null;
		this._unsubscribeEntities = null;
	}

	sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

	isConnected(){
		return (this._connection != null);
	}
	
	registerDevice(deviceId, device) {
		this._devices[deviceId] = device;
	}

	unregisterDevice(deviceId) {
		this._devices[deviceId] = null;
	}

	getLights() {
		return this._lights;
	}

	getScenes() {
		return this._scenes;
	}

	getScripts() {
		return this._scripts;
	}

	getSwitches() {
		return this._switches;
	}

	getButtons() {
		return this._buttons;
	}

	getSensors() {
		return this._sensors;
	}

	getBinarySensors() {
		return this._binary_sensors;
	}

	getCompounds() {
		return this._compounds;
	}

	getMediaPlayers() {
		return this._media_players;
	}

	getClimates() {
		return this._climates;
	}

	getEntities() {
		return this._entities;
	}

	getEntity(entityId) {
		return this._entities[entityId];
	}

	getEntitiesCount(){
		return Object.keys(this._entities).length;
	}

	sortEntities(entities){
		entities.sort(function(a, b){
			let x = a.name.toLowerCase();
			let y = b.name.toLowerCase();
			if (x < y) {return -1;}
			if (x > y) {return 1;}
			return 0;
		});
	}

	async getServices(){
		if (this._connection){
			return await Hass.getServices(this._connection);
		}
	}

	async disconnect(wait = true){
		if(this._unsubscribeEntities != null){
			try{
				this._app.log('unsubscribe entity subscription');
				this._unsubscribeEntities();
				if (wait){
					await this.sleep(2000);
				}
				this._unsubscribeEntities = null;
			}
			catch(error){
				this._app.error('Error: close existing connection.');
			}
		}
		if(this._connection != null) {
			try{
				this._app.log('close existing connection.');
				this._connection.close();
				if (wait){
					await this.sleep(1000);
				}
				this._connection = null;
			}
			catch(error){
				this._app.error('Error: close existing connection.');
			}
		}
	}

	async close(){
		if(this._unsubscribeEntities != null){
			try{
				this._unsubscribeEntities();
				this._unsubscribeEntities = null;
			}
			catch(error){
				this._app.error('Error: close existing connection.');
			}
		}
		if(this._connection != null) {
			try{
				this._connection.close();
				this._connection = null;
			}
			catch(error){
				this._app.error('Error: close existing connection.');
			}
		}
	}

	async connect(address, token, notify) {
        // return new Promise((resolve, reject) => {
			this._app.log('connecting to home-assistant');

			if(address && address != "" 
				&& token && token != "") {

				try{
					await this.disconnect();

					// clear any previously discovered devices
					this._lights = [];
					this._scenes = [];
					this._scripts = [];
					this._switches = [];
					this._buttons = [];
					this._sensors = [];
					this._compounds = [];
					this._media_players = [];
					this._binary_sensors = [];
					this._climates = [];
					this._collection = null;
					this._entities = [];
					this._entitiesLength = 0;

					let auth = new Hass.Auth({
						hassUrl: address,
						access_token: token,
						expires: new Date(new Date().getTime() + 1e11)
					});

					let conn = await Hass.createConnection({ auth });
					this._app.log('succesfully connected... subscribing to entities and events');

					if(notify) {
						this.emit("connection_update", { connected: true });
					}

					this._connection = conn;

					this._unsubscribeEntities = Hass.subscribeEntities(conn, (entities) => {this._onEntitiesUpdate(entities)});
					conn.subscribeEvents(this._onStateChanged.bind(this), "state_changed");
					this._app.log('subscribed to entities and events');
					return true;
				}
				catch(err){ 
					this._connection = null;
					this.emit("connection_update", { connected: false });
					this._app.log("failed to connect:", err);
					throw err;
				};
			}
			else{
				this._app.log("No credentials set");
				await this.disconnect();
				throw new Error("No credentials set");
			}
		// });
	}

	_onStateChanged(event) {
		try {
			let deviceIds = Object.keys(this._devices);
			let data = event.data;
			if(data) {
				let entityId = data.entity_id;

				deviceIds.forEach(deviceId => {
					let device = this._devices[deviceId];
					if(device != null) {
						if(deviceId == entityId) {
							device.onEntityUpdate(data.new_state);
						}
						if(deviceId.startsWith("homey.")) {
							let capabilities = device.getData().capabilities;
							Object.keys(capabilities).forEach(key => {
								if(capabilities[key] == entityId) {
									device.onEntityUpdate(data.new_state);
								}
							});
						}
					}
				});
			}
		} catch(e) {
			console.error("onStateChanged error:", e);
		}
	}
	
	_onEntitiesUpdate(entities) {
		let currentLength = Object.keys(entities).length;
		if(currentLength != this._entitiesLength) {
			this._app.log("update entities");

			let lights = [];
			let scenes = [];
			let scripts = [];
			let switches = [];
			let buttons = [];
			let sensors = [];
			let binary_sensors = [];
			let media_players = [];
			let compounds = [];
			let climates = [];

			Object.keys(entities).forEach(id => {

				if(id.startsWith("homey.")) {
					try {
						let entity = entities[id];
						let entityName = entity.attributes["friendly_name"] || id;
						let capabilitiesOptions = {};

						let compoundCapabilities = entity.attributes["capabilities"] || {};
						let compoundCapabilitiesTitles = entity.attributes["capabilitiesTitles"] || {};
						let compoundCapabilitiesUnits = entity.attributes["capabilitiesUnits"] || {};
						// let compoundCapabilitiesMdiIcons = entity.attributes["capabilitiesMdiIcons"] || {};
						let compoundCapabilitiesConverters = entity.attributes["capabilitiesConverters"] || {};
						let compoundIcon = entity.attributes["icon"];

						// Object.keys(compoundCapabilities).forEach(key => {
						let keys = Object.keys(compoundCapabilities);
						for (let i=0; i<keys.length; i++){
							let key = keys[i];
							// Get depending entity
							let capabilityEntity = entities[compoundCapabilities[key]];
							if (capabilityEntity != null){
								// Read entity unit
								let unit_of_measurement = capabilityEntity.attributes["unit_of_measurement"];
								if (unit_of_measurement != null){
									if (capabilitiesOptions[key] == null){
										capabilitiesOptions[key] = {};
									}
									capabilitiesOptions[key]["units"] = unit_of_measurement;
								}
								// read entity title
								let title = capabilityEntity.attributes["friendly_name"];
								if (title != null){
									if (capabilitiesOptions[key] == null){
										capabilitiesOptions[key] = {};
									}
									capabilitiesOptions[key]["title"] = title;
								}
							}
							// Use title from YAML if set
							if(compoundCapabilitiesTitles[key] != null) {
								if (capabilitiesOptions[key] == null){
									capabilitiesOptions[key] = {};
								}
								capabilitiesOptions[key]["title"] = compoundCapabilitiesTitles[key];
							}
							// Use unit from YAML if set
							if(compoundCapabilitiesUnits[key] != null) {
								if (capabilitiesOptions[key] == null){
									capabilitiesOptions[key] = {};
								}
								capabilitiesOptions[key]["units"] = compoundCapabilitiesUnits[key];
							}
						}
				
						let compound = {
							name: entityName,
							data: {
								id: id,
								capabilities: compoundCapabilities,
								capabilitiesConverters: compoundCapabilitiesConverters,
								// capabilitiesMdiIcons: compoundCapabilitiesMdiIcons
							},
							capabilities: Object.keys(compoundCapabilities),
							capabilitiesOptions: capabilitiesOptions
						};

						// Do not search in sensorIcons array. Take icon name directly if set. 
						// if(typeof sensorIcons[compoundIcon] === 'string' ) {
						// 	compound.icon = `/icons/${ sensorIcons[compoundIcon] }.svg`;
						// }
						if (compoundIcon != null){
							// if (compoundIcon.startsWith("mdi:")){
							// 	compound.icon = "../../../assets/icons/mdi/"+compoundIcon.split(":")[1]+".svg";
							// }
							// else
							// {
								compound.icon = "../../../assets/icons/capabilities/"+compoundIcon+".svg";
							// }
						}

						compounds.push(compound);

					} catch(ex) {
						this._app.error("failed to load compound:", ex);
					}
				}

				if(id.startsWith("media_player.")) {
					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let deviceClass = entity.attributes["device_class"];
					let features =  entity.attributes.supported_features;
					let canSelectSource = false;
					let canSelectSoundMode = false;
					let sourceList = '';
					let soundModeList = '';
					let mediaCapabilities = [];

					// class MediaPlayerEntityFeature(IntEnum):
					// """Supported features of the media player entity."""
					// Source: 
					// https://github.com/home-assistant/core/blob/97d31d05f05070dcfe09dd0534ff240bb0103506/homeassistant/components/media_player/const.py

					// ATTRIBUTES
					// ATTR_APP_ID = "app_id"
					// ATTR_APP_NAME = "app_name"
					// ATTR_ENTITY_PICTURE_LOCAL = "entity_picture_local"
					// ATTR_GROUP_MEMBERS = "group_members"
					// ATTR_INPUT_SOURCE = "source"
					// ATTR_INPUT_SOURCE_LIST = "source_list"
					// ATTR_MEDIA_ANNOUNCE = "announce"
					// ATTR_MEDIA_ALBUM_ARTIST = "media_album_artist"
					// ATTR_MEDIA_ALBUM_NAME = "media_album_name"
					// ATTR_MEDIA_ARTIST = "media_artist"
					// ATTR_MEDIA_CHANNEL = "media_channel"
					// ATTR_MEDIA_CONTENT_ID = "media_content_id"
					// ATTR_MEDIA_CONTENT_TYPE = "media_content_type"
					// ATTR_MEDIA_DURATION = "media_duration"
					// ATTR_MEDIA_ENQUEUE = "enqueue"
					// ATTR_MEDIA_EXTRA = "extra"
					// ATTR_MEDIA_EPISODE = "media_episode"
					// ATTR_MEDIA_PLAYLIST = "media_playlist"
					// ATTR_MEDIA_POSITION = "media_position"
					// ATTR_MEDIA_POSITION_UPDATED_AT = "media_position_updated_at"
					// ATTR_MEDIA_REPEAT = "repeat"
					// ATTR_MEDIA_SEASON = "media_season"
					// ATTR_MEDIA_SEEK_POSITION = "seek_position"
					// ATTR_MEDIA_SERIES_TITLE = "media_series_title"
					// ATTR_MEDIA_SHUFFLE = "shuffle"
					// ATTR_MEDIA_TITLE = "media_title"
					// ATTR_MEDIA_TRACK = "media_track"
					// ATTR_MEDIA_VOLUME_LEVEL = "volume_level"
					// ATTR_MEDIA_VOLUME_MUTED = "is_volume_muted"
					// ATTR_SOUND_MODE = "sound_mode"
					// ATTR_SOUND_MODE_LIST = "sound_mode_list"

					// SUPPORTED_FEATURES
					// PAUSE = 1
					// SEEK = 2
					// VOLUME_SET = 4
					// VOLUME_MUTE = 8
					// PREVIOUS_TRACK = 16
					// NEXT_TRACK = 32
					// TURN_ON = 128
					// TURN_OFF = 256
					// PLAY_MEDIA = 512
					// VOLUME_STEP = 1024
					// SELECT_SOURCE = 2048
					// STOP = 4096
					// CLEAR_PLAYLIST = 8192
					// PLAY = 16384
					// SHUFFLE_SET = 32768
					// SELECT_SOUND_MODE = 65536
					// BROWSE_MEDIA = 131072
					// REPEAT_SET = 262144
					// GROUPING = 524288

					// Homey capabilities:
					// "onoff",
					// "volume_set",
					// "volume_up",
					// "volume_down",
					// "volume_mute",
					// "speaker_playing",
					// "speaker_next",
					// "speaker_prev",
					// "speaker_shuffle",
					// "speaker_repeat",
					// "speaker_next",
					// "speaker_next",

					if ((features & 2048) == 2048) {
						canSelectSource = true;
						sourceList = JSON.stringify(entity.attributes.source_list);
					}
					if ((features & 65536) == 65536) {
						canSelectSoundMode = true;
						soundModeList = JSON.stringify(entity.attributes.sound_mode_list);
					}
					if ((features & 128) == 128 && 
						(features & 256) == 256) {
							mediaCapabilities.push("onoff");
					}
					if ((features & 4) == 4) {
							mediaCapabilities.push("volume_set");
							// add volume up/down even if VOLUME_STEP is not present
							// device will use volume_set +/- step
							mediaCapabilities.push("volume_up");
							mediaCapabilities.push("volume_down");
					}
					// if ((features & 1024) == 1024) {
					// 	mediaCapabilities.push("volume_up");
					// 	mediaCapabilities.push("volume_down");
					// }

					if ((features & 8) == 8) {
						mediaCapabilities.push("volume_mute");
					}
					if ((features & 512) == 512 ||
						(features & 1) == 1 ||
						(features & 16384) == 16384 ||
						(features & 4096) == 4096
						) {
						mediaCapabilities.push("speaker_playing");
					}
					if ((features & 32) == 32) {
						mediaCapabilities.push("speaker_next");
					}
					if ((features & 16) == 16) {
						mediaCapabilities.push("speaker_prev");
					}
					if ((features & 32768) == 32768) {
						mediaCapabilities.push("speaker_shuffle");
					}
					if ((features & 262144) == 262144) {
						mediaCapabilities.push("speaker_repeat");
					}

					// default capabilities:
					mediaCapabilities.push("speaker_artist");
					mediaCapabilities.push("speaker_album");
					mediaCapabilities.push("speaker_track");
					mediaCapabilities.push("speaker_duration");
					mediaCapabilities.push("speaker_position");

					let media_player = {
						name: entityName,
						data: {
							id: id
						},
						capabilities:mediaCapabilities,
						store: {
							features: features,
							canSelectSource: canSelectSource,
							canSelectSoundMode: canSelectSoundMode, 
							sourceList: sourceList,
							soundModeList: soundModeList
						}
					};

					// if(typeof sensorIcons[sensorCapability] === 'string' ) {
					// 	binary_sensor.icon = `/icons/${ sensorIcons[sensorCapability] }.svg`;
					// }

					media_players.push(media_player);
				}


				if(id.startsWith("climate.")) {
					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					// let deviceClass = entity.attributes["device_class"];
					let features =  entity.attributes.supported_features;
					let climateCapabilities = [];
					let capabilitiesOptions = {};


					// class ClimateEntityFeature(IntEnum):
					// """Supported features of the climate entity."""
					// Source: 
					// https://github.com/home-assistant/core/blob/dev/homeassistant/components/climate/const.py

					// TARGET_TEMPERATURE = 1
					// TARGET_TEMPERATURE_RANGE = 2
					// TARGET_HUMIDITY = 4
					// FAN_MODE = 8
					// PRESET_MODE = 16
					// SWING_MODE = 32
					// AUX_HEAT = 64



					// default capabilities:
					climateCapabilities.push("measure_temperature");
					climateCapabilities.push("climate_mode");
					climateCapabilities.push("climate_action");					

					if ((features & 1) == 1) {
						climateCapabilities.push("target_temperature");
					}
					// Special modes deactivated because most HA integrations are using custom mode lists
					// if ((features & 8) == 8) {
					// 	climateCapabilities.push("climate_mode_fan");
					// }
					// if ((features & 16) == 16) {
					// 	climateCapabilities.push("climate_mode_preset");
					// }
					// if ((features & 32) == 32) {
					// 	climateCapabilities.push("climate_mode_swing");
					// }

					if (entity.attributes.current_humidity){
						climateCapabilities.push("measure_humidity");
					}

					capabilitiesOptions = 
						{
							target_temperature: {}
						};
					if (entity.attributes.min_temp){
						capabilitiesOptions.target_temperature["min"] = entity.attributes.min_temp;
					}
					if (entity.attributes.max_temp){
						capabilitiesOptions.target_temperature["max"] = entity.attributes.max_temp;
					}
					if (entity.attributes.target_temp_step){
						capabilitiesOptions.target_temperature["step"] = entity.attributes.target_temp_step;
					}
					else {
						capabilitiesOptions.target_temperature["step"] = 0.5;
					}
					capabilitiesOptions.target_temperature["decimals"] = 1;

					let climate = {
						name: entityName,
						data: {
							id: id
						},
						capabilities:climateCapabilities,
						capabilitiesOptions: capabilitiesOptions,
						store: {
							features: features,
						}
					};

					// if(typeof sensorIcons[sensorCapability] === 'string' ) {
					// 	binary_sensor.icon = `/icons/${ sensorIcons[sensorCapability] }.svg`;
					// }

					climates.push(climate);
				}

				if(id.startsWith("binary_sensor.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let deviceClass = entity.attributes["device_class"];

					let sensorCapability = null;

					switch(deviceClass) {
						case "battery"		: sensorCapability 	= "alarm_battery"; break;
						case "gas"			: sensorCapability 	= "alarm_co"; break;
						case "opening"		: sensorCapability 	= "alarm_contact"; break;
						case "door"			: sensorCapability 	= "alarm_contact"; break;
						case "garage_door"	: sensorCapability 	= "alarm_contact"; break;
						case "window"		: sensorCapability 	= "alarm_contact"; break;
						case "fire"			: sensorCapability 	= "alarm_fire"; break;
						case "heat"			: sensorCapability 	= "alarm_heat"; break;
						case "motion"		: sensorCapability 	= "alarm_motion"; break;
						case "smoke"		: sensorCapability 	= "alarm_smoke"; break;
						case "moisture"		: sensorCapability 	= "alarm_water"; break;
						default:
							sensorCapability = "alarm_generic";
							break;
					}

					let binary_sensor = {
						name: entityName,
						data: {
							id: id
						},
						capabilities: [ sensorCapability ]
					};

					if(typeof sensorIcons[sensorCapability] === 'string' ) {
						binary_sensor.icon = `../../../assets/icons/capabilities/${ sensorIcons[sensorCapability] }.svg`;
					}

					binary_sensors.push(binary_sensor);
					sensors.push(binary_sensor);
				}

				if(id.startsWith("sensor.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let deviceClass = entity.attributes["device_class"];

					let sensorCapability = null;
					let capabilitiesOptions = {};

					switch(deviceClass) {
						case "battery"		: sensorCapability 	= "measure_battery"; break;
						case "humidity"		: sensorCapability 	= "measure_humidity"; break;
						case "illuminance"	: sensorCapability 	= "measure_luminance"; break;
						case "temperature"	: sensorCapability 	= "measure_temperature"; break;
						case "pressure"		: sensorCapability 	= "measure_pressure"; break;
						default:
							let unit_of_measurement = entity.attributes["unit_of_measurement"];

							switch(unit_of_measurement) {
								case "kWh"	: sensorCapability = "meter_power"; break;
								case "A"	: sensorCapability = "measure_current"; break;
								case "W"	: sensorCapability = "measure_power"; break;
								case "V"	: sensorCapability = "measure_voltage"; break;
								case "ppm"	: sensorCapability = "measure_co2"; break;
								case "dB"	: sensorCapability = "measure_noise"; break;
								case "°C"	: sensorCapability = "measure_temperature"; break;
								case "mbar"	: sensorCapability = "measure_pressure"; break;
								case "lx"	: sensorCapability = "measure_luminance"; break;
								
								default: {
									if(!isNaN(parseFloat(entity.state))) {
										sensorCapability = "measure_numeric";
									} else {
										sensorCapability = "measure_generic";
									}
									if (unit_of_measurement != null){
										capabilitiesOptions[sensorCapability] = {
											"units": {"en": entity.attributes.unit_of_measurement}
										};
									}
									break;
								}
							}
					}

					let sensor = {
						name: entityName,
						data: {
							id: id
						},
						capabilities: [ sensorCapability ],
						capabilitiesOptions: capabilitiesOptions
					};

					if(typeof sensorIcons[sensorCapability] === 'string' ) {
						sensor.icon = `../../../assets/icons/capabilities/${ sensorIcons[sensorCapability] }.svg`;
					}

					sensors.push(sensor);
				}

				if(id.startsWith("switch.") || id.startsWith("input_boolean.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;

					switches.push({
						name: entityName,
						data: {
							id: id
						},
						icon: "/icons/on.svg"
					});
				}

				if(id.startsWith("input_button.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;

					buttons.push({
						name: entityName,
						data: {
							id: id
						},
						icon: "/icons/button.svg"
					});
				}

				if(id.startsWith("script.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;

					scripts.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}

				if(id.startsWith("scene.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;

					scenes.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}

				if(id.startsWith("light.")) {

					let entity = entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let lightCapabilities = [ "onoff" ];

					/*
					# These SUPPORT_* constants are deprecated as of Home Assistant 2022.5.
					# Please use the LightEntityFeature enum instead.
					SUPPORT_BRIGHTNESS = 1  # Deprecated, replaced by color modes
					SUPPORT_COLOR_TEMP = 2  # Deprecated, replaced by color modes
					SUPPORT_EFFECT = 4
					SUPPORT_FLASH = 8
					SUPPORT_COLOR = 16  # Deprecated, replaced by color modes
					SUPPORT_TRANSITION = 32
					SUPPORT_WHITE_VALUE = 128
					
					# Color mode of the light
					ATTR_COLOR_MODE = "color_mode"
					# List of color modes supported by the light
					ATTR_SUPPORTED_COLOR_MODES = "supported_color_modes"

				    """Possible light color modes."""
					UNKNOWN = "unknown"  # Ambiguous color mode
					ONOFF = "onoff"  # Must be the only supported mode
					BRIGHTNESS = "brightness"  # Must be the only supported mode
					COLOR_TEMP = "color_temp"
					HS = "hs"
					XY = "xy"
					RGB = "rgb"
					RGBW = "rgbw"
					RGBWW = "rgbww"
					WHITE = "white"  # Must *NOT* be the only supported mode

					# These COLOR_MODE_* constants are deprecated as of Home Assistant 2022.5.
					# Please use the LightEntityFeature enum instead.
					COLOR_MODE_UNKNOWN = "unknown"
					COLOR_MODE_ONOFF = "onoff"
					COLOR_MODE_BRIGHTNESS = "brightness"
					COLOR_MODE_COLOR_TEMP = "color_temp"
					COLOR_MODE_HS = "hs"
					COLOR_MODE_XY = "xy"
					COLOR_MODE_RGB = "rgb"
					COLOR_MODE_RGBW = "rgbw"
					COLOR_MODE_RGBWW = "rgbww"
					COLOR_MODE_WHITE = "white"

					VALID_COLOR_MODES = {
						ColorMode.ONOFF,
						ColorMode.BRIGHTNESS,
						ColorMode.COLOR_TEMP,
						ColorMode.HS,
						ColorMode.XY,
						ColorMode.RGB,
						ColorMode.RGBW,
						ColorMode.RGBWW,
						ColorMode.WHITE,
					}
					COLOR_MODES_BRIGHTNESS = VALID_COLOR_MODES - {ColorMode.ONOFF}
					COLOR_MODES_COLOR = {
						ColorMode.HS,
						ColorMode.RGB,
						ColorMode.RGBW,
						ColorMode.RGBWW,
						ColorMode.XY,
					}
					*/


					if (	entity.attributes.supported_color_modes != null){
						if (	entity.attributes.supported_color_modes.includes('brightness') )
							{
								if (lightCapabilities.indexOf("dim") == -1) 
									lightCapabilities.push("dim");
							}

						if (	entity.attributes.supported_color_modes.includes('color_temp') )
							{
								if (lightCapabilities.indexOf("dim") == -1) 
									lightCapabilities.push("dim");
								if (lightCapabilities.indexOf("light_temperature") == -1) 
									lightCapabilities.push("light_temperature");
							}

						if (	entity.attributes.supported_color_modes.includes('hs') ||
								entity.attributes.supported_color_modes.includes('xy') ||
								entity.attributes.supported_color_modes.includes('rgb') ||
								entity.attributes.supported_color_modes.includes('rgbw') ||
								entity.attributes.supported_color_modes.includes('rgbww') ||
								entity.attributes.supported_color_modes.includes('white') )
							{
								if (lightCapabilities.indexOf("dim") == -1) 
									lightCapabilities.push("dim");
								if (lightCapabilities.indexOf("light_hue") == -1) 
									lightCapabilities.push("light_hue");
								if (lightCapabilities.indexOf("light_saturation") == -1) 
									lightCapabilities.push("light_saturation");
							}

						if (	lightCapabilities.includes("light_temperature") &&
								lightCapabilities.includes("light_hue")) 
							{
								lightCapabilities.push("light_mode")
							}
					}

					// deprecated features:
					// let features = entity.attributes["supported_features"] || 0;
					// if ((features & 1) == 1 && lightCapabilities.indexOf("dim") == -1){
					// 	lightCapabilities.push("dim");
					// }
					// if ((features & 2) == 2 && lightCapabilities.indexOf("light_temperature") == -1){
					// 	lightCapabilities.push("light_temperature");
					// }
					// if ((features & 16) == 16){ 
					// 	if (lightCapabilities.indexOf("light_hue") == -1) 
					// 		lightCapabilities.push("light_hue");
					// 	if (lightCapabilities.indexOf("light_saturation") == -1) 
					// 		lightCapabilities.push("light_saturation");
					// }

					lights.push({
						name: entityName,
						data: {
							id: id
						},
						capabilities: lightCapabilities
					});
				}
			});

			let update = this._entities.length == 0;

			this._lights = lights;
			this._scenes = scenes;
			this._scripts = scripts;
			this._switches = switches;
			this._buttons = buttons;
			this._sensors = sensors;
			this._binary_sensors = binary_sensors;
			this._compounds = compounds;
			this._media_players = media_players;
			this._climates = climates;
			this._entities = entities;
			this._entitiesLength = currentLength;

			if(update) {
				setTimeout(() => {
					Object.keys(this._entities).forEach(id => {
						this._onStateChanged({
							data: {
								entity_id: id,
								new_state: this._entities[id]
							}
						});
					});
				}, 5000);
			}

			// Sort entities by name for sorted pairing lost
			this.sortEntities(this._binary_sensors);
			this.sortEntities(this._compounds);
			this.sortEntities(this._lights);
			this.sortEntities(this._scenes);
			this.sortEntities(this._scripts);
			this.sortEntities(this._sensors);
			this.sortEntities(this._switches);	
			this.sortEntities(this._buttons);	
			this.sortEntities(this._media_players);	
			this.sortEntities(this._climates);	

			this._app.log("update entities completed.");
		}
	}

	async turnOnOff(entityId, on) {
		this._app.log("turnOnOff: "+entityId+" "+on);
		try {
			if(this._connection) {
				await Hass.callService(this._connection, "homeassistant", on ? "turn_on" : "turn_off", {"entity_id": entityId})
				// .catch(error => {
				// 	console.error("turnOnOff error:", error);
				// })
			}
		} catch (error) {
			this._app.error("callService error:", error);
			throw error;
		}
	}

	async updateLight(on, data) {
		this._app.log("updateLight: "+ on+" "+JSON.stringify(data));
		try {
			if(this._connection) {
				await Hass.callService(this._connection, "light", on ? "turn_on" : "turn_off", data);
				// 	.catch(error => {
				// 	console.error("updateLight error:", error);
				// })
			}
		} catch (error) {
			this._app.error("callService error:", error);
			throw error;
		}
	}

	async callService(domain, service, data) {
		try {
			if(this._connection) {
				let jsonData = (typeof data === "string") ? JSON.parse(data) : data;
				this._app.log("callService: "+ domain+" "+JSON.stringify(service)+" ",jsonData);

				await Hass.callService(this._connection, domain, service, jsonData);
					// .catch(error => {
					// 	console.error("callService error:", error);
					// });
			}
		} catch (error) {
			this._app.error("callService error:", error);
			throw error;
		}
	}

}

module.exports = Client