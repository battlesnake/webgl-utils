var q = require('q');

var _quaternion = require('./quaternion')();
var _matrix = require('./matrix')(_quaternion);
var _vbo = require('./vertex-buffer')();
var _shader = require('./shader')(cacheFactory, httpFactory(), q, _matrix, _vbo);
var _texture  = require('./texture2d')(q);
var _gl = require('./gl')(q, _shader, _texture, _matrix, _quaternion);

module.exports = {
	Matrix: _matrix,
	Quaternion: _quaternion,
	VBO: _vbo,
	ShaderRepository: _shader,
	TextureRepository: _texture,
	GL: _gl
};

function cacheFactory() {
	var cache = {};
	return {
		put: put,
		get: get
	};
	function put(key, val) {
		cache[prop(key)] = val;
	}
	function get(key) {
		return cache[prop(key)];
	}
	function prop(key) {
		return '_key_' + key;
	}
}

function httpFactory() {
	return {
		get: get
	};
	function get(url) {
		var xhr = new XMLHttpRequest();
		var deferred = q.defer();
		xhr.onreadystatechange = rsc;
		xhr.open('GET', url, true);
		xhr.send(null);
		return deferred.promise;
		function rsc() {
			if (xhr.readyState !== XMLHttpRequest.DONE) {
				return;
			}
			if (xhr.status === 200) {
				deferred.resolve({ data: xhr.responseText });
			} else {
				deferred.reject(new Error('Failed to get "' + url + '": code ' + xhr.status));
			}
		}
	}
}
