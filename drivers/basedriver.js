'use strict';

const Homey = require('homey');

// files
const http = require('http');
const https = require('https');
const fs = require('fs');
const Capability = require('../lib/homey/capability');

// const customTemplateCapabilities = require('../assets/const/customTemplateCapabilities');

const USERDATA_PATH = "/userdata/";
const USERDATA_PATH_PREFIX = "../../..";

function download(url, path, encoding){
    var file = fs.createWriteStream(path);
    return new Promise((resolve, reject) => {
      var responseSent = false;
      const action = url.startsWith('https') ? https.get : http.get;
      action(url, response => {
        if(encoding) {
            response.setEncoding(encoding);
        }
        response.pipe(file);
        file.on('finish', () =>{
          file.close(() => {
            if(responseSent)  return;
            responseSent = true;
            resolve();
          });
        });
      }).on('error', err => {
          if(responseSent)  return;
          responseSent = true;
          reject(err);
      });
    });
}

class BaseDriver extends Homey.Driver {    
    onPair(session) {
        this.log("onPair()");
        this.selectedDevices = [];
        let installed = false;

        session.setHandler('showView', async (view) => {
            return await this.onShowView(session, view);
          });
      
        session.setHandler("list_devices", async () => {
            return await this.onPairListDevices(session);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
        });

        session.setHandler('list_devices_selection', async (data) => {
            // this.log("handler: list_devices_selection");
            return await this.onListDeviceSelection(session, data);
        });
      

        session.setHandler('setRemoteIcon', async (item) => {
            this.log('setRemoteIcon: ' + item.url);
            // if(DEBUG) listFiles("/userdata");
            let deviceFile = "";
            for(let i=0; i<this.selectedDevices.length; i++){
                deviceFile = await this.downloadIcon(item.url, this.selectedDevices[i].data.id);
                let path = USERDATA_PATH_PREFIX + deviceFile;
                if (!this.selectedDevices[i].store){
                    this.selectedDevices[i]["store"]={};
                }
                this.selectedDevices[i].store["icon"] = path;
                this.selectedDevices[i]["icon"] = path;
            }
            // if(DEBUG) listFiles("/userdata");
            const file = deviceFile;
            return file;
        });
    
        session.setHandler('setIcon', async (svg) => {
            this.log('setIcon: ' + svg);
            for(let i=0; i<this.selectedDevices.length; i++){
                this.selectedDevices[i].store.icon = svg;
                this.selectedDevices[i].icon = svg
            }
            return svg;
        });

        session.setHandler('saveIcon', async (data) => {
            try {
                this.log('saveIcon: ' + JSON.stringify(data));
                // if(DEBUG) listFiles("./userdata");
                let deviceIconCurrent = "";
                for(let i=0; i<this.selectedDevices.length; i++){

                    this.uploadIcon(data, this.selectedDevices[i].data.id);
                    deviceIconCurrent = USERDATA_PATH+ this.selectedDevices[i].data.id +".svg";
                    let path = USERDATA_PATH_PREFIX + deviceIconCurrent; 
                    if (!this.selectedDevices[i].store){
                        this.selectedDevices[i]["store"]={};
                    }
                    this.selectedDevices[i].store["icon"] = path;
                    this.selectedDevices[i]["icon"] = path;
                }            
                const deviceIcon = deviceIconCurrent;
                return deviceIcon;
        
            } catch (error) {
                this.log('saveIcon ERROR ' + JSON.stringify(error));
            }
        });
    
        session.setHandler('install', async (data) => {
            this.log('install devies');
            this.log(JSON.stringify(this.selectedDevices, null, "  "));
            // dynamic icon defifinition for capabilities is not possible using capabilitiesOptions
            // Only icons defined in capability.json are used :(
            // for(let i=0; i<this.selectedDevices.length; i++){
            //     if (this.selectedDevices[i].data.capabilitiesMdiIcons){
            //         let keys = Object.keys(this.selectedDevices[i].data.capabilitiesMdiIcons);
            //         for(let j=0; j<keys.length; j++){
            //             let id = this.selectedDevices[i].data.id + "." + keys[j];
            //             // Read icon from mdi JSON
            //             let url =   "https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/"+ 
            //                         this.selectedDevices[i].data.capabilitiesMdiIcons[keys[j]] +
            //                         ".svg";
            //             // write icon to /userdata
            //             let path = await this.downloadIcon(url, id);

            //             // update device capability icon
            //             this.selectedDevices[i].capabilitiesOptions[keys[j]]["icon"] = path;
            //         }
            //     }
            // }

            installed = true;
            return this.selectedDevices;
        });

        session.setHandler('disconnect', async () => {
            if(installed) {
                this.log("Pairing is finished");
            } else {
                this.log("User closed pair view.");
                for(let i=0; i<this.selectedDevices.length; i++){
                    this.tryRemoveIcon(this.selectedDevices[i].data.id);
                }
            }
        });

    }

