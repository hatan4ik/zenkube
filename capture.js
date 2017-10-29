const
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    kefir = require('kefir'),
    Kubemote = require('kubemote');

let
    client = new Kubemote(Kubemote.CONFIGURATION_FILE()),
    outputFile = fs.createWriteStream('dump.jsonl');   // .jsonl is a valid extension for "json lines" file (not valid JSON)

let deploymentEventStream = kefir
    .fromPromise(client.watchDeploymentList())
    .flatMap(()=> kefir.fromEvents(client, 'watch'))        //"ADDED", "MODIFIED", "DELETED", "ERROR"
    .onValue((event)=> {
        let payload = { time: Date.now(), event };
        outputFile.write([JSON.stringify(payload), "\n"].join(''));
        console.log(_.truncate(JSON.stringify(payload, 30)));
    });
