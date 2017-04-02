var fs = require('fs');
var parseString = require('xml2js').parseString;
var querystring = require('querystring');
var http = require('http');
var zlib = require('zlib');
var tar = require('tar-stream');
var shapefile = require('shapefile');
var ThrottledPromise = require('throttled-promise');
var MAX_PROMISES = 5;

retrieveMTBSListOfFires('Oregon', function(err, listData) {
  if (err) {
    console.error(err.message);
  } else {
    var fires = {
      type: 'FeatureCollection',
      features: []
    };
    var p = [];
    var dp;
    var j = 0;

    for (var i = 0; i < listData.fires.fire.length; i++) {
    //for (var i = 0; i < 10; i++) {
      (function (i) {
        dp = new ThrottledPromise(function(resolve, reject) {
          retrieveFireInfo(listData.fires.fire[i].tarlink[0], function(err, d) {
          // retrieveFireInfo('http://localhost/~morin_ricardo/Test/or4425512018720140717.tar.gz', function(err, d) {
            if (err) {
              console.error(err.message);
              reject(err);
            } else {
              var data = d.desc[0];
              console.warn(j++, i, listData.fires.fire[i].tarlink[0]);
              var fire = {
                type: 'Feature',
                properties: {
                  id: data.FIRE_ID,
                  name: data.FIRENAME,
                  hydrologicUnit: data.HUC4_NAME,
                  acres: data.R_ACRES,
                  ignitionDate: new Date(data.FIRE_YEAR, data.FIRE_MON-1, data.FIRE_DAY),
                  severityUnburnedAcres: data.CLS1_ACRES,
                  severityLowAcres: data.CLS2_ACRES,
                  severityModerateAcres: data.CLS3_ACRES,
                  severityHighAcres: data.CLS4_ACRES,
                  severityIncreasedGreenesAcres: data.CLS5_ACRES,
                  nonProcessingMaskAcres: data.CLS6_ACRES,
                  pdfLink: listData.fires.fire[i].pdflink[0],
                  kmzLink: listData.fires.fire[i].kmzlink[0],
                  tarLink: listData.fires.fire[i].tarlink[0]
                },
                geometry: {
                  type: 'Point',
                  coordinates: [data.LONG, data.LAT]
                }
              };

              var forestAcres = 0;
              d.rep.forEach(function(item) {
                if (item.NLCD_L1_DE === 'Forest') {
                  forestAcres += item.R_ACRES;
                }
              });
              fire.properties.forestAcres = Number(forestAcres.toFixed(2));
              resolve(fire);
            }
          });
        });
      })(i);
      p.push(dp);
    }
    ThrottledPromise.all(p, MAX_PROMISES).then(function(values) {
        var maxAcres = Math.max.apply(Math, values.map(function(o){return o.properties.acres;}));
        var minAcres = Math.min.apply(Math, values.map(function(o){return o.properties.acres;}));
        values = values.map(function(item) {
          item.properties.relativeArea = Number(((item.properties.acres - minAcres) / (maxAcres - minAcres)).toFixed(5));
          return item;
        });
        fires.features = values;
        fires.features = values.sort(function(a, b) {
          return (new Date(a.properties.ignitionDate).getTime() - (new Date(b.properties.ignitionDate)).getTime());
        });
        console.log(JSON.stringify(fires, null, 2));
    }).catch(function (err) {console.error(err)});

  }
});

function retrieveFireInfo(tarLink, callback) {
  var URL = require('url').parse(tarLink);
  var http_s = require(URL.protocol.slice(0, -1));
  var options = {
    protocol: URL.protocol,
    hostname: URL.hostname,
    port: URL.port,
    path: URL.path,
    method: 'GET'
  };

  var req = http.request(options, function (res) {

    var chunkArray = [];
    res.on('data', function (chunk) {
      chunkArray.push(chunk);
    });
    res.on('end', function () {
      var response = Buffer.concat(chunkArray);
      var numTarEntries = 2;
      var resultData = {};
      zlib.gunzip(response, function (err, result) {
        if (err) {
          return callback(err);
        } else {
          var extract = tar.extract();
          extract.on('entry', function(header, stream, next) {
            if (header.name.includes('_desc.dbf') || header.name.includes('_rep.dbf')) {

              (function(dbf) {
                getTarEntry(stream, function (entry) {
                  getDbfRecords(dbf, entry, function(dbfRecords) {
                    Object.assign(resultData, dbfRecords);
                    //resultData.push(dbfRecords);
                    if (--numTarEntries === 0) {
                      //console.log(resultData);
                      return callback(null, resultData);
                    }
                  });
  /*                shapefile.openDbf(entry).then(function (source) {
                    console.log(header.name);
                    source.read().then(function log (result) {
                      if (result.done) {
                        if (--numTarEntries === 0) {
                          console.log (resultData);
                          return callback(null, resultData[0].row);
                        } else {
                          return;
                        }
                      }
                      //console.log(header.name.substring(header.name.lastIndexOf('_')+1,header.name.lastIndexOf('.')));
                      // resultData.push({dbf: header.name.substring(header.name.lastIndexOf('_')+1,header.name.lastIndexOf('.')), row: result.value});
                      return source.read().then(log);
                      // return callback(null, result.value);
                    });
                  }).catch(function(err) {console.error(err.stack)});*/
                });

              })(header.name.substring(header.name.lastIndexOf('_')+1,header.name.lastIndexOf('.')));

            }
            stream.on('end', function() {
              next();
            });
            stream.resume();
          });

          extract.end(result);
        }
      });
    });
  });
  req.end();

  req.on('error', function (err) {
    return callback(err);
  });
}

function getDbfRecords(dbf, entry, callback) {
  var dbfRecords = {};
  dbfRecords[dbf] = [];
  //var dbfRecords = {dbf: dbf, records: []};
  shapefile.openDbf(entry).then(function (source) {
    source.read().then(function capture (result) {
      if (result.done) {
        return callback(dbfRecords);
      }
      dbfRecords[dbf].push(result.value);
      //req.abort();
      return source.read().then(capture);
    });
  }).catch(function(err) {console.error(err.stack)});
}

function getTarEntry(tarEntryStream, callback) {
  var chunkArray = [];
  tarEntryStream.on('data', function (chunk) {
    chunkArray.push(chunk);
  });
  tarEntryStream.on('end', function () {
    callback(Buffer.concat(chunkArray));
  });
}


function retrieveMTBSListOfFires(state, callback) {

  var postData = querystring.stringify({
    states : state
  });

  var options = {
    protocol: 'http:',
    hostname: 'mtbs.gov',
    path: '/mtbs_mysql/dataquery/getResult.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  var req = http.request(options, function (res) {
    var xml = '';
    res.on('data', function (chunk) {
      xml += chunk;
    });
    res.on('end', function () {
      parseString(xml, function (err, result) {
          return callback(null, result);
      });
    });
    res.on('error', function (err) {
      return callback(err);
    })
  });

  req.on('error', function (err) {
    return callback(err);
  });

  req.write(postData);
  req.end();
}
