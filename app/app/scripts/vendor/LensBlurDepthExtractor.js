/**
MIT licensed
https://github.com/spite/android-lens-blur-depth-extractor
Copyright (C) 2014 Jaume Sanchez Elias http://twitter.com/thespite
*/
(function() {

	'use strict';

	var DepthReader = function() {

		this.focus = { 
			blurAtInfinity: 0,
			focalDistance: 0,
			focalPoint: 0,
			focalPointX: 0,
			focalPointY: 0
		}
		this.image = {
			mime: '',
			data: null
		}
		this.depth = {
			format: '',
			near: 0,
			far: 0,
			mime: '',
			data: null
		}

	}

	function memcpy( dst, dstOffset, src, srcOffset, length ) {

		var dstU8 = new Uint8Array( dst, dstOffset, length );
		var srcU8 = new Uint8Array( src, srcOffset, length );
		dstU8.set( srcU8 );

	};

	function ab2str( buf ) {

		return String.fromCharCode.apply( null, new Uint8Array( buf ) );

	};

	function matchAttribute( id, str ) {

		var re = new RegExp( id + '="([\\S]*)"', 'gmi' );
		var m = re.exec( str );
		if( m ) return m[ 1 ];
		return null;

	};

	DepthReader.prototype.parseFile = function( arrayBuffer, onSuccess, onError ) {
		
		var byteArray = new Uint8Array( arrayBuffer ),
			str = '';

		if( byteArray[ 0 ] === 0xff && byteArray[ 1 ] === 0xd8 ) {

			var boundaries = [];
			for (var i = 0; i < byteArray.byteLength; i++) {
				if( byteArray[ i ] === 0xff && byteArray[ i + 1 ] === 0xe1 ) {
					boundaries.push( i );
					i++;
				}
			}
			boundaries.push( byteArray.byteLength );

			for( var j = 0; j < boundaries.length - 1; j++ ) {

				if( byteArray[ boundaries[ j ] ] == 0xff && byteArray[ boundaries[ j ] + 1 ] == 0xe1 ) {

					var length = byteArray[ boundaries[ j ] + 2 ] * 256 + byteArray[ boundaries[ j ] + 3 ];

					var offset = 79;
					if( offset > length ) offset = 0;
					length += 2;

					var tmp = new ArrayBuffer( length - offset );
					memcpy( tmp, 0, arrayBuffer, boundaries[ j ] + offset, length - offset);
					var tmpStr = ab2str( tmp );
					str += tmpStr;

				}

			}

			this.focus.blurAtInfinity = matchAttribute( 'GFocus:BlurAtInfinity', str );
			this.focus.focalDistance  = matchAttribute( 'GFocus:focalDistance', str );
			this.focus.focalPoint     = matchAttribute( 'GFocus:focalPoint', str );
			this.focus.focalPointX    = matchAttribute( 'GFocus:focalPointX', str );
			this.focus.focalPointY    = matchAttribute( 'GFocus:focalPointY', str );

			this.image.mime = matchAttribute( 'GImage:Mime', str );
			this.image.data = matchAttribute( 'GImage:Data', str );
			
			this.depth.format = matchAttribute( 'GDepth:Format', str );
			this.depth.near   = matchAttribute( 'GDepth:Near', str );
			this.depth.far    = matchAttribute( 'GDepth:Far', str );
			this.depth.mime   = matchAttribute( 'GDepth:Mime', str );
			this.depth.data   = matchAttribute( 'GDepth:Data', str );

			if( this.depth.data === null ) {
				if( onError ) onError( 'No depth data found' );
				return;
			}

			if( onSuccess ) onSuccess();

		} else {
			if( onError ) onError( 'File is not a JPEG' );
		}

	};

	DepthReader.prototype.loadFile = function( file, onSuccess, onError ) {

		var xhr = new XMLHttpRequest();
		xhr.open( 'get', file );
		xhr.responseType = 'arraybuffer';
		var self = this;
		xhr.onload = function() {
			self.parseFile( this.response, onSuccess, onError );
		};
		xhr.send( null );

	};

	window.DepthReader = DepthReader;

} )();