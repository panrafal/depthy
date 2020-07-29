'use strict';

describe('Controller: ViewerCtrl', function () {

  // load the controller's module
  beforeEach(module('depthyApp'));

  var ViewerCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    ViewerCtrl = $controller('ViewerCtrl', {
      $scope: scope
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(scope.awesomeThings.length).toBe(3);
  });
});
