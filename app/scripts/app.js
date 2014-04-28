'use strict';

angular.module('depthyApp', [
  // 'ngSanitize',
  'ngAnimate',
  'ga',
  // 'visibleClass',
  // 'mgcrea.ngStrap.modal',
  // 'mgcrea.ngStrap.popover',
  // 'mgcrea.ngStrap.button'
  'ui.bootstrap.buttons',
  'ui.bootstrap.modal',
  'ui.bootstrap.transition',
])
//fix blob
.config(function($compileProvider, $sceDelegateProvider) {
  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|blob):|data:image\//);
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|blob):/);
});
