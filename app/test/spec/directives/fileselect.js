'use strict';

describe('Directive: fileselect', function () {

  // load the directive's module
  beforeEach(module('depthyApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<fileselect></fileselect>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the fileselect directive');
  }));
});
