if (process.env.DEBUG === '1')
{
    require('inspector').open(9225, '0.0.0.0', true);
}

'use strict';

const Homey = require('homey');
const Client = require('./lib/Client.js');

class App extends Homey.App {
	
	async onInit() {
		await super.onInit();
		this.homey.on('unload', async () => await this.onUninit());

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
		console.log("App onUninit() - close connection");
		await this._client.close();
		this._client = null;
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

	async clientReconnect(){
		await this._reconnectClient();
	}
}

module.exports = App;