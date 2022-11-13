'use strict';

const BaseDevice = require('../basedevice');

class MediaDevice extends BaseDevice {

    async onInit() {
        await super.onInit();

        this.mediaCover = null;
        this.mediaImage = await this.homey.images.createImage();
        await this.setAlbumArtImage(this.mediaImage);

        if(this.hasCapability("onoff")) {
            this.registerCapabilityListener('onoff', async (value, opts) => {
                await this._onCapabilityOnoff(value, opts)
            });
        }
        if(this.hasCapability("volume_set")) {
            this.registerCapabilityListener('volume_set', async (value, opts) => {
                await this._onCapabilityVolumeSet(value, opts)
            });
        }
        if(this.hasCapability("volume_up")) {
            this.registerCapabilityListener('volume_up', async (value, opts) => {
                await this._onCapabilityVolumeUp(value, opts)
            });
        }
        if(this.hasCapability("volume_down")) {
            this.registerCapabilityListener('volume_down', async (value, opts) => {
                await this._onCapabilityVolumeDown(value, opts)
            });
        }
        if(this.hasCapability("volume_mute")) {
            this.registerCapabilityListener('volume_mute', async (value, opts) => {
                await this._onCapabilityVolumeMute(value, opts)
            });
        }
        if(this.hasCapability("speaker_playing")) {
            this.registerCapabilityListener('speaker_playing', async (value, opts) => {
                await this._onCapabilitySpeakerPlaying(value, opts)
            });
        }
        if(this.hasCapability("speaker_next")) {
            this.registerCapabilityListener('speaker_next', async (value, opts) => {
                await this._onCapabilitySpeakerNext(value, opts)
            });
        }
        if(this.hasCapability("speaker_prev")) {
            this.registerCapabilityListener('speaker_prev', async (value, opts) => {
                await this._onCapabilitySpeakerPrev(value, opts)
            });
        }
        if(this.hasCapability("speaker_shuffle")) {
            this.registerCapabilityListener('speaker_shuffle', async (value, opts) => {
                await this._onCapabilitySpeakerShuffle(value, opts)
            });
        }
        if(this.hasCapability("speaker_repeat")) {
            this.registerCapabilityListener('speaker_repeat', async (value, opts) => {
                await this._onCapabilitySpeakerRepeat(value, opts)
            });
        }
        if(this.hasCapability("media_unjoin")) {
            this.registerCapabilityListener('media_unjoin', async (value, opts) => {
                await this._onCapabilityMediaUnjoin(value, opts)
            });
        }
        
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

    }

    // Redefinitionen ============================================================================================
    async updateCapabilities(){
        // Add new capabilities (if not already added)
        try{
            if (!this.hasCapability('button.reconnect'))
            {
                await this.addCapability('button.reconnect');
            }
            if (!this.hasCapability('media_unjoin'))
            {
                await this.addCapability('media_unjoin');
            }
        }
        catch(error){
            this.error("Error adding capability: "+error.message);
        }
    }

