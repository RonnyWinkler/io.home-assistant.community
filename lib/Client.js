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
		this._config = null;
		this._entitiesLength = 0;

		// Registered entities and assigned Homey devices for update 
		this._deviceRegistration = {};
		// Additional power entities for devices
		this._powerEntityRegistration = {};
		// Registered compound devices and assigned entities (Array) 
		this._compoundRegistration = {};

		this._connection = null;
		this._unsubscribe = [];
	}

	sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

	isConnected(){
		return (
			this._connection != null &&
			this._connection.socket.readyState == this._connection.socket.OPEN
		   );
	}
	
	registerDevice(entityId, device) {
		this._deviceRegistration[entityId] = device;
	}

	unregisterDevice(entityId) {
		delete this._deviceRegistration[entityId]; 
	}

	registerPowerEntity(entityId, device) {
		this._powerEntityRegistration[entityId] = device;
	}

	unregisterPowerEntity(entityId) {
		delete this._powerEntityRegistration[entityId]; 
	}

	registerCompound(compoundId, device, entityIds){
		let compoundDevice = {
			device: device,
			entityIds: entityIds
		};
		this._compoundRegistration[compoundId] = compoundDevice;
	}

	unregisterCompound(compoundId) {
		delete this._compoundRegistration[compoundId]; 
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

	async getDevices(){
		return await this.sendMessage({
			type: 'config/device_registry/list'
		});
	}

	async getConfig(){
		return this._config;
	}

	// Connect to HA  ===================================================================================
	async connect(address, token, notify) {
        // return new Promise((resolve, reject) => {
			this._app.log('connecting to home-assistant');

			if(address && address != "" 
				&& token && token != "") {

				try{
					await this.disconnect();

					// clear any previously discovered devices
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

					this._unsubscribe = [];
					let unsubscribe;
					unsubscribe = Hass.subscribeEntities(conn, (entities) => {this._onEntitiesUpdate(entities)});
					this._unsubscribe.push(unsubscribe);
					unsubscribe = Hass.subscribeConfig(conn, (config) => {this._onConfigUpdate(config)});
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onStateChanged.bind(this), "state_changed");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventScript.bind(this), "script_started");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventAutomation.bind(this), "automation_triggered");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventTimer.bind(this), "timer.started");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventTimer.bind(this), "timer.paused");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventTimer.bind(this), "timer.restarted");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventTimer.bind(this), "timer.finished");
					this._unsubscribe.push(unsubscribe);
					unsubscribe = await conn.subscribeEvents(this._onEventTimer.bind(this), "timer.cancelled");
					this._unsubscribe.push(unsubscribe);

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

	// Disconnect to HA  ===================================================================================
	async disconnect(wait = true){
		if (this.isConnected()){
			if(this._unsubscribe.length > 0){
				try{
					this._app.log('unsubscribe entity subscription');
					for (let i=0; i<this._unsubscribe.length; i++){
						this._unsubscribe[0]();
					}
					this._unsubscribe = [];
					if (wait){
						await this.sleep(2000);
					}
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
	}

	async close(){
		if (this.isConnected()){
			if(this._unsubscribeEntities != null){
				try{
					for (let i=0; i<this._unsubscribe.length; i++){
						this._unsubscribe[0]();
					}
					this._unsubscribe = [];
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
	}

	// HA Events: entity changed, call/trigger events  ===================================================================================
	async _onEventTimer(event) {
		try {
			if (event.event_type.startsWith('timer.')){
				let device = this._deviceRegistration[event.data.entity_id];
				if(device != null) {
					device.onTimerEvent(event);
				}
			}
		}
		catch(error){
			this._app.error("onEventTimer error:", error);
		}
	}

	async _onStateChanged(event) {
		try {
			let data = event.data;
			if(data) {
				let entityId = data.entity_id;
				// update entity in entity list
				this._entities[entityId] = data.new_state;

				// Get simple device by entityId
				let device = this._deviceRegistration[entityId];
				if(device != null) {
					device.onEntityUpdate(data.new_state);
				}

				// Get Compound device by checking entityId list
				Object.keys(this._compoundRegistration).forEach(async (key) => {
					try {
						let compound = this._compoundRegistration[key];
						if (compound.entityIds.indexOf(entityId) != -1){
							await compound.device.onEntityUpdate(data.new_state);
						}
					} catch(e) {
						this._app.error("onStateChanged error:", e);
					}
				});

				// Get additional power entity for device by entityId
				let powerEntity = this._powerEntityRegistration[entityId];
				if(powerEntity != null) {
					powerEntity.onEntityUpdate(data.new_state);
				}
			}
		} catch(e) {
			this._app.error("onStateChanged error:", e);
		}
	}

	async _onEventScript(event){
		if (event == undefined || event.data == undefined){
			return;
		}
		try{
			// this._app.log("HA script event: ", event.data.name, " Entity: ",event.data.entity_id);
			// Trigger Flow
			let tokens = {
				name: event.data.name,
				entity:  event.data.entity_id
			};
			let state = {
				name: event.data.name
			};
			await this._app._flowTriggerScriptStartedFilter.trigger(tokens, state);
		}
		catch(error) {
			this._app.error("onEventScript error:", error.message);
		}
	}

	async _onEventAutomation(event){
		if (event == undefined || event.data == undefined){
			return;
		}
		try{
			// this._app.log("HA automation event: ", event.data.name, " Entity: ",event.data.entity_id);
			// Trigger Flow
			let tokens = {
				name: event.data.name,
				entity:  event.data.entity_id
			};
			let state = {
				name: event.data.name
			};
			await this._app._flowTriggerAutomationTriggeredFilter.trigger(tokens, state);
		}
		catch(error) {
			this._app.error("onEventScript error:", error.message);
		}			
	}
		
	// Get entity list update from HA ===================================================================================
	_onEntitiesUpdate(entities) {
		let currentLength = Object.keys(entities).length;
		if(currentLength != this._entitiesLength) {
			this._app.log("update entities");

			let update = this._entities.length == 0;

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
			this._app.log("update entities completed.");
		}
	}

	// Get entity list update from HA ===================================================================================
	_onConfigUpdate(config) {
		this._config = config;
		this.log("Config updated)");
	}

	// Device convert from entity list  ===================================================================================

	// HOMEY COMPOUND ============================================================================== HOMEY COMPOUND
	getCompounds() {
		this._app.log("Prepare COMPOUND devices list.");
		let compounds = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("homey.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let capabilitiesOptions = {};
					let compoundCapabilities = entity.attributes["capabilities"] || {};
					let compoundCapabilitiesTitles = entity.attributes["capabilitiesTitles"] || {};
					let compoundCapabilitiesUnits = entity.attributes["capabilitiesUnits"] || {};
					let compoundCapabilitiesConverters = entity.attributes["capabilitiesConverters"] || {};
					let compoundIcon = entity.attributes["icon"];

					let keys = Object.keys(compoundCapabilities);
					for (let i=0; i<keys.length; i++){
						let key = keys[i];
						// Get depending entity
						let capabilityEntity = this._entities[compoundCapabilities[key]];
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
						},
						capabilities: Object.keys(compoundCapabilities),
						capabilitiesOptions: capabilitiesOptions
					};
					if (compoundIcon != null){
							compound.icon = "../../../assets/icons/capabilities/"+compoundIcon+".svg";
					}
					compounds.push(compound);
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(compounds);
		return compounds;
	}

	// SENSOR ============================================================================================== SENSOR
	getSensors() {
		this._app.log("Prepare SENSORS & BINARY SENSOR devices list.");
		let sensors = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("sensor.")) {
					let entity = this._entities[id];
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
				if(id.startsWith("binary_sensor.")) {

					let entity = this._entities[id];
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
					sensors.push(binary_sensor);
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(sensors);
		return sensors;
	}				

	// SCENE ================================================================================================ SCENE
	getScenes() {
		this._app.log("Prepare SCENE devices list.");
		let scenes = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("scene.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					scenes.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(scenes);
		return scenes;
	}

	// SCRIPT ============================================================================================== SCRIPT
	getScripts() {
		this._app.log("Prepare SCRIPT devices list.");
		let scripts = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("script.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					scripts.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(scripts);
		return scripts;
	}

	// TIMER ================================================================================================ SCENE
	getTimers() {
		this._app.log("Prepare TIMER devices list.");
		let timers = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("timer.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					timers.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(timers);
		return timers;
	}

	// SCHEDULES ================================================================================================ SCENE
	getSchedules() {
		this._app.log("Prepare SCHEDULE devices list.");
		let schedules = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("schedule.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					schedules.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(schedules);
		return schedules;
	}

	// SWITCH / INPUT BOOLEAN ============================================================== SWITCH / INPUT BOOLEAN
	getLocks() {
		this._app.log("Prepare LOCK devices list.");
		let locks = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("lock.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let features = entity.attributes.supported_features;
					let lockCapabilities = [];
					// class LockEntityFeature(IntFlag):
					// """Supported features of the lock entity."""
					// https://github.com/home-assistant/core/blob/dev/homeassistant/components/lock/__init__.py
					// OPEN = 1

					lockCapabilities.push("locked");
					if ((features & 1) == 1) {
						lockCapabilities.push("lock_open");
					}
					locks.push({
						name: entityName,
						data: {
							id: id
						},
						capabilities: lockCapabilities
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(locks);
		return locks;
	}
	
	// SWITCH / INPUT BOOLEAN ============================================================== SWITCH / INPUT BOOLEAN
	getSwitches() {
		this._app.log("Prepare SWITCH devices list.");
		let switches = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("switch.") || id.startsWith("input_boolean.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					switches.push({
						name: entityName,
						data: {
							id: id
						},
						icon: "/icons/on.svg"
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(switches);
		return switches;
	}

	// BUTTON ============================================================================================== BUTTON
	getButtons() {
		this._app.log("Prepare BUTTON devices list.");
		let buttons = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("input_button.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					buttons.push({
						name: entityName,
						data: {
							id: id
						},
						icon: "/icons/button.svg"
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(buttons);
		return buttons;
	}

	// DEVICE-TRACTER / PERSON ============================================================ DEVICE-TRACKER / PERSON
	getPresence() {
		this._app.log("Prepare PRESENCE devices list.");
		let presence = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("device_tracker.") || id.startsWith("person.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					presence.push({
						name: entityName,
						data: {
							id: id
						}
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(presence);
		return presence;
	}

	// MEDIA PLAYER ================================================================================== MEDIA PLAYER
	getMediaPlayers() {
		this._app.log("Prepare MEDIA PLAYER devices list.");
		let media_players = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("media_player.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					// let deviceClass = entity.attributes["device_class"];
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
					mediaCapabilities.push("media_unjoin");

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
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(media_players);
		return media_players;
	}

	// CLIMATE ============================================================================================ CLIMATE
	getClimates() {
		this._app.log("Prepare CLIMATE devices list.");
		let climates = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("climate.")) {
					let entity = this._entities[id];
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
					climates.push(climate);
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(climates);
		return climates;
	}

	// FAN ==================================================================================================== FAN
	getFans() {
		this._app.log("Prepare FAN devices list.");
		let fans = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("fan.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					// let deviceClass = entity.attributes["device_class"];
					let features =  entity.attributes.supported_features;
					let fanCapabilities = [];
					let capabilitiesOptions = {};

					// class FanEntityFeature(IntFlag)::
					// """Supported features of the fan entity."""
					// Source: 
					// https://github.com/home-assistant/core/blob/dev/homeassistant/components/fan/__init__.py

					// # These SUPPORT_* constants are deprecated as of Home Assistant 2022.5.
					// # Please use the FanEntityFeature enum instead.
					// SUPPORT_SET_SPEED = 1
					// SUPPORT_OSCILLATE = 2
					// SUPPORT_DIRECTION = 4
					// SUPPORT_PRESET_MODE = 8

					// default capabilities:
					fanCapabilities.push("onoff"); 
					if ((features & 1) == 1) {
						fanCapabilities.push("dim"); 
					}
					if ((features & 2) == 2) {
						fanCapabilities.push("fan_oscillate"); 
					}
					if ((features & 4) == 4) {
						fanCapabilities.push("fan_reverse"); 
					}
					let fan = {
						name: entityName,
						data: {
							id: id
						},
						capabilities:fanCapabilities,
						capabilitiesOptions: capabilitiesOptions,
						store: {
							features: features,
						}
					};
					fans.push(fan);
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(fans);
		return fans;
	}

	// FAN ==================================================================================================== FAN
	getVacuums() {
		this._app.log("Prepare VACUUM devices list.");
		let vacuums = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("vacuum.")) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					// let deviceClass = entity.attributes["device_class"];
					let features =  entity.attributes.supported_features;
					let capabilities = [];
					let capabilitiesOptions = {};

					// class VacuumEntityFeature(IntEnum):
					// """Supported features of the vacuum entity."""
					// Source: 
					// https://github.com/home-assistant/core/blob/master/homeassistant/components/vacuum/__init__.py
				
					// TURN_ON = 1
					// TURN_OFF = 2
					// PAUSE = 4
					// STOP = 8
					// RETURN_HOME = 16
					// FAN_SPEED = 32
					// BATTERY = 64
					// STATUS = 128
					// SEND_COMMAND = 256
					// LOCATE = 512
					// CLEAN_SPOT = 1024
					// MAP = 2048
					// STATE = 4096
					// START = 8192

					// default capabilities:
					capabilities.push("vacuum_state"); 
					capabilities.push("vacuum_state_raw"); 
					capabilities.push("vacuum_error"); 
					if ((features & 1) == 1 &&
					    (features & 2) == 2) {
						capabilities.push("onoff"); 
					}
					if ((features & 8192) == 8192) {
						capabilities.push("vacuum_start"); 
					}
					if ((features & 4) == 4) {
						capabilities.push("vacuum_pause"); 
					}
					if ((features & 8) == 8) {
						capabilities.push("vacuum_stop"); 
					}
					if ((features & 16) == 16) {
						capabilities.push("vacuum_return"); 
					}
					if ((features & 512) == 512) {
						capabilities.push("vacuum_locate"); 
					}
					if ((features & 1024) == 1024) {
						capabilities.push("vacuum_clean_spot"); 
					}
					if ((features & 32) == 32) {
						capabilities.push("dim"); 
					}
					if ((features & 64) == 64) {
						capabilities.push("measure_battery"); 
					}
					let vacuum = {
						name: entityName,
						data: {
							id: id
						},
						capabilities: capabilities,
						capabilitiesOptions: capabilitiesOptions,
						store: {
							features: features,
						}
					};
					vacuums.push(vacuum);
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(vacuums);
		return vacuums;
	}

	// CLIMATE + FAN COMBINATION ======================================================== CLIMATE + FAN COMBINATION
	getClimateFans() {
		this._app.log("Prepare CLIMATE & FAN devices list.");
		let climate_fans = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("climate.")) {
					let climateEntity = this._entities[id];
					let fanEntityId = "fan." + id.split(".")[1];
					let fanEntity = this._entities[fanEntityId];
					if (climateEntity != undefined && fanEntity != undefined){
						let entities = [];
						entities.push(climateEntity.entity_id);
						entities.push(fanEntity.entity_id);
						let entityName = climateEntity.attributes["friendly_name"] || id;
						let deviceId = "climate_fan." + id.split(".")[1];
						let climateFeatures =  climateEntity.attributes.supported_features;
						let climateCapabilities = [];
						let capabilitiesOptions = {};
						// default capabilities:
						climateCapabilities.push("measure_temperature");
						climateCapabilities.push("climate_mode");
						climateCapabilities.push("climate_action");					

						if ((climateFeatures & 1) == 1) {
							climateCapabilities.push("target_temperature");
						}
						if (climateEntity.attributes.current_humidity){
							climateCapabilities.push("measure_humidity");
						}
						capabilitiesOptions = 
							{
								target_temperature: {}
							};
						if (climateEntity.attributes.min_temp){
							capabilitiesOptions.target_temperature["min"] = climateEntity.attributes.min_temp;
						}
						if (climateEntity.attributes.max_temp){
							capabilitiesOptions.target_temperature["max"] = climateEntity.attributes.max_temp;
						}
						if (climateEntity.attributes.target_temp_step){
							capabilitiesOptions.target_temperature["step"] = climateEntity.attributes.target_temp_step;
						}
						else {
							capabilitiesOptions.target_temperature["step"] = 0.5;
						}
						capabilitiesOptions.target_temperature["decimals"] = 1;

						// fan data
						let fanFeatures =  fanEntity.attributes.supported_features;
							// default capabilities:
						climateCapabilities.push("onoff"); 

						if ((fanFeatures & 1) == 1) {
							climateCapabilities.push("dim"); 
						}
						if ((fanFeatures & 2) == 2) {
							climateCapabilities.push("fan_oscillate"); 
						}
						if ((fanFeatures & 4) == 4) {
							climateCapabilities.push("fan_reverse"); 
						}

						let climate_fan = {
							name: entityName,
							data: {
								id: deviceId
							},
							capabilities:climateCapabilities,
							capabilitiesOptions: capabilitiesOptions,
							store: {
								climateFeatures: climateFeatures,
								fanFeatures: fanFeatures,
								entities: entities
							}
						};

						climate_fans.push(climate_fan);
					}
				}

			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(climate_fans);
		return climate_fans;
	}

	// LIGHT ================================================================================================ LIGHT
	getLights() {
		this._app.log("Prepare LIGHT devices list.");
		let lights = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("light.")) {
					let entity = this._entities[id];
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
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(lights);
		return lights;
	}

	// SWITCH / INPUT BOOLEAN ============================================================== SWITCH / INPUT BOOLEAN
	getCovers() {
		this._app.log("Prepare COVER devices list.");
		let covers = [];
		Object.keys(this._entities).forEach(id => {
			if(this._entities[id] == undefined || this._entities[id] == null){
				return;
			}
			try {
				if(id.startsWith("cover.") ) {
					let entity = this._entities[id];
					let entityName = entity.attributes["friendly_name"] || id;
					let features = entity.attributes.supported_features;

					let coverCapabilities = [];

					// Supported features
					// https://github.com/home-assistant/core/blob/dev/homeassistant/components/cover/__init__.py
					// class CoverEntityFeature(IntFlag):
					// """Supported features of the cover entity."""
					// OPEN = 1
					// CLOSE = 2
					// SET_POSITION = 4
					// STOP = 8
					// OPEN_TILT = 16
					// CLOSE_TILT = 32
					// STOP_TILT = 64
					// SET_TILT_POSITION = 128
					if ((features & 1) == 1 && 
					    (features & 2) == 2) {
						coverCapabilities.push("windowcoverings_state"); 
						coverCapabilities.push("windowcoverings_closed");
					}
					if ((features & 4) == 4) {
						coverCapabilities.push("windowcoverings_set"); 
					}
					if ((features & 16) == 16) {
						coverCapabilities.push("windowcoverings_tilt_up"); 
					}
					if ((features & 32) == 32) {
						coverCapabilities.push("windowcoverings_tilt_down"); 
					}
					if ((features & 128) == 128) {
						coverCapabilities.push("windowcoverings_tilt_set"); 
					}

					covers.push({
						name: entityName,
						data: {
							id: id
						},
						store:{
							features: features
						},
						capabilities: coverCapabilities
					});
				}
			} 
			catch(ex) {
				this._app.error("Failed to convert entity: "+id, ex);
			}
		});
		this.sortEntities(covers);
		return covers;
	}

	// Device / API Services ==============================================================================================
	async turnOnOff(entityId, on) {
		this._app.log("turnOnOff: "+entityId+" "+on);
		try {
			if(this.isConnected()) {
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
			if(this.isConnected()) {
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
			if(this.isConnected()) {
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

	async ping(){
		try {
			await this._connection.ping();
			return true;
		}
		catch (error) {
			this._app.error("Ping error:", error);
			throw error;
		}
	}

	async sendMessage(message){
		// Sends WS message to HA and receives the data
		// type MessageBase = {
		// 	id?: number;
		// 	type: string;
		// 	[key: string]: any;
		// };
		try {
			if(this.isConnected()) {
				let result = await this._connection.sendMessagePromise(message);
				return result;
			}
		}
		catch (error) {
			this._app.error("sendMessage error:", error);
			throw error;
		}
	}

}

module.exports = Client