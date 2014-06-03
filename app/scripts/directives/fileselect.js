'use strict';

angular.module('depthyApp')
.directive('fileselect', function ($parse) {
  return {
    restrict: 'A',
    scope: true,
    link: function postLink(scope, element, attrs) {

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.style.visibility = 'hidden';
      fileInput.style.position = 'absolute';
      fileInput.style.left = '-9000px';

      element.append(fileInput);

      var onDrag = function(e) {
        e.stopPropagation();
        e.preventDefault();
      };

      var onDrop = function(e) {
        e.stopPropagation();
        e.preventDefault();

        console.log(e);

        var dt = e.originalEvent.dataTransfer;
        var files = dt.files;

        handleFiles(files);
        scope.$apply();
      };

      function handleFiles(files) {
        scope.$broadcast('fileselect', files);
        if (attrs.fileselect) {
          $parse(attrs.fileselect).assign(scope, files);
        }
      }

      scope.selectFile = function(e) {
        fileInput.click();
        if (e) e.preventDefault();
      };

      element.on('dragenter', onDrag);
      element.on('dragover', onDrag);
      element.on('drop', onDrop);
      fileInput.addEventListener('change', function() {
        handleFiles(_.filter(this.files));
        fileInput.value = '';
        scope.$apply();
      }, false);

    }
  };
});
