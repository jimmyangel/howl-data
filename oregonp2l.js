var fs = require('fs');
var turf = require('@turf/turf');

var oregonp = require('./oregon/oregon.json');

oregonp.features[0] = turf.polygonToLineString(oregonp.features[0]);

console.log(JSON.stringify(oregonp));
