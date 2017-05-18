var fs = require('fs');
var turf = require('@turf/turf');
var shortid = require('shortid');
var gp = require('geojson-precision');

shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

var pW = require('./pwilderness/rdls21_albers_OR_S.json');
var eco = require('./pwilderness/ecoregions.json');
// var pWZones = require('./pwilderness/pwildzones.json');
//var pFromBook = require('./pwilderness/proposedFromBookZones.json');

var regionFeatureCollections = {};

pW.features.forEach(function(feature) {
  var c = turf.centroid(feature);
  if (!assignToRegion(c, feature)) {
    var bb = turf.bbox(feature);
    if (!assignToRegion(turf.point([bb[2],bb[3]]), feature)) {
      assignToRegion(turf.point([bb[0],bb[1]]), feature)
    }
  }
});

eco.features.forEach(function(eregion) {
  if (regionFeatureCollections[eregion.properties.US_L3NAME]) {
    eregion.properties.eId = regionFeatureCollections[eregion.properties.US_L3NAME].eId;
    eregion.properties.acres = (regionFeatureCollections[eregion.properties.US_L3NAME].acres).toFixed();
    eregion.properties.howlHasFeaturePopUp = true;
    fs.writeFile('pwilderness/result/' +
      eregion.properties.eId + '.json',
      JSON.stringify((regionFeatureCollections[eregion.properties.US_L3NAME])));
  }
});
fs.writeFile('pwilderness/result/ecoregions.json', JSON.stringify(gp.parse(eco, 4)));

function assignToRegion(point, feature) {
  var assigned = false;
  eco.features.forEach(function(eregion) {
    if (turf.inside(point, eregion)) {
      if (regionFeatureCollections[eregion.properties.US_L3NAME]) {
        regionFeatureCollections[eregion.properties.US_L3NAME].features.push(gp.parse(feature, 4));
        regionFeatureCollections[eregion.properties.US_L3NAME].acres += feature.properties.Acres;
      } else {
        regionFeatureCollections[eregion.properties.US_L3NAME] = {
            type: 'FeatureCollection',
            ecoregion: eregion.properties.US_L3NAME,
            eId: eregion.properties.US_L3NAME.replace(/[\s\/]+/g,''),
            acres: feature.properties.Acres,
            features: [gp.parse(feature, 4)]
          }
      }
      //console.log('hey', feature.properties.AREA_NAMES + ' is in ecoregion ' + regionFeatureCollections[eregion.properties.US_L3NAME].eId);
      assigned = true;
      return;
    }
  });
  return assigned;
}
