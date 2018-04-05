const http = require('https');
const cheerio = require('cheerio');
const fs = require('fs');
const rimraf = require('rimraf');
const shapefile = require('shapefile');
const simplify = require('simplify-geojson');
const turf = require('@turf/turf');
const gp = require('geojson-precision');
const ThrottledPromise = require('throttled-promise');
const MAX_PROMISES = 5;
// var ThrottledPromise = require('throttled-promise');
const YEAR = 2017; // We will make this a parm later

// var shapefile = require('shapefile');

console.warn('parseGeoMAC');

const host = 'https://rmgsc.cr.usgs.gov';
const path = '/outgoing/GeoMAC/' + YEAR + '_fire_data/';
const state = 'Oregon';

rimraf.sync('rcwildfires-data');
fs.mkdirSync('rcwildfires-data/');
fs.mkdirSync('rcwildfires-data/' + YEAR);

retrieveList(host + path + state + '/').then(listData => {
  let $ = cheerio.load(listData);
  let p = [];
  $('a').each(function () {
    let link = $(this).attr('href');
    if (link != path) {
      let fileName = link.substring(link.indexOf(path) + (path + state).length + 1, link.length - 1);
      let name = fileName.replace(/_/g, ' ');
      //console.log('+++ Fire:', name, 'Url', host + link);

      let dp = (function () {
        return new ThrottledPromise((resolve, reject) => {
          retrieveList(host + link).then(listData => {
            let $ = cheerio.load(listData);
            let fireRecord = {fireYear: YEAR, fireName: name, fireFileName: fileName, fireLink: link, fireReports: [], fireMaxAcres: 0, bbox: [180, 90, -180, -90], location: [0, 0]};
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
    processFireRecords(values);
  }).catch((err) => {
    console.log('Error', err);
  });
});

function retrieveList(url) {

  return new Promise((resolve, reject) => {

    http.get(url, (res) => {
      let result = '';
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

function processFireRecords(fireRecords) {

  let p = [];
  fireRecords.forEach(function (fireRecord) {
    let dp = fireRecordTask(fireRecord);
    p.push(dp);
  });
  ThrottledPromise.all(p, 2).then(() => {
    console.log('I am done done');
    fireRecords = fireRecords.filter(fireRecord => fireRecord.fireMaxAcres > 1000);

    for (var i=0; i <fireRecords.length; i++)  {
      // We do not need these anymore
      delete fireRecords[i].fireReports;
      delete fireRecords[i].fireLink;
    }
    fs.writeFile('rcwildfires-data/' + YEAR + 'fireRecords.json', JSON.stringify(fireRecords, null, 2), (error) => {
      if (error) {
        console.error(error);
        throw(error);
      }
    });
  }).catch(error => {
    console.log('processFireRecords', error.stack);
  });
}

function fireRecordTask (fireRecord) {
  let p = [];
  return new ThrottledPromise((resolve, reject) => {
    fireRecord.fireReports.forEach(function (fireReport) {
      let dp = fireReportTask(fireRecord, fireReport);
      p.push(dp);
    });
    ThrottledPromise.all(p, 3).then((geoJSONFireReports) => {
      if (fireRecord.fireMaxAcres > 1000) {
        fireRecord.location = [
          Number(((fireRecord.bbox[0]+fireRecord.bbox[2])/2).toFixed(5)),
          Number(((fireRecord.bbox[1]+fireRecord.bbox[3])/2).toFixed(5))
        ];
        fireRecord.fireMaxAcres = Number((fireRecord.fireMaxAcres).toFixed(0));
        let wrapFireReports = {
          fireName: fireRecord.fireName,
          fireFileName: fireRecord.fireFileName,
          bbox: fireRecord.bbox,
          location: fireRecord.location,
          maxAcres: fireRecord.fireMaxAcres,
          fireReports: {type: 'FeatureCollection', features: geoJSONFireReports}
        }
        fs.writeFile('rcwildfires-data/' + YEAR + '/' + fireRecord.fireFileName + '.json', JSON.stringify(wrapFireReports, null, 2), (error) => {
          if (error) {
            console.error(error);
            throw(error);
          }
        });
        console.log('I am done with', fireRecord.fireFileName);
      }

      resolve();
    }).catch(error => {
      console.log('fireRecordTask', error.stack);
      reject(error);
    });
  });
}

function fireReportTask (fireRecord, fireReport) {
  return new ThrottledPromise((resolve, reject) => {

    http.get(host + fireReport.fireReportLink.substring(0, fireReport.fireReportLink.length - 3) + 'dbf', (dres) => {

      http.get(host + fireReport.fireReportLink, (res) => {
        shapefile.read(res, dres).then(function (result) {
          result.bbox = result.bbox.map(x => Number(x.toFixed(5)));
          let bbox = fireRecord.bbox;
          bbox[0] = Math.min(bbox[0], result.bbox[0]);
          bbox[1] = Math.min(bbox[1], result.bbox[1]);
          bbox[2] = Math.max(bbox[2], result.bbox[2]);
          bbox[3] = Math.max(bbox[3], result.bbox[3]);
          fireRecord.bbox = bbox;
          console.log(fireRecord.bbox);
          if (result.features[0].properties.GISACRES) {
            fireRecord.fireMaxAcres = Math.max(result.features[0].properties.GISACRES, fireRecord.fireMaxAcres);
          }
          result.features[0].properties.fireReportDate = fireReport.fireReportDate;
          console.log(fireRecord.fireName, result.features[0].properties.fireReportDate, result.features[0].properties.GISACRES);
          resolve(gp(result, 5).features[0]);
        }).catch(error => {
          console.error('fireReportTask', error.stack);
          reject(error);
        });
      });
    });
  });
}