    async onRepair(session, device) {
        this.log("onRepair()");
        let installed = false;

        session.setHandler('showView', async (view) => {
            return await this.onShowViewRepair(session, view, device);
        });

        session.setHandler("login", async (data) => {
            return await this.checkLogin(data); 
        });

        session.setHandler('isDeviceChangeable', async () => {
            return this.isDeviceChangeable(device);
        });

        session.setHandler('addEntity', async (data) => {
            if (this.isDeviceChangeable(device)){
                return await this.addEntity(device, data);
            }
            return {added: false, message: "Device type not changeable."};        
        });

        session.setHandler('changeEntity', async (data) => {
            if (this.isDeviceChangeable(device)){
                return await this.changeEntity(device, data);
            }
            return {added: false, message: "Device type not changeable."};        
        });

        session.setHandler('removeEntity', async (data) => {
            if (this.isDeviceChangeable(device)){
                return await this.removeEntity(device, data);
            }
            return {added: false, message: "Device type not changeable."};        
        });

        session.setHandler('isIconChangeable', async () => {
            let icon = device.getStoreValue("icon");
            if (icon != undefined){
                if (icon.startsWith(USERDATA_PATH_PREFIX+USERDATA_PATH) || icon.startsWith(USERDATA_PATH)){
                    return true;
                }
            }
            return false;
        });

        session.setHandler('isCapabilityChangeable', async () => {
            let client = this.homey.app.getClient();
            let deviceDef = await this.getDeviceList(client, device.getData().id);
            if (deviceDef && deviceDef[0] && deviceDef[0].capabilities != undefined){
                return true;
            }
            else{
                return false;
            }
        });

        session.setHandler('setRemoteIcon', async (item) => {
            this.log('setRemoteIcon: ' + item.url);
            // if(DEBUG) listFiles("./userdata");
            let deviceFile = await this.downloadIcon(item.url, device.getData().id+"_temp");
            const file = deviceFile;
            return file;
        });
    
        // session.setHandler('setIcon', async (svg) => {
        //     this.log('setIcon: ' + svg);
        //     this.selectedDevices[i].store.icon = svg;
        //     this.selectedDevices[i].icon = svg
        //     return svg;
        // });

        session.setHandler('saveIcon', async (data) => {
            try {
                this.log('saveIcon: ' + JSON.stringify(data));
                // if(DEBUG) listFiles("./userdata");
                let deviceIconCurrent = "";

                this.uploadIcon(data, device.getData().id+"_temp");
                deviceIconCurrent = USERDATA_PATH+ device.getData().id+"_temp" +".svg";
        
                const deviceIcon = deviceIconCurrent;
                return deviceIcon;
        
            } catch (error) {
                this.log('saveIcon ERROR ' + JSON.stringify(error));
            }
        });
    
        session.setHandler('changeIcon', async (data) => {
            this.log('Change icon for ID '+device.getData().id);
            this.changeIcon(device.getData().id);
            installed = true;
            return;
        });

        session.setHandler('disconnect', async () => {
            if(installed) {
                this.log("Pairing is finished");
            } else {
                this.log("User closed repair view.");
                this.tryRemoveIcon(device.getData().id+"_temp");
            }
        });

        session.setHandler('getEntity', async () => {
            let id = device.getData().id;
            let data = {};
            let entityId = this.homey.app.getClient().getEntity(id);
            if (entityId){
                data[id] = entityId;
            }
            if (id.split(".")[0] == "climate_fan"){
                data["climate." + id.split(".")[1]] = this.homey.app.getClient().getEntity("climate." + id.split(".")[1]);
                data["fan." + id.split(".")[1]] = this.homey.app.getClient().getEntity("fan." + id.split(".")[1]);
            }
            let deviceEntities = device.getDeviceEntitiesCapabilities();
            for (let i=0; i<deviceEntities.length; i++){
                let capabilitiesOptions = device.getCapabilityOptions(deviceEntities[i]);
                data[capabilitiesOptions.entity_id] = this.homey.app.getClient().getEntity(capabilitiesOptions.entity_id);
                data[capabilitiesOptions.entity_id]["homey_capability"] = deviceEntities[i]
            }
            if (data == null || data == {} || Object.keys(data).length === 0){
                data["entityId"] = id;
                data["Error"] = this.homey.__("device_unavailable_reason.entity_not_found");
            }
            return data;
        });

        session.setHandler('getLog', async () => {
            return this.homey.app.getLog();
        });

        session.setHandler('setLogSettings', async (settings) => {
            this.homey.app.setLogSettings(settings);
        });

        session.setHandler('getLogSettings', async (settings) => {
            return this.homey.app.getLogSettings();
        });

        session.setHandler('getStatistics', async () => {
            return this.homey.app.getStatistics();
        });

        session.setHandler('updateCapabilities', async () => {
            this.log("Updating device cabapilities...");
            await this.updateCapabilities(device); 
            this.log("Updating device cabapilities finished.");
            return true;
        });

        // Read entities for autocomplete list of custom device repair view (to add capability)
        session.setHandler('getCustomEntityList', async () => {
            this.log("Get custom device entity list...");
            let entities = await this.getCustomEntityList(); 
            this.log("Entities found: "+entities.length);
            // this.log(entities);
            return entities;
        });

        // Read capabilities + assigned entity for autocomplete list of custom device repair view (to delete capability)
        session.setHandler('getCustomTemplateCapabilityList', async () => {
            this.log("Get custom device template capability list...");
            let capabilities = await this.getCustomTemplateCapabilityList(device); 
            //this.log(entities);
            return capabilities;
        });

        session.setHandler('getCustomTemplateCapability', async (entity_id) => {
            this.log("Get custom device template capability list...");
            let capability = await this.getCustomTemplateCapability(device, entity_id); 
            //this.log(entities);
            return capability;
        });

        // Read template capabilities 
        session.setHandler('getCustomCapabilityList', async () => {
            this.log("Get custom device capability list...");
            let entities = await this.getCustomCapabilityList(device); 
            //this.log(entities);
            return entities;
        });

        // Read template attributes for selected entity 
        session.setHandler('getCustomEntityAttributeList', async (entity_id) => {
            this.log("Get custom entity attribute list for entity "+entity_id+"...");
            let attributes = await this.getCustomEntityAttributeList(device, entity_id); 
            this.log("Attribute: ",attributes);
            return attributes;
        });
        
    }

