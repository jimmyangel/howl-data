var f = require('../howl/data/MTBS/MTBSOregonFiresGen20170330_FSampled.json');

f.features.forEach(function (feature) {
  console.log('wget ' + feature.properties.kmzLink);
});