    // Entity update ============================================================================================
    async onEntityUpdate(data) {
        if(data == null || data.entity_id == null) {
            return;
        }

        try{
            let convert = null;

            if (this.hasCapability("volume_set") && data.attributes.volume_level != null){
                convert = this.inputConverter("volume_set");
                await this.setCapabilityValue("volume_set", Math.round(convert(data.attributes.volume_level)*100)/100);
            }
            if (this.hasCapability("volume_mute") && data.attributes.is_volume_muted != null){
                    this.setCapabilityValue("volume_mute", data.attributes.is_volume_muted);
            }
            if (this.hasCapability("speaker_playing") && data.state != null){
                switch (data.state){
                    case "playing":
                        await this.setCapabilityValue("speaker_playing", true);
                        break;
                    default:
                        await this.setCapabilityValue("speaker_playing", false);
                }
            }
            if (this.hasCapability("speaker_shuffle")){
                if (data.attributes.shuffle != null){
                    await this.setCapabilityValue("speaker_shuffle", data.attributes.shuffle );
                }
                else{
                    await this.setCapabilityValue("speaker_shuffle", false );
                }
            }
            if (this.hasCapability("speaker_repeat")){
                if (data.attributes.repeat != null){
                    switch (data.attributes.repeat){
                        case "off":
                            await this.setCapabilityValue("speaker_repeat", "none");
                            break;
                        case "one":
                            await this.setCapabilityValue("speaker_repeat", "track");
                            break;
                        case "all":
                            await this.setCapabilityValue("speaker_repeat", "playlist");
                            break;
                        default:
                            await this.setCapabilityValue("speaker_repeat", "none");
                    }
                }
                else{
                    await this.setCapabilityValue("speaker_repeat", "none");
                }
            }
            if (this.hasCapability("speaker_artist")){
                if ( data.attributes.media_artist != null){
                    this.setCapabilityValue("speaker_artist", data.attributes.media_artist);
                }
                else{
                    this.setCapabilityValue("speaker_artist", "");
                }
            }
            if (this.hasCapability("speaker_album")){
                if (data.attributes.media_album_name != null){
                    await this.setCapabilityValue("speaker_album", data.attributes.media_album_name);
                }
                else if (data.attributes.app_name != null){
                    await this.setCapabilityValue("speaker_album", data.attributes.app_name);
                }
                else{
                    await this.setCapabilityValue("speaker_album", "");
                }
            }
            if (this.hasCapability("speaker_track")){
                if ( data.attributes.media_title != null){
                    await this.setCapabilityValue("speaker_track", data.attributes.media_title);
                }
                else{
                    await this.setCapabilityValue("speaker_track", "");
                }
            }
            if (this.hasCapability("speaker_duration")){
                if (data.attributes.media_duration != null){
                    let minutes = Math.floor(data.attributes.media_duration / 60);
                    let seconds = Math.floor(data.attributes.media_duration - minutes * 60);
                    let time = minutes + seconds/100;
                    await this.setCapabilityValue("speaker_duration", time);
                }
                else{
                    await this.setCapabilityValue("speaker_duration", 0);
                }
            }
            if (this.hasCapability("speaker_position")){
                if (data.attributes.media_position != null){
                    let minutes = Math.floor(data.attributes.media_position / 60);
                    let seconds = Math.floor(data.attributes.media_position - minutes * 60);
                    let time = minutes + seconds/100;
                    await this.setCapabilityValue("speaker_position", time);
                }
                else{
                    await this.setCapabilityValue("speaker_position", 0);
                }
            }

            if (this.hasCapability("onoff") && data.state != null){
                switch (data.state){
                    case "on":
                    case "idle":
                    case "playing":
                    case "paused":
                    case "buffering":
                        await this.setCapabilityValue("onoff", true);
                        break;
                    case "off":
                    case "standby":
                        await this.setCapabilityValue("onoff", false);
                        break;
                    default:
                        await  this.setCapabilityValue("onoff", false);
                }
            }
            if (data.attributes.source_list == null){
                await this.setStoreValue("sourceList", '');
                await this.setStoreValue("canSelectSource", false);
            }
            else{
                await this.setStoreValue("sourceList", JSON.stringify(data.attributes.source_list));
                await this.setStoreValue("canSelectSource", true);
            }
            if (data.attributes.sound_mode_list == null){
                await this.setStoreValue("soundModeList", '');
                await this.setStoreValue("canSelectSoundMode", false);
            }
            else{
                await this.setStoreValue("soundModeList", JSON.stringify(data.attributes.sound_mode_list));
                await this.setStoreValue("canSelectSoundMode", true);
            }

            let entityPicture = null;
            if (    data.attributes.entity_picture_local != undefined &&
                    data.attributes.entity_picture_local != null){
                entityPicture = data.attributes.entity_picture_local;
            }
            else if (   data.attributes.entity_picture != undefined &&
                        data.attributes.entity_picture != null){
                entityPicture = data.attributes.entity_picture;
            }
            if (entityPicture != null && entityPicture != undefined){
                if (this.mediaCover != entityPicture){
                    this.mediaCover = entityPicture;
                    let url = entityPicture;
                    if ( ! (entityPicture.startsWith("http")) ){
                        url =  this.homey.settings.get("address") + entityPicture;
                    }
                    this.mediaImage.setUrl(url);
                    await this.mediaImage.update();
                }
            }
            else{
                if (this.mediaCover != null){
                    this.mediaImage.setUrl(null);
                    await this.mediaImage.update();
                    this.mediaCover = null;
                }
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    // Capabilities ===========================================================================================?
    async _onCapabilityOnoff( value, opts ) {
        // this._client.turnOnOff(this.entityId, value);
        let entityId = this.entityId;
        if (value == true){
            await this._client.callService("media_player", "turn_on", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("media_player", "turn_off", {
                "entity_id": entityId
            });
        }
    }

    async _onCapabilityVolumeSet( value, opts ) {
        let entityId = this.entityId;
        let outputValue = this.outputConverter("volume_set")(value);
        outputValue = Math.round(outputValue*100)/100;
        await this._client.callService("media_player", "volume_set", {
            "entity_id": entityId,
            "volume_level": outputValue
        });
    }

    async _onCapabilityVolumeUp( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume + 0.05;
        if (volume > 1){
            volume = 1;
        }
        await this._onCapabilityVolumeSet( volume , opts);
    }

    async _onCapabilityVolumeDown( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume - 0.05;
        if (volume < 0){
            volume = 0;
        }
        await this._onCapabilityVolumeSet( volume , opts);
    }

    async _onCapabilityVolumeMute( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        await this._client.callService("media_player", "volume_mute", {
            "entity_id": entityId,
            "is_volume_muted": outputValue
        });
    }

    async _onCapabilitySpeakerPlaying( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        if (outputValue){
            await this._client.callService("media_player", "media_play", {
                "entity_id": entityId
            });
        }
        else{
            await this._client.callService("media_player", "media_pause", {
                "entity_id": entityId
            });
        }
    }

    async _onCapabilitySpeakerNext( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("media_player", "media_next_track", {
            "entity_id": entityId
        });
    }

    async _onCapabilitySpeakerPrev( value, opts ) {
        let entityId = this.entityId;
        await this._client.callService("media_player", "media_previous_track", {
            "entity_id": entityId
        });
    }

    async _onCapabilitySpeakerShuffle( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        await this._client.callService("media_player", "shuffle_set", {
            "entity_id": entityId,
            "shuffle": outputValue
        });
    }

    async _onCapabilitySpeakerRepeat( value, opts ) {
        let entityId = this.entityId;
        let outputValue = "off";
        switch (value){
            case "none":
                outputValue = "off";
                break;
            case "track":
                outputValue = "one";
                break;
            case "playlist":
                outputValue = "all";
                break;
        }
        
        await this._client.callService("media_player", "repeat_set", {
            "entity_id": entityId,
            "repeat": outputValue
        });
    }

    async _onCapabilityMediaUnjoin(){
        let entityId = this.entityId;
        await this._client.callService("media_player", "unjoin", {
            "entity_id": entityId
        });

    }
    
    // Autocompletion lists & Flow actions ===========================================================================================
    getSourceList(){
        if (this.getStoreValue("canSelectSource") == true){
            let string = this.getStoreValue("sourceList");
            if (string == null){
                return [];
            }
            let list = [];
            try{
                list = JSON.parse(string);
            }
            catch{
                try{
                    list = string.split(',');
                }
                catch{

                }
            }
            let result = [];
            for (let i=0; i<list.length; i++){
                result.push({
                    id: list[i],
                    name: list[i]
                })
            }
            return result;
        }
        else{
            return [];
        }
    }

    async setSource(source){
        let entityId = this.entityId;
        try{
            await this._client.callService("media_player", "select_source", {
            "entity_id": entityId,
            "source": source
            });
        }
        catch(error){
            throw error;
        }
    }

    getSoundModeList(){
        if (this.getStoreValue("canSelectSoundMode") == true){
            let string = this.getStoreValue("soundModeList");
            if (string == null){
                return [];
            }
            let list = [];
            try{
                list = JSON.parse(string);
            }
            catch{
                try{
                    list = string.split(',');
                }
                catch{

                }
            }
            let result = [];
            for (let i=0; i<list.length; i++){
                result.push({
                    id: list[i],
                    name: list[i]
                })
            }
            return result;
        }
        else{
            return [];
        }
    }

    async setSoundMode(mode){
        let entityId = this.entityId;
        try{
            await this._client.callService("media_player", "select_sound_mode", {
                "entity_id": entityId,
                "sound_mode": mode
            });
        }
        catch(error){
            throw error;
        }
    }

}

module.exports = MediaDevice;