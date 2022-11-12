'use strict';

const BaseDevice = require('../basedevice');

class PresenceDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });
    }

    async onSettings(settings){
        try {
            let alarm = (this.getCapabilityValue("presence_state") == "home");
            if (settings.newSettings.invert_alarm){
                alarm = !alarm;
            }
            await this.setCapabilityValue("alarm_presence", alarm);
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
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
        try {
            if (data.state != undefined){
                // String capabilities
                await this.setCapabilityValue("presence_state", data.state);
            }
            let alarm = (data.state == "home");
            if (this.getSetting("invert_alarm")){
                alarm = !alarm;
            }
            await this.setCapabilityValue("alarm_presence", alarm);
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

}

module.exports = PresenceDevice;