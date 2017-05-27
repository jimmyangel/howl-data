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
    console.log(JSON.stringify(listData, null, 2));
  }
});

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
