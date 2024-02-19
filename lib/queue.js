'use strict';

const Homey = require('homey');

const DEFAULT_DELAY = 0.1 * 1000; // Standard dalay between messages: X seconds
const STATE_STOPPED = 0;
const STATE_RUNNING = 1;

module.exports = class Client extends Homey.SimpleClass {
    constructor(){
        super();
        this._delay = DEFAULT_DELAY;
        this._array = [];
        this._state = STATE_STOPPED;
    }

    setDelay(delay){
        this._delay = delay;
    }

    enqueue(element){
        this._array.push(element);
        this.start();
    }

    getNext(){
        if (this._array.length > 0){
            return this._array[0];
        }
        else{
            return undefined;
        }
    }

    dequeue(){
        if (this._array.length !== 0){
            this._array.shift();
        }
    }

    async start(){
        if (this._state == STATE_RUNNING){
            return;
        }

        this._state = STATE_RUNNING;
        while (this._array.length > 0 && this._state == STATE_RUNNING){
            this.process(this._array[0]);
            await this._wait(this._delay);
        }

        this._state = STATE_STOPPED;
    }

    process(element){
        this.dequeue();
        if (typeof element == 'function'){
            element();
        }
        this.onProcess(element);
    }

    onProcess(element){
        // redefine in subclass
        this.log("Queue processing: ", element );
    }

    async _wait(delay = 1000) {
        await new Promise(resolve => {
            setTimeout(() => resolve(), delay);
    });
    }
}