    async checkLogin(data){
        let address = data.username;
        let token = data.password;

        try{
            await this.homey.app.getClient().connect(address, token, true);
            if (this.homey.app.getClient() && this.homey.app.getClient().isConnected()){
                await this.homey.settings.set("address", address);
                await this.homey.settings.set("token", token);

                await new Promise(r => setTimeout(r, 3000));
                return true;
            }
            else{
                return false;
            }
        }
        catch (error){
            this.log("Connection error in pairing login view: "+error.message);
            return false;
        }
    }

    async onShowView(session, view){
        if (view === 'loading') {
            this.log("onShowView(loading)");

            if (this.homey.app.getClient().isConnected()){
                await session.showView("list_devices");
            }
            else{
                let address = this.homey.settings.get("address");
                let token = this.homey.settings.get("token");
                // let address = "";
                // let token = "";

                if(address && address != "" 
                    && token && token != "") {
                    try{
                        await this.homey.app.getClient().connect(address, token, true);
                        if (this.homey.app.getClient().isConnected()){
                            await session.showView("list_devices")
                        }
                        else{
                            await session.showView("login_credentials");
                        }
                    }
                    catch(error){
                        await session.showView("login_credentials");
                    }
                }
                else{
                    await session.showView("login_credentials");
                }
            }
        }
    }

    
    async onShowViewRepair(session, view, device){
    //     if (view === 'update_device') {
    //         this.log("onShowViewRepair(update_device)");
    //         try{
    //             await this.updateDevice(device);
    //             await session.nextView();
    //         }
    //     }    
    }

    async onPairListDevices(session) {
        this.log("onPairListDevices()" );

        let devices = [];
        let client = this.homey.app.getClient();
        if (client.isConnected() == false){
            await session.showView("login_credentials");
        }
        else{
            devices = await this.getDeviceList(client);
        }
        this.log("onPairListDevices: devices: "+devices.length+"/"+ client.getEntitiesCount() +" entities, size of devices JSON: "+JSON.stringify(devices).length);
        return devices;
    }

