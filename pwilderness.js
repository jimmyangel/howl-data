var turf = require('@turf/turf');

var pW = require('./pwilderness/rdls21_albers_OR.json');
var pWZones = require('./pwilderness/pwildzones.json');
var pFromBook = require('./pwilderness/proposedFromBookZones.json');

var combAll = {};
var comb = {};

pW.features.forEach(function(feature) {
  var name = feature.properties.AREA_NAMES.replace(/[^a-zA-Z0-9\(\)'-]/g, ' ');
  var uname = feature.properties.FIRST_FIRS + name.trim();
  if (combAll[uname]) {
    combAll[uname].features.push(feature);
  } else {
    combAll[uname] = {
      type: 'FeatureCollection',
      name: name,
      features: [feature]
    };
  }
  var centroid = turf.centroid(feature);

  pWZones.features.forEach(function(zone) {
    if (turf.inside(centroid, zone)) {
      var z = pFromBook.find(function(zone) {return zone.Unit === name});
      if (z) {
        console.log('Unit name: ' + name, 'Proposed Wilderness: ' + zone.properties.pwild);
      } else {
        console.log('****** Unit name: ' + name, 'Proposed Wilderness: ' + zone.properties.pwild);
      }
    }
  });
  //console.log(feature.geometry.type, feature.properties.AREA_NAMES, feature.properties.Acres, turf.area(feature)/4046.86);
});

var keys = [];
for (var key in combAll) {
  keys.push(key);
}
keys.sort();

keys.forEach(function(k) {
  //console.log(combAll[k].name, combAll[k].features.length);
});

//console.log(Object.keys(combAll).length);

//console.log(JSON.stringify(combAll, null, 2));
