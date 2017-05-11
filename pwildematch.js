var fs = require('fs');
var turf = require('@turf/turf');
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

var pW = require('./pwilderness/rdls21_albers_OR.json');
var pWZones = require('./pwilderness/pwildzones.json');
var pFromBook = require('./pwilderness/proposedFromBookZones.json');

var wildernessFeatureCollections = {};

pW.features.forEach(function(feature) {
  var name = feature.properties.AREA_NAMES.replace(/[^a-zA-Z0-9\(\)'-]/g, ' ');
  name = name.trim();
  feature.properties.wildernessAreas = [];
  //var uname = feature.properties.FIRST_FIRS + name;

  var matched = [];
  pFromBook.forEach(function(w) {
    if (name === w.Unit) {
      matched.push({name: name, proposed: w.Proposed});
    }
  });
  var centroid;
  if (matched.length === 1) {
    feature.properties.wildernessAreas.push(matched[0].proposed);
  }
  if (matched.length > 1) {

    matched.forEach(function(m) {

      centroid = turf.centroid(feature);

      pWZones.features.forEach(function(zone) {
        if (turf.inside(centroid, zone)) {
          if (!feature.properties.wildernessAreas.find(function(s) {return s === zone.properties.pwild})) {
            feature.properties.wildernessAreas.push(zone.properties.pwild);
          }
        }
      });
    });
  }
  if (matched.length === 0) {
    centroid = turf.centroid(feature);
    pWZones.features.forEach(function(zone) {
      if (turf.inside(centroid, zone)) {
        if (!feature.properties.wildernessAreas.find(function(s) {return s === zone.properties.pwild})) {
          feature.properties.wildernessAreas.push(zone.properties.pwild);
        }
      }
    });
  };

  if (feature.properties.wildernessAreas.length === 0) {
    console.log('*** Unassigned: ', name);
  }

  feature.properties.wildernessAreas.forEach(function(wildernessAreaName) {
    if (wildernessFeatureCollections[wildernessAreaName]) {
      wildernessFeatureCollections[wildernessAreaName].features.push(feature);
    } else {
      wildernessFeatureCollections[wildernessAreaName] = {
        type: 'FeatureCollection',
        name: wildernessAreaName,
        wId: shortid.generate(),
        features: [feature]
      };
    }
  });
});

var wMarkers = {
  type: 'FeatureCollection',
  features: []
}

var i = 0;
for (var key in wildernessFeatureCollections) {
  wMarkers.features.push(turf.centroid(wildernessFeatureCollections[key]));
  wMarkers.features[i].properties.acres = (turf.area(wildernessFeatureCollections[key])/4046.86).toFixed();
  wMarkers.features[i].properties.featureCollectionId = wildernessFeatureCollections[key].wId = 'W' + i;
  wMarkers.features[i++].properties.proposedWildernessAreaName = key;

  fs.writeFile('pwilderness/result/' +
    wildernessFeatureCollections[key].wId + '.json', JSON.stringify(wildernessFeatureCollections[key], null, 2));

}

fs.writeFile('pwilderness/result/Windex.json', JSON.stringify(wMarkers, null, 2));