    async onListDeviceSelection(session, data){
        if (data.length > 1){
            this.log("handler: list_devices_selection: " + data.length + " devices selected");
        }
        else if (data.length == 1){
            this.log("handler: list_devices_selection: " + data[0].name);
        }
        else{
            this.log("handler: list_devices_selection: No device selected");
        }
        this.selectedDevices = data;
        return;
    }

    tryRemoveIcon(id) {
        try {
            const path = USERDATA_PATH + id +".svg";
            fs.unlinkSync(path);
            this.log("Icon removed: "+path);
        } catch(error) {
            this.log("Error removing device icon. Perhaps only driver icon was used. Error: "+error.message);
        }
    }

    renameFile(id_old, id_new) {
        const path_old = USERDATA_PATH + id_old + ".svg";
        const path_new = USERDATA_PATH + id_new + ".svg";
        try {
            fs.renameSync(path_old, path_new);
            this.log("Icon renamed: from "+path_old+" to"+path_new);
        } catch(error) {
            this.log("Error renaming device icon: "+path_old+" to"+path_new);
        }
    }

    async downloadIcon(url, id) {
        const path = USERDATA_PATH + id + ".svg";
        await download(url, path);
        //await download(url, path, 'base64');
        return path;
    }

    uploadIcon(img, id) {
        const path = USERDATA_PATH+ id +".svg";
        const base64 = img.replace("data:image/svg+xml;base64,", '');
        fs.writeFileSync(path, base64, 'base64');
    }

    changeIcon(id) {
        try {
            // remove original icon
            this.tryRemoveIcon(id);
        } catch(error) {
            this.log("Error removing old file. Error: "+error.message);
        }
        try {
            // rename temp icon to original name
            this.renameFile( id+"_temp", id);
        } catch(error) {
            this.log("Error changing device icon filename. Error: "+error.message);
        }

    }

    async updateCapabilities(device){
        let client = this.homey.app.getClient();
        let deviceDef = await this.getDeviceList(client, device.getData().id);
        deviceDef = deviceDef[0];
        if (!deviceDef.capabilities){
            return;
        }
        
        this.log("New device definition: ", deviceDef);

        // unregister event listener
        device.clientUnregisterDevice();
        // Remove old entries
        let capabilities = device.getCapabilities();
        for (let i=0; i<capabilities.length; i++){
            await device.removeCapability(capabilities[i]);
        }
        let store = device.getStore();
        if (store){
            let storeKeys = Object.keys(store);
            for (let i=0; i<storeKeys.length; i++){
                if (storeKeys[i] != 'icon'){
                    await device.unsetStoreValue(storeKeys[i]);
                }
            };
        }
        // clear settings
        if (device.getSetting('add_device_sensor') != null){
            device.setSettings({'add_device_sensor': false});
        }
        if (device.getSetting('add_device_sensor_diagnostic') != null){
            device.setSettings({'add_device_sensor_diagnostic': false});
        }
        if (device.getSetting('add_device_switch') != null){
            device.setSettings({'add_device_switch': false});
        }
        if (device.getSetting('add_device_button') != null){
            device.setSettings({'add_device_button': false});
        }

        // Add new entries
        capabilities = deviceDef.capabilities;
        for (let i=0; i<capabilities.length; i++){
            await device.addCapability(capabilities[i]);
        }
        if (deviceDef.capabilitiesOptions){
            let coKeys = Object.keys(deviceDef.capabilitiesOptions);
            for (let i=0; i<coKeys.length; i++){
                await device.setCapabilityOptions(coKeys[i], deviceDef.capabilitiesOptions[coKeys[i]] );
            }
        }
        if (deviceDef.store){
            let storeKeys = Object.keys(deviceDef.store);
            for (let i=0; i<storeKeys.length; i++){
                await device.setStoreValue(storeKeys[i], deviceDef.store[storeKeys[i]]);
            };
        }
        // Init and register event listeners
        await device.onInit();
    }

