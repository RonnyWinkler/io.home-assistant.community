if (process.env.DEBUG === '1')
{
    require('inspector').open(9225, '0.0.0.0', true);
}

'use strict';

const Homey = require('homey');
const { join } = require('path');
const Client = require('./lib/Client.js');

class App extends Homey.App {
	
	async onInit() {
		this.homey.on('unload', async () => await this.onUninit());

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
				this.error("Error executing flowAction 'callServiceSelection': "+  error.message);
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

		// Flow trigger for all capabilities
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
		
		// Flow Trigger: Buttopn pressed
		this._flowTriggerButtonPressed = this.homey.flow.getDeviceTriggerCard('button_pressed');

		// Flow contitions
		this._flowConditionMeasureNumeric = this.homey.flow.getConditionCard('measure_numeric')
		.registerRunListener(async (args, state) => {
		  return (args.device.getCapabilityValue('measure_numeric') > args.value);
		})
		this._flowConditionMeasureNumeric = this.homey.flow.getConditionCard('measure_generic')
		.registerRunListener(async (args, state) => {
		  return (args.device.getCapabilityValue('measure_generic') == args.value);
		})
  
		// App events
		this.homey.settings.on("set", async (key) =>  {
			if (key = "login" && this.homey.settings.get("login") == true){
				await this.homey.settings.set("login", false);
				await this._reconnectClient();
			}
		});
	}

	async onUninit(){
		this.log("App onUninit() - close connection");
		await this._client.close();
		this._client = null;
		this.log("App onUninit() - finished");
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
			this.error("Connect error: "+ error.message);
		}
	}

	async _onFlowActionCallService(args) {
		this.log("Call service. Domain: "+args.domain+" Service: "+args.service+" Data: "+args.data);
		await this._client.callService(args.domain, args.service, args.data);
	}

	async _onFlowActionCallServiceEntity(args) {
		this.log("Call entity service. Service: "+args.service.id+" Entity: "+args.entity.id+" Data: "+args.data);
		try{
			let data = args.data;
			if (args.entity){
				let json = JSON.parse(data);
				json["entity_id"] = args.entity.id;
				data = JSON.stringify(json);
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

	async clientReconnect(){
		await this._reconnectClient();
	}
}

module.exports = App;