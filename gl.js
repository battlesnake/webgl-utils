var webglDebug = require('./webgl-debug');
var _ = require('lodash');

module.exports = glModule;

var defaultOptions = {
	debug: false,
	frontFace: 'ccw',
	cullFace: 'back',
	depthTest: '<=',
	alphaBlend: ['s', '1-s'],
	shaders: {}
};

function frontFaceValue(gl, s) {
	s = s || 'ccw';
	if (s === 'ccw') {
		return gl.CCW;
	} else if (s === 'cw') {
		return gl.CW;
	} else {
		throw new Error('Invalid front-face value: ' + s);
	}
}

function cullFaceValue(gl, s) {
	s = s || 'none';
	if (s === 'none') {
		return null;
	} else if (s === 'front') {
		return gl.FRONT;
	} else if (s === 'back') {
		return gl.BACK;
	} else if (s === 'both') {
		return gl.FRONT_AND_BACK;
	} else {
		throw new Error('Invalid face-cull value: ' + s);
	}
}

function depthTestValue(gl, s) {
	s = s.toLowerCase() || '<=';
	if (s === 'none') {
		return null;
	} else if (s === '<=') {
		return gl.LEQUAL;
	} else if (s === '>=') {
		return gl.GEQUAL;
	} else if (s === '>') {
		return gl.GREATER;
	} else if (s === '<') {
		return gl.LESS;
	} else if (s === '!=') {
		return gl.NOTEQUAL;
	} else if (s === '==') {
		return gl.EQUAL;
	} else if (s === 'true') {
		return gl.ALWAYS;
	} else if (s === 'false') {
		return gl.NEVER;
	} else {
		throw new Error('Invalid depth-test value: ' + s);
	}
}

function alphaBlendFuncTerm(gl, s) {
	s = s.toLowerCase().replace(/\s/g, '') || '1';
	if (s  === 'none') {
		return null;
	} if (s === '1' || s === 'one') {
		return gl.ONE;
	} else if (s === '0' || s === 'zero') {
		return gl.ZERO;
	} else if (s === 's' || s === 'src') {
		return gl.SRC_ALPHA;
	} else if (s === '1-s' || s === '1-src') {
		return gl.ONE_MINUS_SRC_ALPHA;
	} else if (s === 'd' || s === 'dst') {
		return gl.DST_ALPHA;
	} else if (s === '1-d' || s === '1-dst') {
		return gl.ONE_MINUS_DST_ALPHA;
	} else {
		throw new Error('Invalid alpha-blend value: ' + s);
	}
}

function alphaBlendFunc(gl, ss) {
	ss = (!ss || ss === 'none') ? null : ['s', '1-s'];
	return ss.map(function (s) { return alphaBlendFuncTerm(gl, s); });
}