    async getCustomEntityList(){
        let result = [];
        let client = this.homey.app.getClient();
        let entities = await client.getEntities();
        let entityKeys = Object.keys(entities);
        for (let i=0; i<entityKeys.length; i++){
            let domain = entities[entityKeys[i]].entity_id.split('.')[0];
            let entity = {
                entity_id: entities[entityKeys[i]].entity_id,
                name: entities[entityKeys[i]].attributes.friendly_name || entities[entityKeys[i]].entity_id.split('.')[1],
                unit: entities[entityKeys[i]].attributes.unit_of_measurement || '',
                title: entities[entityKeys[i]].attributes.friendly_name + 
                        " (" +
                        entities[entityKeys[i]].entity_id +
                        ")" 
            };
            if ( domain == "number" 
                // && entities[entityKeys[i]].attributes.min_value != undefined
                // && entities[entityKeys[i]].attributes.max_value != undefined
                // && entities[entityKeys[i]].attributes.step != undefined 
                ){
                entity["number_range"] = {};
                if (entities[entityKeys[i]].attributes.min_value != undefined){
                    entity["number_range"]["min"] = entities[entityKeys[i]].attributes.min_value;
                }
                if (entities[entityKeys[i]].attributes.max_value != undefined){
                    entity["number_range"]["max"] = entities[entityKeys[i]].attributes.max_value;
                }
                if (entities[entityKeys[i]].attributes.step != undefined){
                    entity["number_range"]["step"] = entities[entityKeys[i]].attributes.step;
                }
            }
            if ( domain == "input_number" 
                //  && entities[entityKeys[i]].attributes.min != undefined
                //  && entities[entityKeys[i]].attributes.max != undefined
                //  && entities[entityKeys[i]].attributes.step != undefined
                ){
                entity["number_range"] = {};
                if (entities[entityKeys[i]].attributes.min != undefined){
                    entity["number_range"]["min"] = entities[entityKeys[i]].attributes.min;
                }
                if (entities[entityKeys[i]].attributes.max != undefined){
                    entity["number_range"]["max"] = entities[entityKeys[i]].attributes.max;
                }
                if (entities[entityKeys[i]].attributes.step != undefined){
                    entity["number_range"]["step"] = entities[entityKeys[i]].attributes.step;
                }
            }
            result.push(entity);
        };
        return result;
    }

    async getCustomEntityAttributeList(device, entity_id){
        let result = [];
        let client = this.homey.app.getClient();
        let entity = await client.getEntity(entity_id);

        if (entity.attributes){
            result = this.getAttributeFieldList(entity.attributes); 
        }

        return result;
    }

    getAttributeFieldList(object){
        try{
            let fieldlist = [];
            if (typeof object == "object"){
                let keys = Object.keys(object);
                for (let i=0; i<keys.length; i++){
                    if (typeof object[keys[i]] == 'object'){
                        // get subobjects with resursive reading
                        let subFieldlist = [];
                        if ( Array.isArray(object[keys[i]]) ){
                            for (let j=0; j<object[keys[i]].length; j++){
                                // fieldlist.push(subFieldlist[j]);
                                let subFieldlist = this.getAttributeFieldList(object[keys[i]][j]);
                                for (let k=0; k<subFieldlist.length; k++){
                                    let id = keys[i] + '[' + j + '].' + subFieldlist[k].id;
                                    fieldlist.push({
                                        id: id
                                    });
                                }
                            }
                        }
                        else{
                            subFieldlist = getAttributeFieldList(object[keys[i]]);
                            for (k=0; k<subFieldlist.length; k++){
                                let id = object[keys[i]] + '.' + subFieldlist[k].id;
                                fieldlist.push({
                                    id: id
                                });
                            }
                        }
                        for (let j=0; j<subFieldlist.length; j++){
                            fieldlist.push(subFieldlist[j]);
                        }
                    }
                    else{
                        // add currennt field to fieldlist
                        fieldlist.push({
                            id: keys[i]
                        });
                    }
                }
            }
            else{
                fieldlist.push({
                    id: object
                });
            }
            return fieldlist;
        }
        catch(error){
            this.log("getAttributeFieldList() with parameter: ", error );
            return [];
        }
    }

