var _ = require('lodash');

module.exports = texture2d;

var defaultOptions = {
	flipY: true,
	interpolate: true,
	wrap: 'clamp'
};

function textureWrapValue(gl, s) {
	s = s || 'clamp';
	if (s === 'clamp') {
		return gl.CLAMP_TO_EDGE;
	} else if (s === 'repeat' || s === 'tile') {
		return gl.REPEAT;
	} else if (s === 'mirror') {
		return gl.MIRRORED_REPEAT;
	} else {
		throw new Error('Invalid texture wrap value: ' + s);
	}
}

function textureWrapValues(gl, ss) {
	ss = ss || 'clamp';
	if (typeof ss === 'string') {
		var val = textureWrapValue(gl, ss);
		return [val, val];
	} else if (ss instanceof Array && ss.length === 2) {
		return ss.map(function (s) { return textureWrapValue(gl, s); });
	} else {
		throw new Error('Invalid texture wrap values: ' + JSON.stringify(ss));
	}
}

/*@ngInject*/
function texture2d($q) {

	var initialised = false;
	var maxIndex;
	var textures;
	function init(gl) {
		maxIndex = gl.getIntegerv(gl.MAX_TEXTURE_IMAGE_UNITS);
		textures = [];
		for (var i = 0; i < maxIndex; i++) {
			textures.push(false);
		}
		initialised = true;
	}

	function allocIndex(last) {
		if (last >= 0 && last < maxIndex) {
			if (!textures[last]) {
				textures[last] = true;
				return last;
			}
		}
		for (var i = 0; i < textures.length; i++) {
			if (!textures[i]) {
				textures[i] = true;
				return i;
			}
		}
		throw new Error('Failed to allocate texture: No slots available to be bound');
	}

	function deallocIndex(index) {
		if (!textures[index]) {
			throw new Error('Attempted to deallocate an already free texture slot');
		}
		textures[index] = false;
	}

	return Texture2D;

	function Texture2D(gl) {
		init(gl);

		var lastIndex = -1;
		this.texture = null;
		this.load = loadTexture;
		this.unload = unloadTexture;
		this.bind = bindTexture;
		this.unbind = unbindTexture;

		return Object.freeze(this);

		function loadTexture(source, options) {
			if (source instanceof Image) {
				return $q.fcall(loadTextureFromImage, source, options);
			} else if (typeof source === 'string') {
				var image = new Image();
				var deferred = $q.defer();
				image.onload = function () {
					deferred.resolve(loadTextureFromImage(image, options));
				};
				image.src = source;
				return deferred.promise;
			} else {
				throw new Error('Cannot load texture: unknown location type');
			}
		}
		
		function unloadTexture() {
			if (!this.texture) {
				return;
			}
			gl.deleteTexture(this.texture);
			this.texture = null;
		}

		function loadTextureFromImage(image, options) {
			unloadTexture();
			options = _.defaults({}, options, defaultOptions);
			if (this.texture === null) {
				this.texture = gl.createTexture();
			}
			var texture = this.texture;
			gl.bindTexture(gl.TEXTURE_2D, texture);
			if (options.flipY) {
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			}
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			if (options.interpolate) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			} else {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			}
			if (options.wrap) {
				var wrap = textureWrapValues(gl, options.wrap);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap[0]);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap[1]);
			}
			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		function bindTexture() {
			var index = allocIndex(lastIndex);
			gl.activeTexture(gl.TEXTURE0 + index);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			lastIndex = index;
			return index;
		}

		function unbindTexture() {
			var index = lastIndex;
			if (index === -1) {
				return;
			}
			gl.activeTexture(gl.TEXTURE0 + index);
			gl.unbindTexture(gl.TEXTURE_2D, this.texture);
			deallocIndex(index);
		}
	}
}
