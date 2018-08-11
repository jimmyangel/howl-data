const fs = require('fs');

const zlib = require('zlib');
const tar = require('tar-stream');
const shapefile = require('shapefile');
const ThrottledPromise = require('throttled-promise');

const {execSync} = require('child_process');
const MAX_PROMISES = 5;
const FIRST_YEAR = 1984;
const TARS_PATH = '/fire_level_tar_files/';

// These should be parms
let year = 2016;
let mtbs_dir = 'MTBS-2018/';
// ^^^^^^^^^^^^^^^^^^^^^^^^^^

console.warn('Process list of fires');

let listData = retrieveMTBSListOfFires();

let fires = {
  type: 'FeatureCollection',
  features: []
};
let p = [];
let dp;
let j = 0;

for (var i = 0; i < listData.length; i++) {
//for (let i = 0; i < 1; i++) {
  (function (i) {
    dp = new ThrottledPromise((resolve, reject) => {
      retrieveFireInfo(listData[i], (err, d) => {
        if (err) {
          console.error(err.message);
          reject(err);
        } else {
          let data = d.desc[0];
          console.warn(j++, i, listData[i]);
          let fire = {
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
              kmzLink: d.kmzLink
            },
            geometry: {
              type: 'Point',
              coordinates: [data.LONG, data.LAT]
            }
          };

          let forestAcres = 0;
          d.rep.forEach((item) => {
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
ThrottledPromise.all(p, MAX_PROMISES).then((values) => {
    let maxAcres = Math.max.apply(Math, values.map(function(o){return o.properties.acres;}));
    let minAcres = Math.min.apply(Math, values.map(function(o){return o.properties.acres;}));
    values = values.map(function(item) {
      item.properties.relativeArea = Number(((item.properties.acres - minAcres) / (maxAcres - minAcres)).toFixed(5));
      return item;
    });
    fires.features = values;
    fires.features = values.sort((a, b) => {
      return (new Date(a.properties.ignitionDate).getTime() - (new Date(b.properties.ignitionDate)).getTime());
    });
    console.log(JSON.stringify(fires, null, 2));

    processKmzFiles();

}).catch(function (err) {console.error(err)});

function retrieveMTBSListOfFires() {
  let ld = [];
  for (let y=FIRST_YEAR; y<=year; y++) {
    let dir = mtbs_dir + y + TARS_PATH;
    let result = fs.readdirSync(dir);
    result.forEach(function(element, index) {
      ld.push(dir + element);
    });
  }
  return ld;
}

function retrieveFireInfo(path, callback) {
  fs.readFile(path, (err, data) => {
    let response = data;
    let numTarEntries = 2;
    let resultData = {};
    let kmzFileName;
    zlib.gunzip(response, (err, result) => {
      if (err) {
        return callback(err);
      } else {
        let extract = tar.extract();
        extract.on('entry', (header, stream, next) => {
          if (header.name.includes('.kmz')) {
            kmzFileName = header.name;
          }
          if (header.name.includes('_desc.dbf') || header.name.includes('_rep.dbf')) {
            (function(dbf) {
              getTarEntry(stream, (entry) => {
                getDbfRecords(dbf, entry, (dbfRecords) => {
                  Object.assign(resultData, dbfRecords);
                  if (--numTarEntries === 0) {
                    resultData['kmzLink'] = '/' + kmzFileName;
                    return callback(null, resultData);
                  }
                });
              });
            })(header.name.substring(header.name.lastIndexOf('_')+1,header.name.lastIndexOf('.')));
          }
          stream.on('end', () => {
            next();
          });
          stream.resume();
        });

        extract.end(result);
      }
    });
  });

}

function getDbfRecords(dbf, entry, callback) {
  let dbfRecords = {};
  dbfRecords[dbf] = [];
  shapefile.openDbf(entry).then(function (source) {
    source.read().then(function capture (result) {
      if (result.done) {
        return callback(dbfRecords);
      }
      dbfRecords[dbf].push(result.value);
      return source.read().then(capture);
    });
  }).catch(function(err) {console.error(err.stack)});
}

function getTarEntry(tarEntryStream, callback) {
  let chunkArray = [];
  tarEntryStream.on('data', (chunk) => {
    chunkArray.push(chunk);
  });
  tarEntryStream.on('end', () => {
    callback(Buffer.concat(chunkArray));
  });
}

function processKmzFiles() {

  console.warn('Extract kmz files');
  execSync('rm -f MTBS/kmz/*');
  listData.forEach((f) => {
    execSync(`tar -xzf ${f} --include "*.kmz" -C MTBS/kmz`);
  });
  console.warn('Fix kmz files');
  execSync('../../getfirekmzs/fixkmz.sh', {cwd: 'MTBS/kmz'});

}
