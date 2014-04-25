'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, depthy) {
  depthy.exportAnimation();
});
