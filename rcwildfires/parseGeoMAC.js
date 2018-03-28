const http = require('https');
const cheerio = require('cheerio');
var shapefile = require('shapefile');
var gp = require('geojson-precision');
var ThrottledPromise = require('throttled-promise');
var MAX_PROMISES = 5;
// var ThrottledPromise = require('throttled-promise');

// var shapefile = require('shapefile');

console.warn('parseGeoMAC');

var host = 'https://rmgsc.cr.usgs.gov';
var path = '/outgoing/GeoMAC/2017_fire_data/';
var state = 'Oregon';

retrieveList(host + path + state + '/').then(listData => {
  let $ = cheerio.load(listData);
  let p = [];
  $('a').each(function () {
    let link = $(this).attr('href');
    if (link != path) {
      var name = link.substring(link.indexOf(path) + (path + state).length + 1, link.length - 1).replace(/_/g, ' ');
      //console.log('+++ Fire:', name, 'Url', host + link);

      let dp = (function () {
        return new ThrottledPromise((resolve, reject) => {
          retrieveList(host + link).then(listData => {
            let $ = cheerio.load(listData);
            let fireRecord = {fireName: name, fireLink: link, fireReports: []};
            $('a').each(function () {
              let rlink = $(this).attr('href');
              if ((rlink != path + state) + '/' && (rlink.endsWith('.shp'))) {
                let xdate = rlink.substr(link.length + name.length + 4).substr(0, 13);
                //console.log(xdate);
                //let xdate = rlink.substr(rlink.length - 22).substr(0, 13);
                let date = new Date(xdate.substr(0, 4) + '-' + xdate.substr(4, 2) + '-' + xdate.substr(6, 2) + 'T' + xdate.substr(9, 2) + ':' + xdate.substr(11, 2));
                //console.log(rlink.substr(rlink.length - 22).substr(0, 13), 'xx', date);
                fireRecord.fireReports.push({fireReportLink: rlink, fireReportDate: date});
                //console.log(link);
              }
            });
            resolve(fireRecord);
          });
        });
      })();
      p.push(dp);
    }
  });
  ThrottledPromise.all(p, MAX_PROMISES).then(values => {
    convertToGeoJson(values);
  }).catch((err) => {
    console.log('Error', err);
  });
});

function retrieveList(url) {

  return new Promise((resolve, reject) => {

    http.get(url, (res) => {
      var result = '';
      res.on('data', (chunk) => {
        result += chunk;
      });
      res.on('end', () => {
        resolve(result);
      });
      res.on('error', (err) => {
        reject(err);
      });
    }).on('error', err => {
      reject(err)
    });

  });
}

function convertToGeoJson(fireRecords) {

  let p = [];
  fireRecords.forEach(function (fireRecord) {
    fireRecord.fireReports.forEach(function (fireReport) {
      let dp = (function (fireRecord, fireReport) {
        return new ThrottledPromise((resolve, reject) => {
          http.get(host + fireReport.fireReportLink, (res) => {
            shapefile.read(res).then(function (result) {
              console.log(fireRecord.fireName, fireReport.fireReportDate);
              result.bbox = result.bbox.map(x => Number(x.toFixed(3)));
              console.log(result.bbox);
              //console.log(JSON.stringify(gp(result, 3), null, 2));
              resolve();
              //console.log(JSON.stringify(gp(result, 3), null, 2));
            }).catch(error => console.error(error.stack));
          });
        });
      })(fireRecord, fireReport);
      p.push(dp);
    });
  });
  ThrottledPromise.all(p, MAX_PROMISES).then(() => {
    console.log('I am done');
  });
}
