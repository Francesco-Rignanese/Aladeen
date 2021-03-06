const fs = require("fs");
const SerialPort = require('serialport');
const port = new SerialPort('/COM7', {databits:8, parity:'none'});
const redis = require('redis');
const config = require('config');
const Client = require('azure-iot-device').Client;
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const clientConfig = config.get('Clients');
const client = Client.fromConnectionString(clientConfig[0].connectionString, Protocol);

//primo byte
let greenId;
let yellowId;
let redId;

let yellowTemp = 5; //temporizzazione predefinita
let redTemp;

let greenValue, yellowValue, redValue;
//quarto byte: vuoto
let emptyValue = 0x00;
let bit_parità = 0x00;

// connect to the hub
client.open(function(err) {
    if (err) {
        console.error('error connecting to hub: ' + err);
        process.exit(1);
    }
    console.log('client opened');
    console.log('Waiting for timings...')   
});

let tookTime = false;
if(!tookTime) {
    getTimings();
}

function getTimings() {
 // Create device Twin
    var receiveTimings = new Promise(function(resolve, reject) { 
        client.getTwin(function(err, twin) {
            if (err) {
                console.error('error getting twin: ' + err);
                process.exit(1);
            }
            // Output the current properties
            //console.log('twin contents:');
            //console.log(twin.properties);
            twin.on('properties.desired', function(delta) {
                //console.log('new desired properties received:');
                let json_timings = twin.properties.desired;
                fs.writeFileSync("temps.json", JSON.stringify(twin.properties.desired));
                resolve(json_timings);
            });
            
            //sendTiming(twin.properties.desired.timing);
        });
    });
    tookTime = true;
    return receiveTimings;
}

function parseTimings() {
        let reply = require('./temps.json');
        let arrayTimings = reply.timing;
        //console.log(arrayTimings);
        let firstCouple = arrayTimings.shift();
        let secondCouple = arrayTimings.shift();
        
        let couples = [firstCouple, secondCouple];

        couples.forEach(couple => {
            //Se ricevo la coppia 0 invio ai semafori 1-3
            if(couple.semafores_couples === 0) {

                //Id del semaforo valore predefinito:
                greenId = 0x40;
                yellowId = 0x60;
                redId = 0x20;
                
                //ROSSO = giallo predefinito + temporizzazione ricevuta
                redTemp = yellowTemp + parseInt(couple.value);
                //Valori calcolati Hex
                greenValue = parseInt(`0x${Number(couple.value).toString(16)}`);
                yellowValue = parseInt(`0x${Number(yellowTemp).toString(16)}`);
                redValue = parseInt(`0x${Number(redTemp).toString(16)}`);
                
                if(greenValue === 0) {
                    console.log('semaforo giallo lampeggiante');
                }
                //let megaPack = [greenId, 0x00, greenValue, 0x00, bit_parità, yellowId, 0x00, yellowValue, 0x00, bit_parità, redId, 0x00, redValue, 0x00, bit_parità];
                let firstCouplePack = [greenId,emptyValue,greenValue,emptyValue,bit_parità, yellowId,emptyValue,yellowValue,emptyValue,bit_parità, redId,emptyValue,redValue,emptyValue,bit_parità];
                //primo rosso - 15 sec, verde - 10 sec, giallo -5 sec
                console.log(firstCouplePack);
                console.log('verde', greenValue, 'giallo', yellowValue, 'rosso', redValue);
                port.write(firstCouplePack);
                
            } else if (couple.semafores_couples === 1) {
                //Id del semaforo valore predefinito:
                greenId = 0x62;
                yellowId = 0x42;
                redId = 0x22;

                //ROSSO = giallo predefinito + temporizzazione ricevuta
                redTemp = yellowTemp + parseInt(couple.value);
                //Valori calcolati Hex
                greenValue = parseInt(`0x${Number(couple.value).toString(16)}`);
                yellowValue = parseInt(`0x${Number(yellowTemp).toString(16)}`);
                redValue = parseInt(`0x${Number(redTemp).toString(16)}`);

                let secondCouplePack = [greenId,emptyValue,greenValue,emptyValue,bit_parità, yellowId,emptyValue,yellowValue,emptyValue,bit_parità, redId,emptyValue,redValue,emptyValue,bit_parità];
                //console.log('second', secondCouplePack);
                //console.log('verde', greenValue, 'giallo', yellowValue, 'rosso', redValue);
                port.write(secondCouplePack);
            } else {
                console.log("ERROR: Invalid data in JSON Received.")
            }
        });
}

//L'invio dei dati al pic avviene ogni 80 secondi
//Nel progetto reale questo avverrà ogni ora
setInterval(() => {
	parseTimings();
}, 80000);
