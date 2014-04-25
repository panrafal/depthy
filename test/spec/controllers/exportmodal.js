'use strict';

describe('Controller: ExportmodalCtrl', function () {

  // load the controller's module
  beforeEach(module('depthyApp'));

  var ExportmodalCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    ExportmodalCtrl = $controller('ExportmodalCtrl', {
      $scope: scope
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(scope.awesomeThings.length).toBe(3);
  });
});
