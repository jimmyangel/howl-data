var f = require('../MTBS/MTBSOregonFiresGen20170531Sampled.json');

f.features.forEach(function (feature) {
  console.log('wget ' + feature.properties.kmzLink);
});
