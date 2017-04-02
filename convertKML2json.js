var tj = require('togeojson'),
    fs = require('fs'),
    DOMParser = require('xmldom').DOMParser;

var kml = new DOMParser().parseFromString(fs.readFileSync('HoodNF_OG.kml', 'utf8'));

var gj = tj.kml(kml);

gj.features.forEach(function (feature) {
  delete feature.properties.styleUrl;
  delete feature.properties.styleHash;
  delete feature.properties.description;

});

console.log(JSON.stringify(gj));
