'use strict';

const BaseDevice = require('../basedevice');

class ScheduleDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

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
            await this.setCapabilityValue("alarm_generic", data.state == "on");

            if (data.attributes.next_event != undefined){
                let tz  = this.homey.clock.getTimezone();
                let time = new Date(data.attributes.next_event).toLocaleString(this.homey.i18n.getLanguage(), 
                { 
                    hour12: false, 
                    timeZone: tz,
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
                let schedule = time.replace(',', '');
                await this.setCapabilityValue("schedule_next_event", schedule);
            }
        }
    }

}

module.exports = ScheduleDevice;