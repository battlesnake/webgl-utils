var _ = require('lodash');

module.exports = shader;

var defaultOptions = {
	shaderDir: 'shaders/'
};

/*@ngInject*/
function shader($cacheFactory, $http, $q, Matrix, VertexBuffer) {
	var idx = 0;

	return ShaderRepository;

	function ShaderRepository(gl, options) {
		options = _.defaults({}, options, defaultOptions);

		var cache = $cacheFactory('glslCache-' + idx);
		this.loadVertexShader = load('vertex', gl.VERTEX_SHADER);
		this.loadFragmentShader = load('frag', gl.FRAGMENT_SHADER);
		this.build = build;
		return Object.freeze(this);

		function load(type, typeCode) {
			loader.inject = injector;
			return loader;
			function injector(basename, glsl) {
				var name = basename + '.' + type;
				var test = cache.get(name);
				if (test) {
					//throw?
				}
				return $q.resolve({ name: name, glsl: glsl })
					.then(compileShader);
			}
			function loader(basename) {
				var name = basename + '.' + type;
				var test = cache.get(name);
				if (test) {
					return $q.resolve(test);
				}
				var path = (options.shaderDir + '/').replace(/\/\/$/, '/') + name;
				return $http.get(path)
					.then(function (res) {
						return { name: name, glsl: res.data };
					})
					.catch(function (err) {
						throw new Error('Failed to get shader ' + name);
					})
					.then(compileShader);
			}
			function compileShader(data) {
				var name = data.name;
				var glsl = data.glsl;
				var shader = gl.createShader(typeCode);
				gl.shaderSource(shader, glsl);
				gl.compileShader(shader);
				if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					cache.put(name, { shader: shader, source: glsl });
					return shader;
				} else {
					throw new Error('Failed to compile shader "' + name + '": ' + gl.getShaderInfoLog(shader));
				}
			}
		}

		function get(name) {
			var res = cache.get(name);
			if (!res) {
				throw new Error('Shader not loaded: "' + name + '"');
			}
			return res;
		}

		function build(vertex, fragment) {
			var vs = get(vertex + '.vertex');
			var fs = get(fragment + '.frag');
			var program = gl.createProgram();
			gl.attachShader(program, vs.shader);
			gl.attachShader(program, fs.shader);
			gl.linkProgram(program);
			if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
				return new ShaderProgram(gl, program, vs, fs);
			} else {
				throw new Error('Failed to link shaders: ' + gl.getProgramInfoLog(program));
			}
		}

	}

	function ShaderProperty(gl, program, name, type) {
		this.name = name;
		this.type = type;

		this.getLocation = getLocation;
		this.refreshLocation = refreshLocation;

		var location;

		return;

		function refreshLocation() {
			location = this.updateLocation();
			if (location === null) {
				console.info('Failed to get shader location for ' + [this.form, type, name].join(' '));
			}
		}

		function getLocation() {
			if (location === undefined) {
				this.refreshLocation();
			}
			return location;
		}
	}

	function noLocation(loc) {
		return loc === undefined || loc === null;
	}

	function ShaderAttribute(gl, program, name, type) {
		ShaderProperty.apply(this, arguments);

		var enabled = false;

		this.form = 'attribute';
		this.updateLocation = updateLocation;
		this.enable = enable.bind(this);
		this.disable = disable.bind(this);
		this.bind = bind.bind(this);
		this.set = set;
		return Object.freeze(this);

		function updateLocation() {
			var loc = gl.getAttribLocation(program, name);
			return loc !== -1 ? loc : null;
		}

		function enable() {
			var location = this.getLocation();
			if (noLocation(location)) {
				return false;
			}
			gl.enableVertexAttribArray(location);
			enabled = true;
			return true;
		}

		function disable() {
			var location = this.getLocation();
			if (noLocation(location)) {
				return false;
			}
			gl.disableVertexAttribArray(location);
			enabled = false;
			return true;
		}

		function bind(buffer) {
			if (!(buffer instanceof VertexBuffer)) {
				console.info(buffer);
				throw new Error('Vertex buffer expected');
			}
			var location = this.getLocation();
			if (noLocation(location)) {
				return false;
			}
			if (!enabled) {
				this.enable();
			}
			buffer.bind();
			gl.vertexAttribPointer(location, buffer.width, buffer.typeCode, false, 0, 0);
			return true;
		}

		function set() {
			throw new Error('Cannot <set> shader attribute, use <bind> instead');
		}
	}

	function ShaderUniform(gl, program, name, type) {
		ShaderProperty.apply(this, arguments);

		this.form = 'uniform';

		var setterName, width, isFloat = true, isMatrix = false, isScalar = false;
		switch (type) {
			case "sampler2D":
			case "bool":
			case "int": setterName = "uniform1i"; width = 1; isFloat = false; isScalar = true; break;
			case "float":
			case "vec1": setterName = "uniform1f"; width = 1; isScalar = true; break;
			case "vec2": setterName = "uniform2fv"; width = 2; break;
			case "vec3": setterName = "uniform3fv"; width = 3; break;
			case "vec4": setterName = "uniform4fv"; width = 4; break;
			case "mat1": setterName = "uniformMatrix1fv"; width = 1; isMatrix = true; break;
			case "mat2": setterName = "uniformMatrix2fv"; width = 2; isMatrix = true; break;
			case "mat3": setterName = "uniformMatrix3fv"; width = 3; isMatrix = true; break;
			case "mat4": setterName = "uniformMatrix4fv"; width = 4; isMatrix = true; break;
			default: setterName = "<error>"; break;
		}
		var setFunc = gl[setterName];
		if (!setFunc) {
			throw new Error('Unsupported GLSL data type: "' + type + '"');
		}
		var setter;
		if (isMatrix) {
			setter = function (location, value) {
				if (!value.isMatrix) {
					throw new Error('Matrix required');
				}
				if (value.width !== width || !value.isSquare) {
					console.log(width, value);
					throw new Error('Matrix is the wrong size');
				}
				value = value.transpose().data;
				value = new Float32Array(value);
				return setFunc.call(gl, location, gl.FALSE, value);
			};
		} else {
			setter = function (location, value) {
				if (isScalar) {
					if (typeof value !== 'number') {
						throw new Error('Scalar expected');
					}
					return setFunc.call(gl, location, value);
				}
				if (value.isMatrix) {
					value = value.data;
				} else if (typeof value === 'number') {
					value = [value];
				}
				if (value instanceof Array) {
					if (isFloat) {
						value = new Float32Array(value);
					} else {
						value = new Int8Array(value);
					}
				}
				return setFunc.call(gl, location, value);
			};
		}

		this.updateLocation = updateLocation;
		this.assign = setValue.bind(this);
		this.set = setValue.bind(this);
		this.bind = bind;

		return Object.freeze(this);

		function updateLocation() {
			return gl.getUniformLocation(program, name);
		}

		function setValue(value) {
			var location = this.getLocation();
			if (noLocation(location)) {
				return false;
			}
			if (value instanceof Array) {
				value = [].concat.apply([], value);
			}
			setter.call(this, location, value);
			return true;
		}

		function bind() {
			throw new Error('Cannot <bind> shader uniform, use <set> instead');
		}
	}

	function DummyVariable(gl, program, name, type) {
		this.name = name;
		this.type = type;
		this.form = 'dummy';
		this.getLocation = function () {};
		this.refreshLocation = function () {};
		this.updateLocation = function () {};
		this.enable = function () {};
		this.disable = function () {};
		this.bind = function () {};
		this.set = function () {};

		return Object.freeze(this);
	}

	function ShaderProgram(gl, program, vs, fs) {
		var attrRx = /;\s*attribute\s+(\S+)\s+(\S+)\b/g;
		var uniformRx = /;\s*uniform\s+(\S+)\s+(\S+)\b/g;
		var source = ';' + vs.source + ';\n' + fs.source;
		var match;
		var vars = {}, varArray = [];
		while ((match = attrRx.exec(source))) {
			pushVar(new ShaderAttribute(gl, program, match[2], match[1]));
		}
		while ((match = uniformRx.exec(source))) {
			pushVar(new ShaderUniform(gl, program, match[2], match[1]));
		}
		this.program = program;
		this.use = use;
		this.get = getVariable;
		this.enableAll = enableAll;
		this.disableAll = disableAll;

		return Object.freeze(this);

		function getVariable(name) {
			var varName = 'var_' + name;
			var v = vars[varName];
			if (!v) {
				console.warn('Variable "' + name + '" does not exist');
				vars[varName] = new DummyVariable(gl, program, name, 'dummy');
				return vars[varName];
			}
			return v;
		}

		function enableAll(except) {
			varArray.forEach(function (v) {
				if (v instanceof ShaderAttribute) {
					if (!except || except.indexOf(v.name) === -1) {
						v.enable();
					}
				}
			});
		}

		function disableAll(except) {
			varArray.forEach(function (v) {
				if (v instanceof ShaderAttribute) {
					if (!except || except.indexOf(v.name) === -1) {
						v.disable();
					}
				}
			});
		}

		function pushVar(v) {
			vars['var_' + v.name] = v;
			varArray.push(v);
		}

		function use() {
			gl.useProgram(program);
			varArray.forEach(function (v) {
				v.updateLocation();
			});
		}
	}

}
