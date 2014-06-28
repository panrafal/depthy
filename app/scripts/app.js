'use strict';

angular.module('depthyApp', [
  'ngAnimate',
  'ngTouch',
  'ga',
  'shareUrls',
  // 'visibleClass',
  // 'mgcrea.ngStrap.modal',
  // 'mgcrea.ngStrap.popover',
  // 'mgcrea.ngStrap.button'
  'ui.router',
  'ui.bootstrap.buttons',
  'ui.bootstrap.modal',
  'ui.bootstrap.transition',
  'ui.bootstrap.dropdown',
])
//fix blob
.config(function($compileProvider) {
  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|blob):|data:image\//);
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|blob):/);
})
.config(function ($stateProvider, $urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(false);
  // $locationProvider.hashPrefix('!');

  $urlRouterProvider.otherwise('/');

  $stateProvider
  .state('index', {
    url: '/',
    onEnter: ['depthy', '$state', function (depthy, $state) {
      if (!$state.current.name) {
        // first timer
        depthy.leftpaneOpen();
        depthy.loadSampleImage('flowers');
      }
    }]
  })
  .state('sample', {
    url: '/sample/:id',
    controller: ['$stateParams', 'depthy', function ($stateParams, depthy) {
      depthy.loadSampleImage($stateParams.id);
    }]
  })
  .state('imgur', {
    url: '/ip/:id',
    controller: ['$stateParams', '$state', 'depthy', function ($stateParams, $state, depthy) {
      depthy.loadUrlDirectImage('http://i.imgur.com/' + $stateParams.id + '.png', true, {
        state: 'imgur',
        stateParams: {id: $stateParams.id},
        thumb: 'http://i.imgur.com/' + $stateParams.id + 's.jpg',
        storeUrl: 'http://imgur.com/' + $stateParams.id,
        store: depthy.stores.imgur
      });
    }]
  })
  .state('imgur2', {
    url: '/ii/:id',
    controller: ['$stateParams', 'depthy', function ($stateParams, depthy) {
      depthy.loadUrlImage('http://i.imgur.com/' + $stateParams.id + '.png', {
        state: 'imgur2',
        stateParams: {id: $stateParams.id},
        thumb: 'http://i.imgur.com/' + $stateParams.id + 'm.jpg',
        storeUrl: 'http://imgur.com/' + $stateParams.id,
        store: depthy.stores.imgur
      });
    }]
  })
  .state('url-png', {
    url: '/up?url',
    controller: ['$stateParams', '$state', 'depthy', function ($stateParams, $state, depthy) {
      depthy.loadUrlDirectImage($stateParams.url, true, {
        state: 'url-png',
        stateParams: {url: $stateParams.url},
        // thumb: $stateParams.url,
      });
    }]
  })
  .state('url-auto', {
    url: '/u?url',
    controller: ['$stateParams', '$state', 'depthy', function ($stateParams, $state, depthy) {
      depthy.loadUrlImage($stateParams.url, {
        state: 'url-auto',
        stateParams: {url: $stateParams.url},
        // thumb: $stateParams.url,
      });
    }]
  })
  // hollow state for locally loaded files
  .state('local', {
    url: '/local/:id',
    hollow: true,
    controller: ['$stateParams', 'depthy', function($stateParams, depthy) {
      depthy.loadLocalImage($stateParams.id);
    }]
  })
  // hollow states for back button on alerts
  .state('alert', {
    url: '/alert',
  })
  .state('image', {
    url: '/image',
  })
  .state('image.options', {
    url: '/options',
  })
  .state('image.info', {
    url: '/info',
  })
  .state('export', {
    url: '/export',
  })
  .state('export.png', {
    url: '/png',
  })
  .state('export.jpg', {
    url: '/jpg',
  })
  .state('export.gif', {
    url: '/gif',
  })
  .state('export.gif.options', {
    url: '/options',
  })
  .state('export.gif.run', {
    url: '/run',
  })
  .state('export.webm', {
    url: '/webm',
  })
  .state('export.webm.options', {
    url: '/options',
  })
  .state('export.webm.run', {
    url: '/run',
  })
  .state('export.anaglyph', {
    url: '/anaglyph',
  })
  .state('share', {
    url: '/share',
  })
  .state('share.options', {
    url: '/options',
  })
  .state('share.png', {
    url: '/png',
  })
  .state('draw', {
    url: '/draw',
    hollow: true,
    onEnter: ['depthy', '$timeout', function(depthy, $timeout) {
      $timeout(function() {
        depthy.drawModeEnable();
      })
    }],
    onExit: ['depthy', function(depthy) {
      depthy.drawModeDisable();
    }],
  })
  .state('pane', {
    url: '/pane',
    hollow: true,
    onEnter: ['depthy', function(depthy) {
      depthy.leftpaneOpen();
    }],
    // onExit: ['depthy', function(depthy) {
    //   depthy.leftpaneClose();
    // }]
  })
  .state('howto', {
    url: '/howto',
  })
  .state('howto.lensblur', {
    url: '/lensblur',
    onEnter: ['StateModal', function(StateModal) {
      StateModal.showModal('howto.lensblur', {
        stateCurrent: true,
        templateUrl: 'views/howto-lensblur.html',
      });
    }]
  })
  ;
})
.run(function($rootScope, ga, $location, $state) {
  // check first state
  var stateChangeStart = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState) {
    stateChangeStart();
    console.log(event, toState, toParams, fromState);
    if (toState.hollow || !toState.controller && !toState.onEnter && !toState.template && !toState.templateUrl) {
      console.warn('Hollow state %s', toState.name);
      event.preventDefault();
      $state.go('index');
    }
  });
  $rootScope.$on('$stateChangeSuccess', function() {
    ga('set', 'page', $location.url());
    ga('send', 'pageview');
  });
});