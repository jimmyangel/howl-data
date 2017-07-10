var fs = require('fs');
var turf = require('@turf/turf');

var wa = require('./or7/OregonWildWildernessSimplifiedF.json');
var pw = require('./or7/OregonWildPotentialSimplifiedF.json');

var xg = require('./or7/or7crossings.json');

var result = {
  type: 'FeatureCollection',
  features: []
}

for (var i=0; i<wa.features.length; i++) {

  var unitIndex = xg.wilderness.findIndex(function(element) {
    return element.unit === wa.features[i].properties.Name;
  });

  if (unitIndex >=0) {
    wa.features[i].properties = {
      type: 'wilderness',
      name: xg.wilderness[unitIndex].unit,
      entryDate: xg.wilderness[unitIndex].date,
      fill: '#08ff00',
      'fill-opacity': 0.8,
      howlHasFeaturePopUp: true,
      howlOverridePopUpContent: xg.wilderness[unitIndex].unit,
      areaType: 'wilderness'
    };
    result.features.push(wa.features[i]);
    //wa.features[i].properties.crossingDate = xg.wilderness[unitIndex].date;
    //console.log(i, wa.features[i].properties.name, wa.features[i].properties.crossingDate);
  }
}

for (var i=0; i<pw.features.length; i++) {

  var unitIndex = xg.pwilderness.findIndex(function(element) {
    return element.unit === pw.features[i].properties.AREA_NAMES;
  });

  if (unitIndex >=0) {
    pw.features[i].properties = {
      type: 'pwilderness',
      name: xg.pwilderness[unitIndex].unit,
      entryDate: xg.pwilderness[unitIndex].date,
      fill: '#d0ff00',
      'fill-opacity': 0.8,
      howlHasFeaturePopUp: true,
      howlOverridePopUpContent: xg.pwilderness[unitIndex].unit,
      areaType: 'wilderness'
    };
    result.features.push(pw.features[i]);
    //wa.features[i].properties.crossingDate = xg.wilderness[unitIndex].date;
    //console.log(i, wa.features[i].properties.name, wa.features[i].properties.crossingDate);
  }
}

result = turf.flatten(result);
console.log(JSON.stringify(result));
//console.log(JSON.stringify(result, null, 2));

/*wa.features.forEach(function(waf, idx) {
  if (xg.wilderness.includes(waf.properties.Name)) {

    console.log(idx, waf.properties.Name);
  }
});*/

//console.log(JSON.stringify(turf.featureCollection(matchedFC), null, 2));
