'use strict';

const BaseDevice = require('../basedevice');

class TimerDevice extends BaseDevice {

    async onInit() {
        await super.onInit();
        this.registerCapabilityListener('timer_start', async () => {
            await this._onCapabilityTimerService('start');
        });
        this.registerCapabilityListener('timer_pause', async () => {
            await this._onCapabilityTimerService('pause');
        });
        this.registerCapabilityListener('timer_stop', async () => {
            await this._onCapabilityTimerService('cancel');
        });
        this.registerCapabilityListener('timer_finish', async () => {
            await this._onCapabilityTimerService('finish');
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
        try {
            if(data && data.entity_id && data.entity_id == this.entityId) {
                if (data.state != undefined &&
                    data.state != "unavailable"){
                    try{
                        await this.setCapabilityValue('timer_state', data.state);
                    }
                    catch(error){
                        this.log("Unknown state: "+data.state);
                    }
                }
                if (data.attributes.duration != undefined ){
                    await this.setCapabilityValue('timer_duration', data.attributes.duration);
                }
                else{
                    await this.setCapabilityValue('timer_duration', '0:00:00');
                }
                if (data.attributes.remaining != undefined ){
                    await this.setCapabilityValue('timer_remaining', data.attributes.remaining);
                }
                else{
                    await this.setCapabilityValue('timer_remaining', '0:00:00');
                }
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Timer events ============================================================================================
    async onTimerEvent(event){
        this.log("Timer-Event: ", event.event_type);
        switch (event.event_type){
            case 'timer.started':
                this.homey.app._flowTriggerTimerStarted.trigger(this, {}, {});
                break;
            case 'timer.paused':
                this.homey.app._flowTriggerTimerPaused.trigger(this, {}, {});
                break;
            case 'timer.cancelled':
                this.homey.app._flowTriggerTimerCancelled.trigger(this, {}, {});
                break;
            case 'timer.restarted':
                this.homey.app._flowTriggerTimerRestarted.trigger(this, {}, {});
                break;
            case 'timer.finished':
                this.homey.app._flowTriggerTimerFinished.trigger(this, {}, {});
                break;
        }
    }

    // Capabilities ===========================================================================================?
    async _onCapabilityTimerService(service){
        let entityId = this.entityId;

        if (service == 'start'){
            let data = { "entity_id": entityId };
            let durationSec = this.getSetting("duration_sec");
            let durationMin = this.getSetting("duration_min");
            let durationHour = this.getSetting("duration_hour");
            let duration = durationSec + durationMin * 60 + durationHour * 60 * 60;  
            if (duration != undefined && duration != 0){
                data["duration"] = duration;
                this.setSettings({duration_sec: 0});
                this.setSettings({duration_min: 0});
                this.setSettings({duration_hour: 0});
            }
            await this._client.callService("timer", "start", data);
            return true;
        }
        else{
            await this._client.callService("timer", service, {
                "entity_id": entityId
            });
        }
        return true;
    }

    // Flow actions ===========================================================================================?
    async timerStartDuration(args){
        let entityId = this.entityId;
        let data = { "entity_id": entityId };

        let duration = 0;
        if (args.seconds != undefined){
            duration += args.seconds;
        }
        if (args.minutes != undefined){
            duration += (args.minutes * 60);
        }
        if (args.hours != undefined){
            duration += (args.hours * 60 * 60);
        }
        if (duration > 0 ){
            data["duration"] = duration;
        }
        await this._client.callService("timer", "start", data);
        return true;
    }
    async timerStart(){
        await this._onCapabilityTimerService('start');
    }
    async timerStop(){
        await this._onCapabilityTimerService('cancel');
    }
    async timerPause(){
        await this._onCapabilityTimerService('pause');
    }
    async timerFinish(){
        await this._onCapabilityTimerService('finish');
    }
}

module.exports = TimerDevice;