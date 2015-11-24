var webglDebug = require('./webglDebug');
var _ = require('lodash');

module.exports = glModule;

/*@ngInject*/
function glModule($q, ShaderRepository, Matrix, Quaternion) {

	function onGLError(err, func, args) {
		console.error('WebGL call failed', err, func, args);
		throw new Error(func + ': ' + err);
	}

	function GL(canvas, options) {
		if (!canvas) {
			return $q.reject(new Error('Canvas element not found'));
		}
		/* Context */
		var context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (options.debug && context) {
			context = webglDebug.makeDebugContext(context, onGLError);
		}
		if (!context) {
			return $q.reject(new Error('Failed to acquire WebGL context'));
		}
		context.disable(context.CULL_FACE);
		context.enable(context.DEPTH_TEST);
		context.depthFunc(context.LEQUAL);
		/* Shaders */
		var shaders = {};
		var promise = $q.when(true);
		if (options.shaders) {
			promise = $q.all(
				_(options.shaders)
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
								return shaders.loadVertexShader(shader);
							}),
							lists[1].forEach(function (shader) {
								return shaders.loadFragmentShader(shader);
							})
						]);
					})
					.value()
				).then(function (res) {
					_(options.shaders)
						.pairs()
						.map(function (pair) {
							var name = pair[0];
							var vertex = pair[1][0];
							var fragment = pair[1][1];
							return [name, shaders.build(vertex, fragment)];
						})
						.object()
						.value();
				})
				;
		}

		var self = this;
		return promise.then(function () {
			return _.extend(self, {
				canvas: canvas,
				context: context,
				shaders: shaders,
				viewport: [0, 0, 1, 1],
				aspect: 1,
				/* Projection matrix */
				projection: new Matrix.Orthographic(-1, 1, -1, 1, -1, 1),
				updateProjection: updateProjection,
				updateOrthographic: updateOrthographic,
				updatePerspective: updatePerspective,
				camera: {
					position: Matrix.vec3(),
					scale: 1,
					orientation: new Quaternion()
				},
				/* Apply to model matrix */
				getCameraMatrix: getCameraMatrix
			});
		});

		function updateProjection(width, height) {
			var w = width || canvas.offsetWidth;
			var h = height || canvas.offsetHeight;
			var a = w / h;
			this.viewport = [0, 0, w, h];
			this.aspect = a;
			canvas.width = w;
			canvas.height = h;
			context.viewport(0, 0, w, h);
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
