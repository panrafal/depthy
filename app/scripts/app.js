'use strict';

angular.module('depthyApp', [
  'ngAnimate',
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

  var firstState = true;
  $stateProvider
  .state('index', {
      url: '/',
      onEnter: function (depthy, $state) {
        if (!$state.current.name) {
          // first timer
          depthy.leftpaneOpen();
          depthy.loadSample('flowers');
        }
      }
  })
  .state('sample', {
      url: '/sample/:sample',
      onEnter: function ($stateParams, depthy) {
        console.log('Sample ROUTE!', $stateParams);
        depthy.loadSample($stateParams.sample);
      }
  })

})
.run(function($rootScope, ga, $location) {
  $rootScope.$on('$stateChangeSuccess', function() {
    ga('set', 'page', $location.url());
    ga('send', 'pageview');
  });
});