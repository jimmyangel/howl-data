var f = require('../MTBS/firelist.json');

f.fires.fire.forEach(function (fire) {
  console.log('wget ' + fire.tarlink[0]);
});