/*@ngInject*/
function glModule($q, ShaderRepository, TextureRepository, Matrix, Quaternion) {

	function onGLError(err, func, args) {
		console.error('WebGL call failed', err, func, args);
		throw new Error(func + ': ' + err);
	}

	function GL(canvas, options) {
		if (!canvas) {
			return $q.reject(new Error('Canvas element not found'));
		}
		options = _.defaults({}, options, defaultOptions);
		/* Context */
		var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (options.debug && gl) {
			gl = webglDebug.makeDebugContext(gl, onGLError);
		}
		if (!gl) {
			return $q.reject(new Error('Failed to acquire WebGL gl'));
		}
		/* Configure gl */
		var front = frontFaceValue(gl, options.frontFace);
		gl.frontFace(front);
		var cull = cullFaceValue(gl, options.cullFace);
		if (cull) {
			gl.enable(gl.CULL_FACE);
			gl.cullFace(cull);
		} else {
			gl.disable(gl.CULL_FACE);
		}
		var depth = depthTestValue(gl, options.depthTest);
		if (!depth) {
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(depth);
		}
		var blend = alphaBlendFunc(gl, options.alphaBlend);
		if (!blend) {
			gl.disable(gl.BLEND);
		} else {
			gl.enable(gl.BLEND);
			gl.blendEquation(gl.FUNC_ADD);
			gl.blendFunc(blend[0], blend[1]);
		}
		/* Shaders */
		var shaderRepo = new ShaderRepository(gl);
		var shaders = options.shaders || {};
		var programs;
		var shadersLoaded =
			$q.all(_(shaders)
				.values()
				.zip()
				.map(function (lists) {
					return lists.map(function (list) {
						return _.uniq(list).reject(_.isUndefined);
					});
				})
				.map(function (lists) {
					return _.flatten([
						lists[0].forEach(function (shader) {
							return shaderRepo.loadVertexShader(shader);
						}),
						lists[1].forEach(function (shader) {
							return shaderRepo.loadFragmentShader(shader);
						})
					]);
				})
				.value()
			)
			.then(function (res) {
				programs = _(options.shaders)
					.pairs()
					.map(function (pair) {
						var name = pair[0];
						var vertex = pair[1][0];
						var fragment = pair[1][1];
						return [name, shaderRepo.build(vertex, fragment)];
					})
					.object()
					.value();
			})
			;

		/* Textures */
		var textureRepo = new TextureRepository(gl);
		var textures = options.textures || {};
		var texturesLoaded = [];
		var texList = _(textures)
			.pairs()
			.map(function (pair) {
				var name = pair[0];
				var params = pair[1];
				var url = typeof params === 'string' ? params : params[0];
				var options = typeof params === 'string' ? null : params[1];
				var tex = textureRepo.create();
				var promise = tex.load(url, options);
				texturesLoaded.push(promise);
				return [name, tex];
			})
			.object()
			.value()
			;
		texturesLoaded = $q.all(texturesLoaded);

		/* Return */
		var self = this;
		return $q.all(shadersLoaded, texturesLoaded).then(function () {
			return _.extend(self, {
				canvas: canvas,
				context: gl,
				shaders: programs,
				textures: texList,
				repository: {
					shader: shaderRepo,
					texture: textureRepo
				},
				/* Viewport */
				viewport: [0, 0, 1, 1],
				aspect: 1,
				updateViewport: updateViewport,
				/* Projection matrix */
				projection: new Matrix.Orthographic(-1, 1, -1, 1, -1, 1),
				updateOrthographic: updateOrthographic,
				updatePerspective: updatePerspective,
				camera: {
					position: Matrix.vec3(),
					scale: 1,
					orientation: new Quaternion()
				},
				/* Apply to model matrix */
				getCameraMatrix: getCameraMatrix,
			});
		});

		function updateViewport(width, height) {
			var w = width || canvas.clientWidth;
			var h = height || canvas.clientHeight;
			var a = w / h;
			this.width = w;
			this.height = h;
			this.viewport = [0, 0, w, h];
			this.aspect = a;
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}

		function updateOrthographic(size, scaleMode, near, far) {
			size = (typeof size === 'number') ? size : 1;
			scaleMode = scaleMode || 'fix-height';
			near = (typeof near === 'number') ? near : -1;
			far = (typeof far === 'number') ? far : +1;
			var w = size;
			var h = size;
			var a = this.aspect;
			if (scaleMode === 'fix-height') {
				w *= a;
			} else if (scaleMode === 'fix-width') {
				h /= a;
			} else if (scaleMode === 'fix-area') {
				h = Math.sqrt(size / a);
				w = a * h;
			} else if (scaleMode === 'square') {
			} else {
				throw new Error('Unknown orthographic scale mode: ' + scaleMode);
			}
			this.projection = new Matrix.Orthographic(-w, h, near, far);
		}

		function updatePerspective(zoom_35mm, near, far) {
			near = (typeof near === 'number') ? near : 1;
			far = (typeof far === 'number') ? far : 1000;
			this.projection = new Matrix.Camera35mm(this.aspect, zoom_35mm, near, far);
		}

		function getCameraMatrix() {
			return Matrix.Chain(
				new Matrix.Rotation(this.camera.orientation.neg()),
				new Matrix.Scale(1 / this.camera.scale),
				new Matrix.Translation(this.camera.position.neg())
			);
		}
	}

	return GL;
}
