
var f = require('./MTBS/MTBSOregonFiresGen20170330_FSampled.json');

var mtbsCZML = [
  {
    id: 'document',
    name: 'MTBS',
    version: "1.0",
    clock: {
      interval: '1984-07-28T07:00:00.000Z/2014-12-31T23:59:59.999Z',
      currentTime: '1984-07-28T07:00:00.000Z',
      multiplier: 10000000,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER'
    }
  }
]

f.features.forEach(function (feature) {
  //console.warn(Math.ceil(255*feature.properties.severityHighAcres/feature.properties.acres));
  var year = (new Date(feature.properties.ignitionDate)).getUTCFullYear();
  var czmlItem = {
    id: feature.properties.id,
    name: 'Fire Name: ' + feature.properties.name,
    description:
      'Fire Id: ' + feature.properties.id + '<br>' +
      'Ignition Date: ' + feature.properties.ignitionDate + '<br>' +
      'Acres: ' + feature.properties.acres + '<br> Severity Acres: <br>&nbspHigh: ' +
        feature.properties.severityHighAcres + ' Moderate: ' +
        feature.properties.severityModerateAcres + ' Low: ' +
        feature.properties.severityLowAcres,
    availability: year + '-01-01T00:00:00.000Z' + '/' + year + '-12-31T23:59:59.999Z',
    cylinder: {
      topRadius: 500+Math.sqrt(feature.properties.acres*4046),
      bottomRadius:  500+Math.sqrt(feature.properties.acres*4046),
      //length: 1000+feature.properties.severityHighAcres,
      length: 1000+feature.properties.forestAcres,
      outline: false,
      material : {
        solidColor : {
          color : {
              rgba : [255, 255-Math.ceil(255*Math.tanh(2*feature.properties.severityHighAcres/feature.properties.acres)), 0, 220]
          }
        }
      }
    },
    position: {
			cartographicDegrees: feature.geometry.coordinates
		}
  };

  mtbsCZML.push(czmlItem);
});
console.log(JSON.stringify(mtbsCZML, null, 2));
