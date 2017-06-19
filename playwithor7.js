var fs = require('fs');
var turf = require('@turf/turf');

var or7 = require('./or7/or7F.json');
var nf = require('./or7/OR7NationalForestsSimplifiedF_flat.json');
//var nf = require('./or7/test.json');

matchedFC = [];

or7.features.forEach(function(or7f, i) {
  //console.log(or7f.geometry.type);

  if (or7f.geometry.type === 'LineString') {
    //console.log(JSON.stringify(or7f, null, 2));
    nf.features.forEach(function(nff) {
        var result = turf.lineIntersect(or7f, nff);
        if (result.features.length > 0) {
          //console.log(nff.properties.NFSLANDU_2);
          result.features.forEach(function(featureMatch) {
            featureMatch.properties.nationalForest = nff.properties.NFSLANDU_2;
            matchedFC.push(featureMatch);
          });
        } else {
          //console.log('NO INTERSECT');
        }
    });
  }

});

console.log(JSON.stringify(turf.featureCollection(matchedFC), null, 2));
