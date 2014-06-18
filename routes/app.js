var nstore = require('nstore'),
    nstore = nstore.extend(require('nstore/query')()),
    appCache = require('../data/appcache'),
    apps = nstore.new('data/apps.db', function() {
      apps.all(function(err, docs) {
        for(var url in docs) {
          appCache.add(url, docs[url]);
        }
        refreshApps();
      });
    }),
    cheerio = require('cheerio'),
    request = require('request'),
    async = require('async'),
    _ = require('underscore'),
    moment = require('moment-timezone'),
    updated = null;

exports.list = function(req, res) {
  appCache.all(function(err, apps) {
  	var clientApps = [];
  	var phoneApps = [];
  	_.each(apps, function(app) {
  		if(app.platform === 'Windows 8') {
  			clientApps.push(app);
  		} else {
				phoneApps.push(app);
  		}
  	});

  	var sortedClientApps = _.sortBy(clientApps, function(app) { return app.rating * 1; });
  	var sortedPhoneApps = _.sortBy(phoneApps, function(app) { return app.rating * 1; });

    console.log('sending', updated);
		res.render('index', { clientApps: sortedClientApps, phoneApps: sortedPhoneApps, updated: updated });
  });
};

function refreshApp(app, callback) {
  getAppDetails(app.url, function(err, details) {
    if(err) return callback(err);
    if(!details) return callback('No details retrieved');

    apps.save(app.url, details, function(err) {
      if(err) return callback(err);

      appCache.add(app.url, details);
      return callback();
    });
  });
}

function refreshApps() {
  appCache.all(function(err, apps) {
    async.each(Object.keys(apps), function(key, callback) {
      refreshApp(apps[key], callback);
    }, function(err) {
      updated = moment().tz('America/Los_Angeles').format('MMMM Do YYYY, h:mm:ss a');
    	console.log('updated', updated);
      setTimeout(refreshApps, 600000);
    });
  });
}

function getPlatform(body) {
  $ = cheerio.load(body);

  var rating = $('#MainStars .RatingTextInline').text();

  return rating ? 'Windows 8' : 'Windows Phone';
}

function getRating(body) {
  $ = cheerio.load(body);

  var rating = $('#MainStars .RatingTextInline').text();
  if(!rating) {
    rating = $('#rating span').text();
    if(rating) {
      rating = rating.split(' ')[0];
    }
  }

  return rating;
}

function getTitle(body) {
  $ = cheerio.load(body);

  var title = $('#ProductTitleText').text();
  if(!title) {
    title = $('#application h1').text();
  }

  return title;
}

function getImage(body) {
  $ = cheerio.load(body);

  var image = $('#AppLogo img').attr('src');
  if(!image) {
    image = $('img.appImage').attr('src');
  }

  return image;
}

function getAppDetails(url, callback) {
  request(url, function(err, resp, body) {
    if(err) {
      callback(err);
    }

    var title = getTitle(body);
    var rating = getRating(body);
    var image = getImage(body);
    var platform = getPlatform(body);

    callback(null, { url: url, title: title, rating: rating, image: image, platform: platform });
  });
}

function isValid(url) {
  return url.indexOf('http://apps.microsoft.com/') === 0 || url.indexOf('http://www.windowsphone.com/') === 0;
}

exports.add = function(req, res) {
  var url = req.body.url;
  if(!url || !isValid(url)) {
    return res.send(400, 'Must supply a store deeplink to add.');
  }

  getAppDetails(url, function(err, details) {
    if(err) throw err;

    if(!details) {
      return res.send(404, 'Could not find an app with the url: ' + url);
    }

    apps.save(url, details, function(err) {
      if(err) throw err;

      appCache.add(url, details);
      res.redirect('/');
    });
  });
};
