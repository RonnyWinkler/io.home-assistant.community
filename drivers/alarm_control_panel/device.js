'use strict';

const BaseDevice = require('../basedevice');

class AlarmControlPanelDevice extends BaseDevice {

    async onInit() {
        this.features = this.getStoreValue('features') || undefined;

        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('alarm_control_panel_mode', async (value, opts) => {
            await this._onCapabilityAlarmControlPanelMode(value, opts);
        });
        this.registerCapabilityListener('alarm_control_panel_alarm_reset', async (value, opts) => {
            await this._onCapabilityAlarmControlPanelAlarmReset(value, opts);
        });
        this.registerCapabilityListener('alarm_control_panel_alarm_trigger', async (value, opts) => {
            await this._onCapabilityAlarmControlPanelAlarmTrigger(value, opts);
        });
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        try{
            if (!this.hasCapability('button.reconnect'))
            {
                await this.addCapability('button.reconnect');
            }
            if (!this.hasCapability('alarm_control_panel_state'))
            {
                await this.addCapability('alarm_control_panel_state');
            }
            if (!this.hasCapability('alarm_control_panel_alarm'))
            {
                await this.addCapability('alarm_control_panel_alarm');
            }
            if (!this.hasCapability('alarm_control_panel_alarm_reset'))
            {
                await this.addCapability('alarm_control_panel_alarm_reset');
            }
            if (!this.hasCapability('alarm_control_panel_alarm_trigger'))
            {
                await this.addCapability('alarm_control_panel_alarm_trigger');
            }
        }
        catch(error){
            this.error("Error adding capability: "+error.message);
        }
    }


    // Device update ============================================================================================
    async _checkFeatures(features){
        // check features
        // https://github.com/home-assistant/core/blob/4da93f6a5ed4079ae292a1908d2b798a8a0e7fac/homeassistant/components/alarm_control_panel/const.py#L49
        // ARM_HOME = 1
        // ARM_AWAY = 2
        // ARM_NIGHT = 4
        // TRIGGER = 8
        // ARM_CUSTOM_BYPASS = 16
        // ARM_VACATION = 32

        if (features != undefined && this.features != features){
            this.features = features;
            await this.setStoreValue('features', features);
            try{
                let modes = [];
                if ((features & 1) == 1) {
                    modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'armed_home'));
                }
                if ((features & 2) == 2) {
                    modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'armed_away') );
                }
                if ((features & 4) == 4) {
                    modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'armed_night') );
                }
                if ((features & 16) == 16) {
                    modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'armed_custom_bypass') );
                }
                if ((features & 32) == 32) {
                    modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'armed_vacation') );
                }
                modes.push( this.homey.app.manifest.capabilities.alarm_control_panel_mode.values.find(u => u.id === 'disarmed') );
                await this.setCapabilityEnumList("alarm_control_panel_mode", modes);

                if ((features & 8) != 8 && this.hasCapability('alarm_control_panel_alarm_trigger')){
                    this.removeCapability('alarm_control_panel_alarm_trigger');
                }
                if ((features & 8) == 8 && !this.hasCapability('alarm_control_panel_alarm_trigger')){
                    this.addCapability('alarm_control_panel_alarm_trigger');
                }
            }
            catch(error){
                this.log("AlarmPanel onInitDevice() Error updating features: "+error.message);
            }
            
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);

        if(data && data.entity_id && data.entity_id == this.entityId) {
            // store feature
            this._checkFeatures(data.attributes.supported_features);

            try{
                await this.setCapabilityValue("alarm_control_panel_mode", data.state);
                // Realtime event - Widget update 
                await this.widgetUpdate();
            }
            catch(error){
                this.log("Error setting alarm_control_panel_mode" + error.message);
            }
            try{
                let state = data.state;
                if (state.startsWith('armed')){
                    state = 'armed';
                }
                if (state != 'triggered'){
                    await this.setCapabilityValue("alarm_control_panel_state", state);
                }
                else{
                    this.homey.app._flowTriggerAlarmControlPanelTriggered.trigger(this, {}, {});
                    await this.setCapabilityValue("alarm_control_panel_alarm", true);
                }
            }
            catch(error){
                this.log("Error setting alarm_control_panel_state" + error.message);
            }
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityAlarmControlPanelMode( value, opts ) {
        let code = this.getSetting('code');
        if (opts.code){
            code = opts.code;
        }
        let service = '';
        switch (value){
            case 'disarmed':
                service = "alarm_disarm";
                break;
            case 'armed_home':
                service = "alarm_arm_home";
                break;
            case 'armed_away':
                service = "alarm_arm_away";
                break;
            case 'armed_night':
                service = "alarm_arm_night";
                break;
            case 'armed_vacation':
                service = "alarm_arm_vacation";
                break;
            case 'armed_custom_bypass':
                service = "alarm_arm_custom_bypass";
                break;
        }
        await this._client.callService("alarm_control_panel", service, {
            "entity_id": this.entityId,
            "code": code
        });
    }

    async _onCapabilityAlarmControlPanelAlarmReset( value, opts){
        await this.setCapabilityValue("alarm_control_panel_alarm", false);
    }

    async _onCapabilityAlarmControlPanelAlarmTrigger( value, opts){
        let code = this.getSetting('code');
        await this._client.callService("alarm_control_panel", 'alarm_trigger', {
            "entity_id": this.entityId,
            "code": code
        });
    }

    // Flow Actions
    async flowActionAlarmControlPanelMode(args){
        await this._onCapabilityAlarmControlPanelMode( args.mode, {});
    }

    // Widget Actions
    async widgetUpdate(){
        // Redefinition: Trigger Widget update by sending a realtime event
        let modes = [];
        try{
            modes = await this.getCapabilityEnumList("alarm_control_panel_mode");
        }
        catch(error){}
        await this.homey.api.realtime("alarm_control_panel_state_changed", {driver_id:'alarm_control_panel', device_id: this.getData().id, 
            mode: this.getCapabilityValue("alarm_control_panel_mode"),
            modes: modes 
        } );
    }

    async widgetPost(body){
        // Redefinition: Process HTTP POST from Widget
        switch (body.command){
            case 'set_alarm_control_panel_mode':
                await this._onCapabilityAlarmControlPanelMode( body.mode, {code: body.code});
                break;
        }
    }
    
}

module.exports = AlarmControlPanelDevice;