'use strict';

angular.module('depthyApp')
.service('StateModal', function StateModal($rootScope, $modal, $state, $location, $window, $q) {

  /** Changes $state to show a modal...
  Returns deffered which will go back in history if rejected, or replace the location if resolved.
  Back buttons will reject the promise. */
  this.stateDeferred = function(state, options) {
    options = options || {};
    if (state && $state.current.name !== state && !options.stateCurrent) $state.go(state, options.stateParams, options.stateOptions);
    var deferred = $q.defer(), deregister;

    deferred.promise.then(
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
          deferred.reject();
        }
      });
    }
    return deferred;
  };

  this.showModal = function(state, options) {
    var deferred = this.stateDeferred(state, options),
        modal;

    modal = $modal.open(options || {});

    modal.result.then(
      function() {
        deferred.resolve();
      },
      function() {
        deferred.reject();
      }
    );

    deferred.promise.finally(function() {
      modal.close();
    });

    return modal;
  };

  this.showAlert = function(message, options, state) {
    return this.showModal(state || 'alert', angular.extend({
      templateUrl: 'views/alert-modal.html',
      windowClass: 'alert-modal',
      scope: angular.extend($rootScope.$new(), {message: message}),
    }, options || {}));
  };


});
