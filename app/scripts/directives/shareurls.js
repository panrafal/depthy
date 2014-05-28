/**
Angular ShareUrls

Based on https://github.com/bradvin/social-share-urls

Copyright 2014 Rafał Lindemann http://github.com/panrafal
*/
angular.module('shareUrls', [])
.provider('ShareUrls', function () {
  'use strict';

  var provider = this,
    templates = {
    facebook: {
      url: 'http://www.facebook.com/sharer.php?s=100&p[url]={url}&p[images][0]={img}&p[title]={title}&p[summary]={desc}'
    },
    'facebook-feed': {
      url: 'https://www.facebook.com/dialog/feed?app_id={app_id}&link={url}&picture={img}&name={title}&description={desc}&redirect_uri={redirect_url}'
    },
    'facebook-likebox': {
      // &width=50&height=80
      url: '//www.facebook.com/plugins/like.php?href={url}&colorscheme={scheme}&layout={layout}&action={action}&show_faces=false&send=false&appId=&locale={locale}'
    },
    twitter: {
      url: 'https://twitter.com/share?url={url}&text={title}&via={via}&hashtags={hashtags}'
    },
    'twitter-follow': {
      url: 'https://twitter.com/intent/user?screen_name={name}'
    },
    google: {
      url: 'https://plus.google.com/share?url={url}',
    },
    pinterest: {
      url: 'https://pinterest.com/pin/create/bookmarklet/?media={img}&url={url}&is_video={is_video}&description={title}',
    },
    linkedin: {
      url: 'http://www.linkedin.com/shareArticle?url={url}&title={title}',
    },
    buffer: {
      url: 'http://bufferapp.com/add?text={title}&url={url}',
    },
    digg: {
      url: 'http://digg.com/submit?url={url}&title={title}',
    },
    tumblr: {
      url: 'http://www.tumblr.com/share/link?url={url}&name={title}&description={desc}',
    },
    reddit: {
      url: 'http://reddit.com/submit?url={url}&title={title}',
    },
    stumbleupon: {
      url: 'http://www.stumbleupon.com/submit?url={url}&title={title}',
    },
    delicious: {
      url: 'https://delicious.com/save?v=5&provider={provider}&noui&jump=close&url={url}&title={title}',
    },
  };

  this.defaults = {
    popupWidth: 600,
    popupHeight: 300,
  };


  function generateUrl(url, opt) {
    var prop, arg, argNe;
    for (prop in opt) {
      arg = '{' + prop + '}';
      if  (url.indexOf(arg) !== -1) {
        url = url.replace(new RegExp(arg, 'g'), encodeURIComponent(opt[prop]));
      }
      argNe = '{' + prop + '-ne}';
      if  (url.indexOf(argNe) !== -1) {
        url = url.replace(new RegExp(argNe, 'g'), opt[prop]);
      }
    }
    return cleanUrl(url);
  }
  
  function cleanUrl(fullUrl) {
    //firstly, remove any expressions we may have left in the url
    fullUrl = fullUrl.replace(/\{([^{}]*)}/g, '');
    
    //then remove any empty parameters left in the url
    var params = fullUrl.match(/[^\=\&\?]+=[^\=\&\?]+/g),
      url = fullUrl.split('?')[0];
    if (params && params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return url;
  }


  this.$get = function($window, $location) {
    var ShareUrls = {
      defaults: angular.extend({url: $location.absUrl()}, provider.defaults),

      getUrl: function(type, opts) {
        var template = templates[type];
        if (!template) throw 'Unknown template ' + type;
        opts = angular.extend({}, template.defaults || {}, this.defaults || {}, opts || {});

        return generateUrl(template.url, opts);
      },

      openPopup: function(type, opts) {
        var template = templates[type];
        if (!template) throw 'Unknown template ' + type;
        opts = angular.extend({}, template.defaults || {}, this.defaults || {}, opts || {});


        var width = opts.popupWidth || 800,
            height = opts.popupHeight || 500,
            px = Math.floor(((screen.availWidth || 1024) - width) / 2),
            py = Math.floor(((screen.availHeight || 700) - height) / 2),
            url = generateUrl(template.url, opts);
     
        // open popup
        var popup = $window.open(url, 'social',
          'width=' + width + ',height=' + height +
          ',left=' + px + ',top=' + py +
          ',location=0,menubar=0,toolbar=0,status=0,scrollbars=1,resizable=1');
          
        if (popup) {
          popup.focus();
        }
     
        return !!popup;
      }

    };

    return ShareUrls;
  };
})
.directive('sharePopup', function (ShareUrls) {
  'use strict';
  return {
    restrict: 'A',
    link: function postLink($scope, $element, $attrs) {

      $element.on('click', function(e) {
        ShareUrls.openPopup($attrs.sharePopup, $attrs.shareOptions ? $scope.$eval($attrs.shareOptions) : {});
        e.preventDefault();
      });

    }
  };
});

