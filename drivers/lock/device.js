'use strict';

const BaseDevice = require('../basedevice');

class LockDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        // Capability listener for device capabilities
        this.registerCapabilityListener('locked', async (value, opts) => {
            await this._onCapabilityLocked(value, opts);
        });
        this.registerCapabilityListener('lock_open', async (value, opts) => {
            await this._onCapabilityLockOpen();
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
            await this.setCapabilityValue("locked", data.state == "locked");
        }
    }

    // Capabilities ===========================================================================================
    async _onCapabilityLocked( value, opts ) {
        this.log("Lock locked: "+value);
        let entityId = this.entityId;
        if (value){
            await this._client.callService("lock", "lock", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("lock", "unlock", {
                "entity_id": entityId
            });
        }
        return true;
    }
    async _onCapabilityLockOpen() {
        this.log("Lock opened");
        let entityId = this.entityId;
        await this._client.callService("lock", "open", {
            "entity_id": entityId
        });
        return true;
    }

    // Device functions ===========================================================================================
    async lockOpen(args){
        await this._onCapabilityLockOpen();
    }
}

module.exports = LockDevice;