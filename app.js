if (process.env.DEBUG === '1')
{
    require('inspector').open(9225, '0.0.0.0', true);
}

'use strict';

const Homey = require('homey');
const { join } = require('path');
const Client = require('./lib/Client.js');
const RECONNECT_TIMEOUT = 30;

class App extends Homey.App {
	
	async onInit() {
		// Homey events
		this.homey.on('unload', async () => await this.onUninit());
		this.homey.on('memwarn', async (data) => await this.onMemwarn(data));

		// Autocomplete Lists:
		this.entityList = {};
		this.serviceList = {};

		this.log('Home-Assistant is running...');

		// Init client and connect
		let address = this.homey.settings.get("address");
		let token = this.homey.settings.get("token");

		this._client = new Client(this);
		this._client.on("connection_update", (state) => {
				this.homey.api.realtime('connection_update', state);
			});

		try{
			await this._client.connect(address, token, false);
		}
		catch(error){
			this.error("Connect error: "+ error);
		}

		// Flow actions
		this._flowActionCallService = this.homey.flow.getActionCard('callService')
		this._flowActionCallService.registerRunListener(async (args, state) => {
			try{
				await this._onFlowActionCallService(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'callService': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionSendNotification = this.homey.flow.getActionCard('sendNotification')
		this._flowActionSendNotification.registerRunListener(async (args, state) => {
			try{
				await this._onFlowActionSendNotification(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'sendNotification': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLockOpen = this.homey.flow.getActionCard('lockOpen')
		this._flowActionLockOpen.registerRunListener(async (args, state) => {
			try{
				await args.device.lockOpen();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lockOpen': "+  error.message);
				throw new Error(error.message);
			}
		});

		this._flowActionSendNotificationToService = this.homey.flow.getActionCard('sendNotificationToService');
		this._flowActionSendNotificationToService.registerRunListener(async (args, state) => {
			try{
				await this._onFlowActionSendNotificationToService(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'sendNotificationToService': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionSendNotificationToService.registerArgumentAutocompleteListener('service', async (query, args) => {
			this.serviceList = await this._getAutocompleteServiceList();
			return this.serviceList.filter((result) => { 
				return ( ( result.id.startsWith("notify.") || result.id.includes(".send_message") || result.id.includes(".send_photo") ) && 
						 result.name.toLowerCase().includes(query.toLowerCase()) );
			});
		});
		this._flowActionSendNotificationImageToService = this.homey.flow.getActionCard('sendNotificationImageToService');
		this._flowActionSendNotificationImageToService.registerRunListener(async (args, state) => {
			try{
				await this._onFlowActionSendNotificationToService(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'sendNotificationImageToService': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionSendNotificationImageToService.registerArgumentAutocompleteListener('service', async (query, args) => {
			this.serviceList = await this._getAutocompleteServiceList();
			return this.serviceList.filter((result) => { 
				return ( ( result.id.startsWith("notify.") || result.id.includes(".send_message") || result.id.includes(".send_photo") ) && 
						 result.name.toLowerCase().includes(query.toLowerCase()) );
			});
		});


		// Media
		this._flowActionMediaSelectSource = this.homey.flow.getActionCard('mediaSelectSource');
		this._flowActionMediaSelectSource.registerRunListener(async (args, state) => {
			try{
				await args.device.setSource(args.source.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'mediaSelectSource': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionMediaSelectSource.registerArgumentAutocompleteListener('source', async (query, args) => {
			const sourceList = args.device.getSourceList();
			return sourceList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
			
		});

		this._flowActionMediaSelectSoundMode = this.homey.flow.getActionCard('mediaSelectSoundMode');
		this._flowActionMediaSelectSoundMode.registerRunListener(async (args, state) => {
			try{
				await args.device.setSoundMode(args.mode.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'mediaSelectSoundMode': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionMediaSelectSoundMode.registerArgumentAutocompleteListener('mode', async (query, args) => {
			const soundModeList = args.device.getSoundModeList();
			return soundModeList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
		});

		this._flowActionCallServiceEntity = this.homey.flow.getActionCard('callServiceEntity');
		this._flowActionCallServiceEntity.registerRunListener(async (args, state) => {
			try{
				await this._onFlowActionCallServiceEntity(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'callServiceEntity': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionCallServiceEntity.registerArgumentAutocompleteListener('service', async (query, args) => {
			this.serviceList = await this._getAutocompleteServiceList();
			return this.serviceList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
		});
		this._flowActionCallServiceEntity.registerArgumentAutocompleteListener('entity', async (query, args) => {
			let listCount = Object.keys(this.entityList).length;
			let entityCount = this._client.getEntitiesCount();
			if ( listCount != entityCount){
				this.entityList = await this._getAutocompleteEntityList();
			}
			return this.entityList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
		});

		// Climate
		this._flowActionClimateMode = this.homey.flow.getActionCard('climateMode');
		this._flowActionClimateMode.registerRunListener(async (args, state) => {
			try{
				await args.device.setMode(args.mode);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'climateMode': "+  error.message);
				throw new Error(error.message);
			}
		});

		this._flowActionClimateSelectModeFan = this.homey.flow.getActionCard('climateSelectModeFan');
		this._flowActionClimateSelectModeFan.registerRunListener(async (args, state) => {
			try{
				await args.device.setModeFan(args.source.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'climateSelectModeFan': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionClimateSelectModeFan.registerArgumentAutocompleteListener('mode', async (query, args) => {
			const modeFanList = args.device.getModesFanList();
			return modeFanList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
			
		});

		this._flowActionClimateSelectModePreset = this.homey.flow.getActionCard('climateSelectModePreset');
		this._flowActionClimateSelectModePreset.registerRunListener(async (args, state) => {
			try{
				await args.device.setModePreset(args.source.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'climateSelectModePreset': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionClimateSelectModePreset.registerArgumentAutocompleteListener('mode', async (query, args) => {
			const modePresetList = args.device.getModesPresetList();
			return modePresetList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
			
		});

		this._flowActionClimateSelectModeSwing = this.homey.flow.getActionCard('climateSelectModeSwing');
		this._flowActionClimateSelectModeSwing.registerRunListener(async (args, state) => {
			try{
				await args.device.setModeSwing(args.source.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'climateSelectModeSwing': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionClimateSelectModeSwing.registerArgumentAutocompleteListener('mode', async (query, args) => {
			const modeSwingList = args.device.getModesSwingList();
			return modeSwingList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
			
		});

		// Fan
		this._flowActionFanOscillateOn = this.homey.flow.getActionCard('fanOscillateOn')
		this._flowActionFanOscillateOn.registerRunListener(async (args, state) => {
			try{
				await args.device.setOscillateOn();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'fanOscillateOn': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionFanOscillateOff = this.homey.flow.getActionCard('fanOscillateOff')
		this._flowActionFanOscillateOff.registerRunListener(async (args, state) => {
			try{
				await args.device.setOscillateOff();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'fanOscillateOff': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionFanReverseOn = this.homey.flow.getActionCard('fanReverseOn')
		this._flowActionFanReverseOn.registerRunListener(async (args, state) => {
			try{
				await args.device.setReverseOn();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'fanReverseOn': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionFanReverseOff = this.homey.flow.getActionCard('fanReverseOff')
		this._flowActionFanReverseOff.registerRunListener(async (args, state) => {
			try{
				await args.device.setReverseOff();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'fanReverseOff': "+  error.message);
				throw new Error(error.message);
			}
		});

		// Flow trigger for all capabilities (compound device)
		this._flowTriggerCapabilityChanged = this.homey.flow.getDeviceTriggerCard('capability_changed');
		this._flowTriggerCapabilityChanged.registerRunListener(async (args, state) => {
			return ( !args.capability || !args.capability.id || args.capability.id === state.capability.id);
		});
		this._flowTriggerCapabilityChanged.registerArgumentAutocompleteListener('capability', async (query, args) => {
			const capabilityList = args.device.getAutocompleteCapabilityList();
			return capabilityList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
		});
		
		// Flow Trigger: App
		this._flowTriggerAppMemwarn = this.homey.flow.getTriggerCard('app_memwarn');

		this._flowTriggerScriptStartedFilter = this.homey.flow.getTriggerCard("script_started_filter");
        this._flowTriggerScriptStartedFilter.registerRunListener(async (args, state) => {
            return ( !args.name || args.name === state.name);
        });
		this._flowTriggerAutomationTriggeredFilter = this.homey.flow.getTriggerCard("automation_triggered_filter");
        this._flowTriggerAutomationTriggeredFilter.registerRunListener(async (args, state) => {
            return ( !args.name || args.name === state.name);
        });

		// Flow Trigger: Devices
		this._flowTriggerButtonPressed = this.homey.flow.getDeviceTriggerCard('button_pressed');
		this._flowTriggerSceneActivated = this.homey.flow.getDeviceTriggerCard('scene_activated');
		this._flowTriggerScriptStarted = this.homey.flow.getDeviceTriggerCard('script_started');

		// Flow contitions
		this._flowConditionMeasureNumeric = this.homey.flow.getConditionCard('measure_numeric')
		.registerRunListener(async (args, state) => {
			// return (state.value == args.value);
			return (args.device.getCapabilityValue(state.capability.id) > args.value);
		})
		this._flowConditionMeasureGeneric = this.homey.flow.getConditionCard('measure_generic')
		.registerRunListener(async (args, state) => {
			// return (state.value == args.value);
		  	return (args.device.getCapabilityValue(state.capability.id) == args.value);
		})
		this._flowConditionClimateMode = this.homey.flow.getConditionCard('climate_mode')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('climate_mode') == args.mode);
			}
			else{
				return (state.value == args.mode);
			}
			// return (args.device.getCapabilityValue('climate_mode') == args.mode);
		})
		this._flowConditionClimateModeFan = this.homey.flow.getConditionCard('climate_mode_fan')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('climate_mode_fan') == args.mode);
			}
			else{
				return (state.value == args.mode);
			}
			// return (args.device.getCapabilityValue('climate_mode_fan') == args.mode);
		})
		this._flowConditionClimateModePreset = this.homey.flow.getConditionCard('climate_mode_preset')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('climate_mode_preset') == args.mode);
			}
			else{
				return (state.value == args.mode);
			}
			// return (args.device.getCapabilityValue('climate_mode_preset') == args.mode);
		})
		this._flowConditionClimateModeSwing = this.homey.flow.getConditionCard('climate_mode_swing')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('climate_mode_swing') == args.mode);
			}
			else{
				return (state.value == args.mode);
			}
			// return (args.device.getCapabilityValue('climate_mode_swing') == args.mode);
		})
		this._flowConditionAlarmPresence = this.homey.flow.getConditionCard('alarm_presence')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('alarm_presence'));
			}
			else{
				return (state.value == true);
			}
			// return (args.device.getCapabilityValue('alarm_presence'));
		})
		this._flowConditionPresenceState = this.homey.flow.getConditionCard('presence_state')
		.registerRunListener(async (args, state) => {
			if (state.manual == true){
				return (args.device.getCapabilityValue('presence_state') == args.value);
			}
			else{
				return (state.value == args.state);
			}
			// return (args.device.getCapabilityValue('presence_state') == args.value);
		})
  
		// App events
		this.homey.settings.on("set", async (key) =>  {
			if (key = "login" && this.homey.settings.get("login") == true){
				await this.homey.settings.set("login", false);
				await this._reconnectClient();
			}
		});

		// Init device with a short timeout to wait for initial entities
		this.timeoutCheckConnection = this.homey.setTimeout(async () => this.onCheckConnection().catch(e => console.log(e)), RECONNECT_TIMEOUT * 60 * 1000 );

	}

	async onUninit(){
		this.log("App onUninit() - close connection");
		await this._client.close();
		this._client = null;
		if (this.timeoutCheckConnection){
            this.homey.clearTimeout(this.timeoutCheckConnection);
            this.timeoutCheckConnection = null;     
		}
		this.log("App onUninit() - finished");
	}

	async onMemwarn(data){
		this.error("A memory warning has occured.");
		this._flowTriggerAppMemwarn.trigger(data);
	}

	getClient() {
		return this._client;
	}

	async _reconnectClient() {
		console.log("settings updated.... reconnecting");

		let address = this.homey.settings.get("address");
		let token = this.homey.settings.get("token");

		try{
			await this._client.connect(address, token, true);
		}
		catch(error){
			this.error("Connect error: "+ error);
		}
	}

	async _onFlowActionCallService(args) {
		this.log("Call service. Domain: "+args.domain+" Service: "+args.service+" Data: "+args.data);
		await this._client.callService(args.domain, args.service, args.data);
	}

	async _onFlowActionSendNotification(args) {
		this.log("Send notification.");
		let data = {
			title: args.title,
			message: args.message
		};
		await this._client.callService("notify", "notify", data);
	}

	async _onFlowActionSendNotificationToService(args) {
		this.log("Send notification to service "+args.service);
		let data = {
			title: args.title,
			message: args.message
		};
		if (args.droptoken != undefined){
			let url = null;
			if (args.url != undefined && args.url == "cloud"){
				url = args.droptoken.cloudUrl;
			}
			else{
				url = args.droptoken.localUrl;
			}
			if (url != undefined && url != null){
				if (args.service.id.startsWith("notify.")){
					data["data"] = {
						image: url
					}
				}
				else if (args.service.id.includes(".send_photo")){
					data["url"] = url;
					data["caption"] = args.message;
				}
			}
		}
		await this._client.callService(args.service.id.split('.')[0], args.service.id.split('.')[1], data);
	}

	async _onFlowActionCallServiceEntity(args) {
		if (args.entity){
			this.log("Call entity service. Service: "+args.service.id+" | Entity: "+args.entity.id+" | Data: "+args.data);
		}
		else{
			this.log("Call entity service. Service: "+args.service.id+" | Entity: not selected | Data: "+args.data);
		}
		try{
			let data = this.jsonEscape(args.data);
			if (args.entity){
				let json = JSON.parse(data);
				json["entity_id"] = args.entity.id;
				data = this.jsonUnescape(JSON.stringify(json));
			}
			await this._client.callService(args.service.id.split('.')[0], args.service.id.split('.')[1], data);

		}
		catch(error){
			throw new Error(error.message);
		}
	}

	async _getAutocompleteServiceList(){
		let domainServices = await this._client.getServices();
		let domains = Object.keys(domainServices);
		this.sortKeys(domains);
		let result = [];
		for (let i=0; i<domains.length; i++){
			let services = Object.keys(domainServices[domains[i]]); 
			for (let j=0; j<services.length; j++){

				result.push({
					id: domains[i]+"."+services[j],
					name: domains[i]+"."+services[j]
				})
			}
		}
		return result;
	}

	async _getAutocompleteEntityList(){
		let entities = this._client.getEntities();
		let keys = Object.keys(entities);
		this.sortKeys(keys);
		let result = [];
		for (let i=0; i<keys.length; i++){
			result.push({
				id: keys[i],
				name: keys[i]
			})
		}
		return result;
	}

	sortKeys(keys){
		keys.sort(function(a, b){
			let x = a.toLowerCase();
			let y = b.toLowerCase();
			if (x < y) {return -1;}
			if (x > y) {return 1;}
			return 0;
		});
	}

	jsonEscape(str)  {
		// return str.replace(/\n/g, " ").replace(/\r/g, " ").replace(/\t/g, " ");
		return str.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
	}
	jsonUnescape(str)  {
		return str.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
	}

	async clientReconnect(){
		await this._reconnectClient();
	}

	async onCheckConnection(){
 		this.timeoutCheckConnection = this.homey.setTimeout(async () => this.onCheckConnection().catch(e => console.log(e)), RECONNECT_TIMEOUT * 60 * 1000 );
		try{
			let result = await this._client.ping();
			if (!result){
				this.error("Error checking connection: No correst response content");
				await this._reconnectClient();
			}
			else{
				this.log("Connection check: OK.");
			}
        }
        catch(error){
            this.error("Error checking connection: ", error);
            this.log("Start reconnect...");
			await this._reconnectClient();
        }
	}

}

module.exports = App;