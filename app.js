if (process.env.DEBUG === '1')
{
    require('inspector').open(9225, '0.0.0.0', true);
}

'use strict';

const Homey = require('homey');
const { join } = require('path');
const Client = require('./lib/Client.js');
const colors = require('./lib/colors.json');
const RECONNECT_TIMEOUT = 30;
const AVAILABILITY_CHECK_TIMEOUT = 30;
const LOG_SIZE = 50;


const logList = [];
const log = Homey.SimpleClass.prototype.log;
Homey.SimpleClass.prototype.log = function(...args) {
	writeLog("log", this, ...args);
	log.apply(this, args);
}
const error = Homey.SimpleClass.prototype.error;
Homey.SimpleClass.prototype.error = function(...args) {
	writeLog("err", this, ...args);
	error.apply(this, args);
}

function writeLog(type, instance, ...args){
	if (instance && instance.homey){
		let entry = "["+type+"] ";

		const tz  = instance.homey.clock.getTimezone();
		const nowTime = new Date();
		const now = nowTime.toLocaleString('en-US', 
			{ 
				hour12: false, 
				timeZone: tz,
				hour: "2-digit",
				minute: "2-digit",
				day: "2-digit",
				month: "2-digit",
				year: "numeric"
			});
		let date = now.split(", ")[0];
		date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
		let time = now.split(", ")[1];
		entry += date + " " + time + ":";
		let seconds = nowTime.getSeconds(); 
		if (seconds.length == 1)
		{
			entry += '0';
		}
		entry += seconds;

		if (instance instanceof Homey.App){
			entry += " [APP] ";
		}
		if (instance instanceof Homey.Driver){
			entry += " [Driver:" + instance.id+"] ";
			if (args[0].startsWith("[Device:")){
				return;
			}
		}
		if (instance instanceof Homey.Device){
			entry += " [Device:" + instance.getName()+"] ";
		}

		for (let i=0; i<args.length;i++){
			if (typeof(args[i]) == 'object'){
				entry += JSON.stringify(args[i]);
			}
			else{
				entry += args[i];
			}
		}

		logList.unshift(entry);
		if (logList.length > LOG_SIZE){
			logList.pop();
		}
	}
}

class App extends Homey.App {
	
