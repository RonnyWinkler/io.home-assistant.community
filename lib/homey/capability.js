'use strict';

const Homey = require('homey');

let homeyCapabilitiesCache;
let appCapabilitiesCache;
let capabilitiesCache;

class Capability {
  static getHomeyCapabilities() {
    if (homeyCapabilitiesCache) return homeyCapabilitiesCache;
    const capabilities = require('./capabilities.json');
    homeyCapabilitiesCache = capabilities.reduce((obj, capabilityId) => {
      obj[capabilityId] = require(`./capabilities/${capabilityId}.json`);
      return obj;
    }, {});
    return homeyCapabilitiesCache;
  }

  static getAppCapabilities() {
    if (appCapabilitiesCache) return appCapabilitiesCache;
    appCapabilitiesCache = Homey.manifest.capabilities;

    return appCapabilitiesCache;
  }

  static getCapabilities() {
    if (capabilitiesCache) return capabilitiesCache;
    capabilitiesCache = Object.assign({}, Capability.getHomeyCapabilities(), Capability.getAppCapabilities());
    return capabilitiesCache;
  }

  static getCapability(id) {
    const capabilities = Capability.getCapabilities();
    const capability = capabilities[id];
    if (!capability) {
      throw new Error('invalid_capability');
    }
    return capability;
  }

  static getCapabilityType(id) {
    try {
      return Capability.getCapability(Capability.getBaseId(id)).type;
    }    
    catch(error){
      return undefined;
    }
  }

  static isInstanceOfId(capabilityIdToCheck, capabilityId) {
    return (
      capabilityId === capabilityIdToCheck || capabilityIdToCheck.startsWith(`${capabilityId}.`)
    );
  }

  static getBaseId(capabilityId) {
    const parts = capabilityId.split('.');
    return parts[0];
  }
  
}

module.exports = Capability;