(function() {
  'use strict';

  window.dataURItoArrayBuffer = function dataURItoArrayBuffer(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
      byteString = atob(dataURI.split(',')[1]);
    else
      byteString = window.unescape(dataURI.split(',')[1]);
    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return {buffer: ab, mime: mimeString};
  };

  window.dataURItoBlob = function dataURItoBlob(dataURI) {
    var buffer = window.dataURItoArrayBuffer(dataURI);
    // write the ArrayBuffer to a blob, and you're done
    return new Blob([buffer.buffer],{type: buffer.mime});
  };


})();
// credit goes to http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata

