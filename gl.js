var webglDebug = require('./webgl-debug');
var _ = require('lodash');

module.exports = glModule;

var defaultOptions = {
	debug: false,
	frontFace: 'ccw',
	cullFace: 'none',
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
	ss = (!ss || ss === 'none') ? ['s', '1-s'] : ss;
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

		var self = this;

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
		if (cull === null) {
			gl.disable(gl.CULL_FACE);
		} else {
			gl.enable(gl.CULL_FACE);
			gl.cullFace(cull);
		}
		var depth = depthTestValue(gl, options.depthTest);
		if (depth === null) {
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(depth);
		}
		var blend = alphaBlendFunc(gl, options.alphaBlend);
		if (blend === null) {
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
				.unzip()
				.map(function (list) {
					return _(list).uniq().reject(_.isUndefined).value();
				})
				.map(function (list, i) {
					if (i === 0) {
						return list.map(function (shader) {
							return shaderRepo.loadVertexShader(shader);
						});
					} else if (i === 1) {
						return list.map(function (shader) {
							return shaderRepo.loadFragmentShader(shader);
						});
					}
				})
				.flatten()
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

		/* Is a (possibly-asynchronous) render active? */
		var rendering = false;
		/* Cancels pending animation frame */
		var cancelPendingFrame = function () {};
		/* Frame time history */
		var tHistory = [];
		/* Time getter (seconds) */
		var time = window.performance.now ?
			function time_usecs() { return window.performance.now() / 1000; } :
			function time_msecs() { return new Date().getTime() / 1000; };
		/* Memento of viewport size */
		var viewportPrev = '';

		/* Result, resolved when all resources are loaded */
		return $q.all(_.flatten([shadersLoaded, texturesLoaded])).then(function () {
			_.extend(self, {
				canvas: canvas,
				context: gl,
				shaders: programs,
				textures: texList,
				repository: {
					shader: shaderRepo,
					texture: textureRepo
				},
				/* Viewport (read-only) */
				width: 1,
				height: 1,
				aspect: 1,
				setViewport: setViewport,
				/* Projection matrix */
				projection: Matrix.Orthographic(-1, 1, -1, 1, -1, 1),
				setOrthographic: setOrthographic,
				setPerspective: setPerspective,
				camera: {
					position: Matrix.vec3(),
					scale: 1,
					orientation: new Quaternion()
				},
				/* Apply to model matrix */
				getCameraMatrix: getCameraMatrix,
				/*** Rendering ***/
				/* Callback when render is needed */
				onrender: function (tPrev, tNow, dt) {},
				/* When set, causes update() to trigger render, is reset on re-render */
				renderNeeded: true,
				/* When set, causes update() to trigger render, is not reset on re-render */
				animating: false,
				/* Invalidate+Update, synchronous re-render */
				refresh: refresh,
				/* Signals that we need to re-render (sets renderNeeded) */
				invalidate: invalidate,
				/* Triggers render if renderNeeded||animating */
				update: update,
				/*** Animation ***/
				/* Animates using requestAnimationFrame unless dt param is specified */
				startAnimating: startAnimating,
				/* Stops ongoing animation */
				stopAnimating: stopAnimating,
				/*** Monitor viewport, refresh when viewport size changes ***/
				monitoringViewport: false,
			});
			startViewportObserver();
			return self;
		});

		function startViewportObserver() {
			setInterval(recheckViewport, 1000/30);
		}

		function getViewportMemento() {
			setViewport();
			return self.width + ',' + self.height;
		}

		function recheckViewport() {
			var memento = getViewportMemento();
			if (memento !== viewportPrev) {
				viewportPrev = memento;
				refresh();
			}
		}

		function refresh() {
			self.invalidate();
			self.update();
		}

		function invalidate() {
			self.renderNeeded = true;
		}

		function update() {
			if (self.renderNeeded || self.animating) {
				renderFrame();
			}
		}

		function renderFrame() {
			if (rendering) {
				invalidate();
				return;
			}
			var t = time();
			var tHistLen = tHistory.length;
			var tPrev = tHistLen ? tHistory[tHistLen - 1] : t;
			tHistory.push(t);
			while (tHistory.length > 30 || (tHistory.length > 3 && t - tHistory[0] > 1)) {
				tHistory.pop();
			}
			var dt = t - tPrev;
			self.renderNeeded = false;
			try {
				rendering = true;
				var res = self.onrender(tPrev, t, dt);
				if (res && res.then) {
					res
						.catch(failed)
						.finally(() => { rendering = false; })
						.done();
				}
			} catch (e) {
				failed(e);
			}

			function failed(e) {
				rendering = false;
				self.stopAnimating();
				throw e;
			}
		}

		function startAnimating(dt) {
			if (self.animating) {
				self.stopAnimating();
			}
			self.animating = true;
			dt = dt || 0;
			if (dt || !window.requestAnimationFrame) {
				var interval = window.setInterval(function () {
					refresh();
				}, dt * 1000);
				cancelPendingFrame = function () {
					window.clearInterval(interval);
				};
			} else {
				var stopped = false;
				var request = requestAnimationFrame(function onFrame() {
					if (stopped) {
						return;
					}
					refresh();
					request = requestAnimationFrame(onFrame);
				});
				cancelPendingFrame = function () {
					stopped = true;
					if (window.cancelAnimationFrame) {
						window.cancelAnimationFrame(request);
					}
				};
			}
		}

		function stopAnimating() {
			self.animating = false;
			cancelPendingFrame();
		}

		function setViewport() {
			var w = canvas.clientWidth;
			var h = canvas.clientHeight;
			var a = w / h;
			self.width = w;
			self.height = h;
			self.aspect = a;
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}

		function setOrthographic(size, scaleMode, near, far) {
			size = (typeof size === 'number') ? size : 1;
			scaleMode = scaleMode || 'fixed-height';
			near = (typeof near === 'number') ? near : -1;
			far = (typeof far === 'number') ? far : +1;
			var w = size;
			var h = size;
			var a = self.aspect;
			if (scaleMode === 'fixed-height') {
				w *= a;
			} else if (scaleMode === 'fixed-width') {
				h /= a;
			} else if (scaleMode === 'fixed-area') {
				h = size / Math.sqrt(a);
				w = a * h;
			} else if (scaleMode === 'fit' || scaleMode === 'contain') {
				if (a < 1) {
					h /= a;
				} else {
					w *= a;
				}
			} else if (scaleMode === 'fill' || scaleMode === 'cover') {
				if (a > 1) {
					h /= a;
				} else {
					w *= a;
				}
			} else if (scaleMode === 'square') {
			} else {
				throw new Error('Unknown orthographic scale mode: ' + scaleMode);
			}
			self.clip = { width: Math.abs(w), height: Math.abs(h), depth: Math.abs(far - near) };
			self.projection = Matrix.Orthographic(-w/2, w/2, h/2, -h/2, near, far);
		}

		function setPerspective(zoom_35mm, near, far) {
			near = (typeof near === 'number') ? near : 1;
			far = (typeof far === 'number') ? far : 1000;
			self.clip = { depth: Math.abs(far - near) } ;
			self.projection = Matrix.Camera35mm(self.aspect, zoom_35mm, near, far);
		}

		function getCameraMatrix() {
			return Matrix.Chain(
				Matrix.Rotation(self.camera.orientation.neg()),
				Matrix.Scale(1 / self.camera.scale),
				Matrix.Translation(self.camera.position.neg())
			);
		}
	}

	return GL;
}
