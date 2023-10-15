'use strict';

const BaseDevice = require('../basedevice');

class AlarmControlPanelDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('alarm_control_panel_mode', async (value, opts) => {
            await this._onCapabilityAlarmControlPanelMode(value, opts);
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

    // Flow Actions
    async flowActionAlarmControlPanelMode(args){
        await this._onCapabilityAlarmControlPanelMode( args.mode, {});
    }

}

module.exports = AlarmControlPanelDevice;