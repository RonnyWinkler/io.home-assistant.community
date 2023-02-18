'use strict';

const BaseDevice = require('../basedevice');

class SensorDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.capability = this.getCapabilities()[0];

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
        try {
            // let value = this.getCapabilityValue(this.capability);
            // switch (typeof(value)){
            //     case "number":
            //         await this.setCapabilityValue(this.capability, parseFloat(data.state));
            //         break;
            //     case "boolean":
            //         await this.setCapabilityValue(this.capability, data.state == "on")
            //         break;
            //     case "string":
            //         await this.setCapabilityValue(this.capability, data.state);
            //         break;
            // }
            if (this.capability == "measure_generic"){
                // String capabilities
                await this.setCapabilityValue(this.capability, data.state);
            }
            else if (this.capability.startsWith("alarm")){
                // boolean capability
                await this.setCapabilityValue(this.capability, data.state == "on");
            }
            else{
                // numeric capability
                await this.setCapabilityValue(this.capability, parseFloat(data.state));
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

}

module.exports = SensorDevice;