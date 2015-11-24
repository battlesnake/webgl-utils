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

	return TextureRepository;

	function TextureRepository(gl) {
		var maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
		var slots = [];
		var repository = [];
		for (var i = 0; i < maxTextures; i++) {
			slots.push(false);
		}

		function allocIndex(last) {
			if (last >= 0 && last < maxTextures) {
				if (!slots[last]) {
					slots[last] = true;
					return last;
				}
			}
			for (var i = 0; i < slots.length; i++) {
				if (!slots[i]) {
					slots[i] = true;
					return i;
				}
			}
			throw new Error('Failed to allocate texture: No slots available to be bound');
		}

		function deallocIndex(index) {
			if (!slots[index]) {
				throw new Error('Attempted to deallocate an already free texture slot');
			}
			slots[index] = false;
		}

		this.maxTextures = maxTextures;
		this.create = createTexture.bind(this);
		this.unloadAll = unloadAll.bind(this);
		return Object.freeze(this);

		function createTexture() {
			return new Texture2D();
		}

		function unloadAll() {
			var repo = [].slice.apply(repository);
			repo.forEach(function (tex) { tex.unload(); });
		}

		function Texture2D() {
			var lastIndex = -1;
			var texture = null;
			this.load = loadTexture.bind(this);
			this.unload = unloadTexture.bind(this);
			this.bind = bindTexture.bind(this);
			this.unbind = unbindTexture.bind(this);

			return Object.freeze(this);

			function loadTexture(source, options) {
				unloadTexture();
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
				gl.deleteTexture(texture);
				this.texture = null;
				repository.splice(repository.indexOf(this), 1);
			}

			function loadTextureFromImage(image, options) {
				unloadTexture();
				options = _.defaults({}, options, defaultOptions);
				if (texture === null) {
					texture = gl.createTexture();
				}
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
				repository.push(this);
			}

			function bindTexture() {
				var index = allocIndex(lastIndex);
				gl.activeTexture(gl.TEXTURE0 + index);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				lastIndex = index;
				return index;
			}

			function unbindTexture() {
				var index = lastIndex;
				if (index === -1) {
					return;
				}
				gl.activeTexture(gl.TEXTURE0 + index);
				gl.bindTexture(gl.TEXTURE_2D, null);
				deallocIndex(index);
			}
		}
	}
}