    async getCustomCapabilityList(device){
        let result = [];
        let capabilities = device.getCapabilities();
        for (let i=0; i<capabilities.length; i++){
            let capability = capabilities[i];
            let capabilityOptions = {};
            try{
                capabilityOptions = device.getCapabilityOptions(capability);
            }
            catch(error){continue;}
            if ( capabilityOptions.entity_id != undefined ){
                let entity = {};
                entity["entity_id"] = capabilityOptions.entity_id;
                entity["capability"] = capability;
                if (capabilityOptions.title != undefined){
                    entity["name"] = capabilityOptions.title;
                }
                else{
                    entity["name"] = '';
                }
                if (capabilityOptions.units != undefined){
                    entity["unit"] = capabilityOptions.units;
                }
                else{
                    entity["unit"] = '';
                }
                if (capabilityOptions.converter_ha2homey != undefined){
                    entity["converter_ha2homey"] = capabilityOptions.converter_ha2homey;
                }
                else{
                    entity["converter_ha2homey"] = '';
                }
                if (capabilityOptions.converter_homey2ha != undefined){
                    entity["converter_homey2ha"] = capabilityOptions.converter_homey2ha;
                }
                else{
                    entity["converter_homey2ha"] = '';
                }
                let energy = device.getEnergy();
                if (energy && energy.cumulativeImportedCapability == capability){
                    entity["energy"] = "imported";
                }
                else if (energy && energy.cumulativeExportedCapability == capability){
                    entity["energy"] = "exported";
                }
                else{
                    entity["energy"] = "default";
                }

                result.push( entity );
            }
        };
        return result;
    }

    async getCustomTemplateCapabilityList(device){
        let result = [];
        let capabilities = Capability.getCapabilities();
        let keys = Object.keys(capabilities);
        keys.forEach(key => {
            let capability = capabilities[key];
            result.push({ 
                id: key,
                type: capability.type,
                title: capability.title[this.homey.i18n.getLanguage()] || capability.title['en'] || capability.title,
                uiComponent: capability.uiComponent
            });
        }) 

            // capabilities.forEach(capability => {
        //         result.push({ 
        //             id: capability.id,
        //             name: capability.id,
        //             type: capability.type
        //         }
        //     );
        // }) 

        return result;
    }

    async getCustomTemplateCapability(device, entity_id){
        let client = this.homey.app.getClient();
        let capabilityTemplate = client.getCapabilityTemplate(entity_id, null);
        if (capabilityTemplate && capabilityTemplate.capability){
            return capabilityTemplate.capability + '.' + entity_id;
        }
        else{
            return '';
        }
    }

    isDeviceChangeable(device){
        // if (device.driver.id == 'custom'){
            return true;
        // }
        // return false;        
    }

