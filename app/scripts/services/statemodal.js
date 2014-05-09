'use strict';

angular.module('depthyApp')
.service('StateModal', function StateModal($rootScope, $modal, $state, $location, $window) {

  this.showModal = function(state, viewer) {
    // push state for back button
    state = state;
    if (state && $state.current.name !== state && !viewer.stateCurrent) $state.go(state, viewer.stateParams, viewer.stateOptions);
    var modal, deregister;
    modal = $modal.open(viewer || {});

    modal.result.then(
      function() {
        if (deregister) deregister();
        if (state) $location.replace();
      },
      function() {
        if (deregister) deregister();
        if (state) $window.history.back();
      }
    );

    if (state) {
      deregister = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState) {
        if (fromState.name === state) {
          deregister();
          deregister = null;
          state = false;
          modal.close();
        }
      });
    }
    return modal;
  };

  this.showAlert = function(message, viewer, state) {
    return this.showModal(state || 'alert', angular.extend({
      templateUrl: 'views/alert-modal.html',
      windowClass: 'alert-modal',
      scope: angular.extend($rootScope.$new(), {message: message}),
    }, viewer || {}));
  };


});
