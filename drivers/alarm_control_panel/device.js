'use strict';

const BaseDevice = require('../basedevice');

class AlarmControlPanelDevice extends BaseDevice {

    async onInit() {
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

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        await super.onEntityUpdate(data);

        if(data && data.entity_id && data.entity_id == this.entityId) {
            try{
                await this.setCapabilityValue("alarm_control_panel_mode", data.state);
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
                    await this.setCapabilityValue("alarm_control_panel_alarm", state);
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

}

module.exports = AlarmControlPanelDevice;