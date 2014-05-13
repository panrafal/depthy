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
    url: '/i/:id',
    controller: ['$stateParams', '$state', 'depthy', function ($stateParams, $state, depthy) {
      depthy.loadUrlDirectImage('http://i.imgur.com/' + $stateParams.id + '.png', true, {
        shareUrl: $state.href('imgur', {id: $stateParams.id}, {absolute: true}),
        thumb: 'http://i.imgur.com/' + $stateParams.id + 'm.jpg',
        storeUrl: 'http://imgur.com/' + $stateParams.id
      });
    }]
  })
  .state('imgur2', {
    url: '/ii/:id',
    controller: ['$stateParams', 'depthy', function ($stateParams, depthy) {
      depthy.loadUrlImage('http://i.imgur.com/' + $stateParams.id + '.png');
    }]
  })
  // hollow state for locally loaded files
  .state('file', {
    url: '/file',
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
  .state('export.gif', {
    url: '/gif',
  })
  .state('export.gif.options', {
    url: '/options',
  })
  .state('export.gif.run', {
    url: '/run',
  })
  .state('share', {
    url: '/share',
  })
  .state('share.png', {
    url: '/png',
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