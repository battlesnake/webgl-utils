var _quaternion = require('./quaternion')();
var _matrix = require('./matrix')(_quaternion);
var _vbo = require('./vertex-buffer')();

module.exports = {
	Matrix: _matrix,
	Quaternion: _quaternion,
	VBO: _vbo
};