    async addEntity(device, data){
        try{
            this.log("addEntity()");
            this.log("Custom entity settings:", data);
            let client = this.homey.app.getClient();
            if (!data.entity_id){
                return {added: false, message: this.homey.__("repair.custom_device.entity_not_found")};
            }
            if (!client.getEntity(data.entity_id)){
                return {added: false, message: this.homey.__("repair.custom_device.entity_not_found")};
            }

            if (data.attribute != undefined && data.attribute != ''){
                data.entity_id = data.entity_id + '.' + data.attribute;
            }

            let capability;
            let capabilitiesOptions = {};
            if (data.capability){
                capability = data.capability;
            }
            else{
                // get capability template to detect correct capability type
                let capabilityTemplate = client.getCapabilityTemplate(data.entity_id, null);
                if (!capabilityTemplate || !capabilityTemplate.capability){
                    return {added: false, message: this.homey.__("repair.custom_device.capability_not_valid")};
                }

                // add capability as subcapability with entity_id as subcapability name
                capability = capabilityTemplate.capability + '.' +data.entity_id;
            }

            // Insert DIM capability for changeable number entities
            if (data.add_as_number_input == true){
                if (data.entity_id.startsWith('number.') || data.entity_id.startsWith('input_number.')){
                    let capabilityArray = capability.split(/\.(.*)/s);
                    if (capabilityArray.length > 1){
                        capability = 'dim.' + capabilityArray[1];
                    }
                    else{
                        capability = 'dim';
                    }
                    if (!isNaN(Number(data.number_input.min))){
                        capabilitiesOptions["min"] = Number(data.number_input.min);
                    }
                    if (!isNaN(Number(data.number_input.max))){
                        capabilitiesOptions["max"] = Number(data.number_input.max);
                    }
                    if (!isNaN(Number(data.number_input.step))){
                        capabilitiesOptions["step"] = Number(data.number_input.step);
                    }
                }
            }

            if (data.add_as_main_capability){
                capability = capability.split('.')[0];
                // Special case: if main capability, the add onoff_button (button page) as onoff to allow quick actions
                if (capability == 'onoff_button'){
                    capability = 'onoff';
                }
            }

            // Add decimals for number capability
            if (data.decimals != undefined){
                if ( parseInt(data.decimals).par != NaN){
                    capabilitiesOptions["decimals"] = parseInt(data.decimals);
                }
            }

            // Add mode list for mode_select capability (select entity)
            if (data.entity_id.startsWith('select.') && capability.startsWith('mode_select.')){
                try{
                    let values = [];
                    let entity = client.getEntity(data.entity_id);
                    if (entity && entity.attributes && entity.attributes.options){
                        for (let i=0; i<entity.attributes.options.length; i++){
                            values.push({
                                id: entity.attributes.options[i],
                                title: entity.attributes.options[i]
                            });
                        }
                        capabilitiesOptions["values"] = values;
                    }
                }
                catch(error){
                    this.log("Error getting select entity mode list. Error: "+error.message);
                }
            }


            if (!device.hasCapability(capability)){
                this.log("Adding capability: "+capability);
                try{
                    await device.addCapability(capability);
                    // add custom capabilitieOptions fron repair dialog
                    
                    capabilitiesOptions["entity_id"] = data.entity_id;
                    if (data.name){
                        capabilitiesOptions['title'] = data.name;
                    }
                    if (data.unit){
                        capabilitiesOptions['units'] = data.unit;
                    }
                    if (data.converter_ha2homey || data.converter_homey2ha){
                        if (data.converter_ha2homey){
                            capabilitiesOptions['converter_ha2homey'] = data.converter_ha2homey; 
                        }
                        if (data.converter_homey2ha){
                            capabilitiesOptions['converter_homey2ha'] = data.converter_homey2ha;
                        }
                    }
                    this.log("CapabilityOptions:", capabilitiesOptions);
                    await device.setCapabilityOptions(capability, capabilitiesOptions);

                    // remove initial hint if found
                    if (device.hasCapability("custom_hint")){
                        device.removeCapability("custom_hint");
                    }
                }
                catch(error){
                    this.log("Error adding capability "+capability+": "+error.message);
                }
                this.log("Capability added.");
                
                // Set energy options
                if (data.energy && data.energy.cumulativeCapabilityOption != 'default'){
                    let energy = JSON.parse(JSON.stringify(device.getEnergy())) || {};
                    let settings = {};
                    switch (data.energy.cumulativeCapabilityOption){
                        case 'imported':
                            energy["cumulativeImportedCapability"] = capability;
                            energy["cumulative"] = true;
                            settings["set_energy_cumulative_imported_capability"] = capability;
                            settings["set_energy_cumulative"] = true;
                            break;
                        case 'exported':
                            energy["cumulativeExportedCapability"] = capability;
                            energy["cumulative"] = true;
                            settings["set_energy_cumulative_exported_capability"] = capability;
                            settings["set_energy_cumulative"] = true;
                            break;
                    }
                    await device.setEnergy( energy );
                    await device.setSettings(settings);
                    let energyTemp = device.getEnergy();
                }

                // Reload device (register capability listerner ...)
                device.onInit();
            }
            else{
                return {added: false, message: this.homey.__("repair.custom_device.capability_already_added")};
            }

            return {added: true, message: this.homey.__("repair.custom_device.entity_added")};

        }
        catch(error){
            this.log("Error adding capability: ",error.message);
            return {added: false, message: "Error adding capability: "+error.message};
        }
    }

