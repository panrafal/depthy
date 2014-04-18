'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($scope) {

    var self = this

    $scope.compoundSource = 'samples/1.jpg'
    $scope.depthSource = 'samples/1-depth.png'
    $scope.imageSource = 'samples/1-image.jpg'

    this.handleCompoundFile = function(file) {
        var imageReader = new FileReader();
        imageReader.onload = function(e) {
            $scope.compoundError = ""

            try {
                var image = self.parseCompoundImage(e.target.result)

                $scope.imageSource = image.imageUri
                $scope.depthSource = image.depthUri

                delete image.imageData
                delete image.depthData
                delete image.imageUri
                delete image.depthUri

                $scope.metaData = image
            } catch (e) {
                $scope.imageSource = false
                $scope.depthSource = false
                $scope.metadata = {}
                $scope.compoundError = e
            }
            $scope.$apply();
        }
        imageReader.readAsBinaryString(file)

        var dataReader = new FileReader();
        dataReader.onload = function(e) {
            console.log(e)
            $scope.compoundSource = e.target.result;
            $scope.$apply();
        }
        dataReader.readAsDataURL(file)
    }

    this.parseCompoundImage = function(data) {
        var extendedXmp = (data.match(/xmpNote:HasExtendedXMP="(.+?)"/i) || [])[1];
        if (extendedXmp) {
            // we need to clear out JPEG's block headers. Let's be juvenile and don't care about checking this for now, shall we?
            // 2b + 2b + http://ns.adobe.com/xmp/extension/ + 1b + extendedXmp + 4b + 4b
            data = data.replace(new RegExp('[\\s\\S]{4}http:\\/\\/ns\\.adobe\\.com\\/xmp\\/extension\\/[\\s\\S]' + extendedXmp + '[\\s\\S]{8}', 'g'), '')
        }

        var xmp = data.match(/<x:xmpmeta [\s\S]+?<\/x:xmpmeta>/g),
            result = {}
        if (!xmp) throw "No XMP metadata found";
        xmp = xmp.join("\n", xmp);


        result.imageMime = (xmp.match(/GImage:Mime="(.+?)"/i) || [])[1];
        result.imageData = (xmp.match(/GImage:Data="(.+?)"/i) || [])[1];
        result.depthMime = (xmp.match(/GDepth:Mime="(.+?)"/i) || [])[1];
        result.depthData = (xmp.match(/GDepth:Data="(.+?)"/i) || [])[1];

        if (result.imageMime && result.imageData) {
            result.imageUri = 'data:' + result.imageMime + ';base64,' + result.imageData
        }
        if (result.depthMime && result.depthData) {
            result.depthUri = 'data:' + result.depthMime + ';base64,' + result.depthData
        }
        
        result.focalDistance = (xmp.match(/GFocus:FocalDistance="(.+?)"/i) || [])[1];

        return result;
    }

    // $scope.$on('fileselect', function(e, files) {
    $scope.$watch('compoundFiles', function(files) {
        if (files && files.length) {
            self.handleCompoundFile(files[0])
        }
    })



});