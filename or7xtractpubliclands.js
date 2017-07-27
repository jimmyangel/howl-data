var fs = require('fs');
var turf = require('@turf/turf');

var blm = require('./or7/OR7BLM_2007F.json');
var nf = require('./or7/OR7NationalForestsSimplifiedF_flat.json');
var or7 = require('./or7/or7F.json');
var or7buffer = require('./or7/or7buffer.json');

var result = {
  type: 'FeatureCollection',
  features: []
}

var recorded = {};

or7.features.forEach(function(or7Feature) {
  if (or7Feature.geometry.type === 'LineString') {
    xtractPl(or7Feature, blm.features, 'blm', '#CF7350');
    xtractPl(or7Feature, nf.features, 'nf', '#50ACCF');
  }
});

function xtractPl(or7Feature, plFeatures, plType, fill) {

  plFeatures.forEach(function(plFeature, index) {
    plFeature.properties.publicLandType = plType;
    plFeature.properties.id = plType + index;
    plFeature.properties.fill = fill;
    plFeature.properties['fill-opacity'] = 0.8;
    plFeature.properties.howlHasFeaturePopUp = true;
    plFeature.properties.howlOverridePopUpContent = plType + index;
    plFeature.properties.howlOverridePopUpContent = (plFeature.properties.NFSLANDU_2) ? plFeature.properties.NFSLANDU_2 : 'BLM Land';
  });

  plFeatures.forEach(function(plFeature) {
    if (plFeature.geometry && plFeature.geometry.type === 'Polygon') {
      var intersect = turf.lineIntersect(plFeature, or7Feature);
      if (intersect.features.length) {
        var pIntersect = turf.intersect(or7buffer.features[0], plFeature);
        if (pIntersect) {
          pIntersect.properties = plFeature.properties;
          if (!recorded[plFeature.properties.id]) {
            recorded[plFeature.properties.id] = true;
            result.features.push(pIntersect);
          }
        }
      }
    }
  });
}

console.log(JSON.stringify(result));
