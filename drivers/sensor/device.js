'use strict';

const Homey = require('homey');

class SensorDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capability = this.getCapabilities()[0];

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );
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
            this.error("Error adding capability: "+Error.message);
        }
    }

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    async onInitDevice(){
        // Init device on satrtup with latest data to have initial values before HA sends updates
        this.homey.clearTimeout(this.timeoutInitDevice);
        this.timeoutInitDevice = null;

        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        let entity = this._client.getEntity(this.entityId);
        if (entity){
            this.onEntityUpdate(entity);
        }
    }

    async onEntityUpdate(data) {
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
        catch(ex) {
            this.log("error", ex);
        }
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = SensorDevice;