	async onInit() {
		// Homey events
		this.homey.on('unload', async () => await this.onUninit());
		this.homey.on('memwarn', async (data) => await this.onMemwarn(data));
		// this.homey.on('__log', (...args) => this.onLog(...args));
		// this.homey.on('__error', (...args) => this.onError(...args));
		// this.homey.on('__debug', (...args) => this.onDebug(...args));
		
		// global attributes
		this.timeoutCheckDeviceAvailability = null;

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

		// Light
		this._flowActionLightSetHue = this.homey.flow.getActionCard('lightSetHue')
		this._flowActionLightSetHue.registerRunListener(async (args, state) => {
			try{
				await args.device.setHue(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetHue': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLightSetColor = this.homey.flow.getActionCard('lightSetColor')
		this._flowActionLightSetColor.registerRunListener(async (args, state) => {
			try{
				await args.device.setColor(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetColor': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLightSetTemperature = this.homey.flow.getActionCard('lightSetTemperature')
		this._flowActionLightSetTemperature.registerRunListener(async (args, state) => {
			try{
				await args.device.setTemperature(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetTemperature': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLightSetTemperatureRelative = this.homey.flow.getActionCard('lightSetTemperatureRelative')
		this._flowActionLightSetTemperatureRelative.registerRunListener(async (args, state) => {
			try{
				await args.device.setTemperatureRelative(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetTemperatureRelative': "+  error.message);
				throw new Error(error.message);
			}
		});

		this._flowActionLightSetColorName = this.homey.flow.getActionCard('lightSetColorName')
		this._flowActionLightSetColorName.registerRunListener(async (args, state) => {
			try{
				await args.device.setColorName(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetColorName': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLightSetColorName.registerArgumentAutocompleteListener('light_color_name', async (query, args) => {
			this.lightColorNamesList = await this._getAutocompleteLightColorNamesList();
			return this.lightColorNamesList.filter((result) => { 
				return ( result.name.toLowerCase().includes(query.toLowerCase()) );
			});
		});

		this._flowActionLightSetColorNameDim = this.homey.flow.getActionCard('lightSetColorNameDim')
		this._flowActionLightSetColorNameDim.registerRunListener(async (args, state) => {
			try{
				await args.device.setColorName(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'lightSetColorNameDim': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionLightSetColorNameDim.registerArgumentAutocompleteListener('light_color_name', async (query, args) => {
			this.lightColorNamesList = await this._getAutocompleteLightColorNamesList();
			return this.lightColorNamesList.filter((result) => { 
				return ( result.name.toLowerCase().includes(query.toLowerCase()) );
			});
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
				await args.device.setModeFan(args.mode.id);
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
				await args.device.setModePreset(args.mode.id);
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
				await args.device.setModeSwing(args.mode.id);
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

		// Vacuum
		this._flowActionVacuumSelectFanSpeed = this.homey.flow.getActionCard('vacuumSelectFanSpeed');
		this._flowActionVacuumSelectFanSpeed.registerRunListener(async (args, state) => {
			try{
				await args.device.setFanSpeed(args.speed.id);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumSelectFanSpeed': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumSelectFanSpeed.registerArgumentAutocompleteListener('speed', async (query, args) => {
			const modeSpeedList = args.device.getModesSpeedList();
			return modeSpeedList.filter((result) => { 
				return result.name.toLowerCase().includes(query.toLowerCase());
			});
			
		});

		this._flowActionVacuumStart = this.homey.flow.getActionCard('vacuumStart');
		this._flowActionVacuumStart.registerRunListener(async (args, state) => {
			try{
				await args.device.start();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumStart': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumStop = this.homey.flow.getActionCard('vacuumStop');
		this._flowActionVacuumStop.registerRunListener(async (args, state) => {
			try{
				await args.device.stop();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumStop': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumPause = this.homey.flow.getActionCard('vacuumPause');
		this._flowActionVacuumPause.registerRunListener(async (args, state) => {
			try{
				await args.device.pause();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumPause': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumReturn = this.homey.flow.getActionCard('vacuumReturn');
		this._flowActionVacuumReturn.registerRunListener(async (args, state) => {
			try{
				await args.device.return();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumReturn': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumLocate = this.homey.flow.getActionCard('vacuumLocate');
		this._flowActionVacuumLocate.registerRunListener(async (args, state) => {
			try{
				await args.device.locate();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumLocate': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionVacuumCleanSpot = this.homey.flow.getActionCard('vacuumCleanSpot');
		this._flowActionVacuumCleanSpot.registerRunListener(async (args, state) => {
			try{
				await args.device.cleanSpot();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'vacuumCleanSpot': "+  error.message);
				throw new Error(error.message);
			}
		});

		// Timer
		this._flowActionTimerStart = this.homey.flow.getActionCard('timerStart');
		this._flowActionTimerStart.registerRunListener(async (args, state) => {
			try{
				await args.device.timerStart();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'timerStart': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionTimerStartDuration = this.homey.flow.getActionCard('timerStartDuration');
		this._flowActionTimerStartDuration.registerRunListener(async (args, state) => {
			try{
				await args.device.timerStartDuration(args);
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'timerStart': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionTimerStop = this.homey.flow.getActionCard('timerStop');
		this._flowActionTimerStop.registerRunListener(async (args, state) => {
			try{
				await args.device.timerStop();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'timerStop': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionTimerPause = this.homey.flow.getActionCard('timerPause');
		this._flowActionTimerPause.registerRunListener(async (args, state) => {
			try{
				await args.device.timerPause();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'timerPause': "+  error.message);
				throw new Error(error.message);
			}
		});
		this._flowActionTimerFinish = this.homey.flow.getActionCard('timerFinish');
		this._flowActionTimerFinish.registerRunListener(async (args, state) => {
			try{
				await args.device.timerFinish();
				return true;
			}
			catch(error){
				this.error("Error executing flowAction 'timerFinish': "+  error.message);
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
		this._flowTriggerEventTriggeredFilter = this.homey.flow.getTriggerCard("event_triggered_filter");
        this._flowTriggerEventTriggeredFilter.registerRunListener(async (args, state) => {
			// Check for event name and entity id
			if (
				( !args.event || args.event === state.event ) 
				&&
				( !args.entity || args.entity === state.entity )	
				&&
				(!args.datafield01 || state.data[args.datafield01] == args.datavalue01)
				&&
				(!args.datafield02 || state.data[args.datafield02] == args.datavalue02)
				&&
				(!args.datafield03 || state.data[args.datafield03] == args.datavalue03)
			){
				return true;
			}
			else{
				return false;
			}
        });

		// Flow Trigger: Devices
		this._flowTriggerButtonPressed = this.homey.flow.getDeviceTriggerCard('button_pressed');
		this._flowTriggerSceneActivated = this.homey.flow.getDeviceTriggerCard('scene_activated');
		this._flowTriggerScriptStarted = this.homey.flow.getDeviceTriggerCard('script_started');
		this._flowTriggerTimerStarted = this.homey.flow.getDeviceTriggerCard('timer_started');
		this._flowTriggerTimerPaused = this.homey.flow.getDeviceTriggerCard('timer_paused');
		this._flowTriggerTimerCancelled = this.homey.flow.getDeviceTriggerCard('timer_cancelled');
		this._flowTriggerTimerRestarted = this.homey.flow.getDeviceTriggerCard('timer_restarted');
		this._flowTriggerTimerFinished = this.homey.flow.getDeviceTriggerCard('timer_finished');

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
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('climate_mode') == args.mode);
			// }
			// else{
			//	return (args.device.getCapabilityValue('climate_mode') == args.mode);
			// }
			return (args.device.getCapabilityValue('climate_mode') == args.mode);
		})
		this._flowConditionClimateModeFan = this.homey.flow.getConditionCard('climate_mode_fan')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('climate_mode_fan') == args.mode);
			// }
			// else{
			// 	return (state.value == args.mode);
			// }
			return (args.device.getCapabilityValue('climate_mode_fan') == args.mode);
		})
		this._flowConditionClimateModePreset = this.homey.flow.getConditionCard('climate_mode_preset')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('climate_mode_preset') == args.mode);
			// }
			// else{
			// 	return (state.value == args.mode);
			// }
			return (args.device.getCapabilityValue('climate_mode_preset') == args.mode);
		})
		this._flowConditionClimateModeSwing = this.homey.flow.getConditionCard('climate_mode_swing')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('climate_mode_swing') == args.mode);
			// }
			// else{
			// 	return (state.value == args.mode);
			// }
			return (args.device.getCapabilityValue('climate_mode_swing') == args.mode);
		})
		this._flowConditionAlarmPresence = this.homey.flow.getConditionCard('alarm_presence')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('alarm_presence'));
			// }
			// else{
			// 	return (state.value == true);
			// }
			return (args.device.getCapabilityValue('alarm_presence'));
		})
		this._flowConditionPresenceState = this.homey.flow.getConditionCard('presence_state')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('presence_state') == args.state);
			// }
			// else{
			// 	return (state.value == args.state);
			// }
			return (args.device.getCapabilityValue('presence_state') == args.value);
		})
		this._flowConditionVacuumState = this.homey.flow.getConditionCard('vacuum_state')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('vacuum_state') == args.vacuum_state);
			// }
			// else{
			// 	return (state.value == args.vacuum_state);
			// }
			return (args.device.getCapabilityValue('vacuum_state') == args.vacuum_state);
		})
		this._flowConditionVacuumStateRaw = this.homey.flow.getConditionCard('vacuum_state_raw')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('vacuum_state_raw') == args.vacuum_state_raw);
			// }
			// else{
			// 	return (state.value == args.vacuum_state_raw);
			// }
			return (args.device.getCapabilityValue('vacuum_state_raw') == args.vacuum_state_raw);
		})
		this._flowConditionTimerActive = this.homey.flow.getConditionCard('timer_active')
		.registerRunListener(async (args, state) => {
			// if (state.manual == true){
			// 	return (args.device.getCapabilityValue('timer_state') == 'active');
			// }
			// else{
			// 	return (args.device.getCapabilityValue('timer_state') == 'active');
			// }
			return (args.device.getCapabilityValue('timer_state') == 'active');
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

	// onLog(...args){
	// }
	// onError(...args){
	
	// }
	// onDebug(...args){	
	// }

	getLog(){
		return logList;
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

	async _getAutocompleteLightColorNamesList(){
		let keys = Object.keys(colors);
		// this.sortKeys(keys);
		let result = [];
		for (let i=0; i<keys.length; i++){
			result.push({
				id: keys[i],
				name: keys[i],
				color: colors[keys[i]]
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
			// await this.checkDeviceAvailability();
        }
        catch(error){
            this.error("Error checking connection: ", error);
            this.log("Start reconnect...");
			await this._reconnectClient();
        }
	}

	async checkDeviceAvailability(){
		this.log("Check device availability...");
		let drivers = this.homey.drivers.getDrivers();
		Object.keys(drivers).forEach(async (key) => {
			let devices = drivers[key].getDevices();
			for (let i=0; i<devices.length; i++){
				devices[i].checkDeviceAvailability();
			}
		});
	}

	async checkDeviceAvailabilityTimer(){
		if (this.timeoutCheckDeviceAvailability == null){
			this.timeoutCheckDeviceAvailability = this.homey.setTimeout(
				async () => {
					this.timeoutCheckDeviceAvailability = null;
					await this.checkDeviceAvailability().catch(e => console.log(e))
				},
				AVAILABILITY_CHECK_TIMEOUT * 1000 );
		}
	}
}

module.exports = App;