    async changeEntity(device, data){
        try{
            this.log("changeEntity()");
            if ( !data.entity_id ){
                return {changed: false, message: this.homey.__("repair.custom_device.entity_not_found")};
            }
            let capabilities = device.getCapabilities();
            for (let i=0; i<capabilities.length; i++){
                let capabilitiesOptions = {};
                try{
                    capabilitiesOptions = device.getCapabilityOptions(capabilities[i]);
                }
                catch(error){continue;}
                if (    capabilitiesOptions.entity_id && 
                        capabilitiesOptions.entity_id == data.entity_id &&
                        capabilities[i] == data.capability
                    ){
                    // add custom capabilitieOptions fron repair dialog
                    let capabilitiesOptions = {};
                    capabilitiesOptions["entity_id"] = data.entity_id;
                    if (data.name){
                        capabilitiesOptions['title'] = data.name;
                    }
                    if (data.unit){
                        capabilitiesOptions['units'] = data.unit;
                    }
                    if (data.converter_ha2homey || data.converter_homey2ha){
                        capabilitiesOptions['capabilityConverter'] = {};
                        if (data.converter_ha2homey){
                            capabilitiesOptions['converter_ha2homey'] = data.converter_ha2homey; 
                        }
                        if (data.converter_homey2ha){
                            capabilitiesOptions['converter_homey2ha'] = data.converter_homey2ha;
                        }
                    }
                    this.log("CapabilityOptions:", capabilitiesOptions);
                    await device.setCapabilityOptions(capabilities[i], capabilitiesOptions);


                    // Set energy options
                    // if (data.energy && data.energy.cumulativeCapabilityOption != 'default'){
                        let energy = JSON.parse(JSON.stringify(device.getEnergy())) || {};
                        let settings = {};
                        switch (data.energy.cumulativeCapabilityOption){
                            case 'imported':
                                energy["cumulativeImportedCapability"] = capabilities[i];
                                energy["cumulative"] = true;
                                settings["set_energy_cumulative_imported_capability"] = capabilities[i];
                                settings["set_energy_cumulative"] = true;
                                if (energy["cumulativeExportedCapability"] == capabilities[i]){
                                    delete energy["cumulativeExportedCapability"];
                                    settings["set_energy_cumulative_exported_capability"] = '';
                                }
                                break;
                            case 'exported':
                                energy["cumulativeExportedCapability"] = capabilities[i];
                                energy["cumulative"] = true;
                                settings["set_energy_cumulative_exported_capability"] = capabilities[i];
                                settings["set_energy_cumulative"] = true;
                                if (energy["cumulativeImportedCapability"] == capabilities[i]){
                                    delete energy["cumulativeImportedCapability"];
                                    settings["set_energy_cumulative_imported_capability"] = '';
                                }
                                break;
                            case 'default':
                                if (energy["cumulativeImportedCapability"] == capabilities[i]){
                                    delete energy["cumulativeImportedCapability"];
                                    settings["set_energy_cumulative_imported_capability"] = '';
                                    if (energy["cumulativeExportedCapability"] == undefined){
                                        energy["cumulative"] = false;
                                        settings["set_energy_cumulative"] = false;
                                    }
                                }
                                if (energy["cumulativeExportedCapability"] == capabilities[i]){
                                    delete energy["cumulativeExportedCapability"];
                                    settings["set_energy_cumulative_exported_capability"] = '';
                                    if (energy["cumulativeImportedCapability"] == undefined){
                                        energy["cumulative"] = false;
                                        settings["set_energy_cumulative"] = false;
                                    }
                                }
                        }
                        await device.setEnergy( energy );
                        await device.setSettings(settings);
                    // }

                    // unregister entities
                    device.clientUnregisterDevice();
                    // Reload device (register capability listerner ...)
                    device.onInit();
        
                    return {changed: true, message: this.homey.__("repair.custom_device.entity_changed")};        
                }
            }
            return {changed: false, message: this.homey.__("repair.custom_device.entity_not_found")};
        }
        catch(error){
            this.log("Error changing capability: ",error.message);
            return {changed: false, message: "Error changing capability: "+error.message};
        }
    }

    async removeEntity(device, data){
        try{
            this.log("removeEntity()");
            if ( !data.entity_id ){
                return {removed: false, message: this.homey.__("repair.custom_device.entity_not_found")};
            }
            let capabilities = device.getCapabilities();
            for (let i=0; i<capabilities.length; i++){
                let capabilitiesOptions = {};
                try{
                    capabilitiesOptions = device.getCapabilityOptions(capabilities[i]);
                }
                catch(error){continue;}
                if (    capabilitiesOptions.entity_id && 
                        capabilitiesOptions.entity_id == data.entity_id &&
                        capabilities[i] == data.capability
                    ){
                    try{
                        await device.setCapabilityOptions(capabilities[i], {});
                        await device.removeCapability(capabilities[i]);
                    }
                    catch(error){
                        this.log("Error removing capability");
                    }
                    // unregister entities
                    device.clientUnregisterDevice();
                    // Reload device (register capability listerner ...)
                    device.onInit();
        
                    return {removed: true, message: this.homey.__("repair.custom_device.entity_removed")};        
                }
            }
            return {removed: false, message: this.homey.__("repair.custom_device.entity_not_found")};
        }
        catch(error){
            this.log("Error removing capability: ",error.message);
            return {removed: false, message: "Error removing capability: "+error.message};
        }
    }

    async getDeviceList(client, id=null){
        // redefine in sub classes and return the driver dependent devices 
    }

}

module.exports = BaseDriver;