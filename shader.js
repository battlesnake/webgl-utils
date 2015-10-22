module.exports = shader;

/*@ngInject*/
function shader($cacheFactory, $http, $q, Matrix, VertexBuffer) {
	var idx = 0;

	return ShaderRepository;

	function ShaderRepository(gl) {
		var cache = $cacheFactory('glslCache-' + idx);
		this.loadVertexShader = load('vertex', gl.VERTEX_SHADER);
		this.loadFragmentShader = load('frag', gl.FRAGMENT_SHADER);
		this.build = build;
		return Object.freeze(this);

		function load(type, typeCode) {
			return function (basename) {
				var name = basename + '.' + type;
				var test = cache.get(name);
				if (test) {
					return $q.resolve(test);
				}
				var path = 'shader/' + name;
				return $http.get(path)
					.then(function (res) {
						var glsl = res.data;
						var shader = gl.createShader(typeCode);
						gl.shaderSource(shader, glsl);
						gl.compileShader(shader);
						if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
							cache.put(name, { shader: shader, source: glsl });
							return shader;
						} else {
							throw new Error('Failed to compile shader "' + name + '": ' + gl.getShaderInfoLog(shader));
						}
					}, function (err) {
						throw new Error('Failed to get shader ' + name);
					});
			};
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
		this.enable = enable;
		this.disable = disable;
		this.bind = bind;
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

		var setterName, width;
		switch (type) {
			case "int": setterName = "uniform1iv"; width = 1; break;
			case "float":
			case "vec1": setterName = "uniform1fv"; width = 1; break;
			case "vec2": setterName = "uniform2fv"; width = 2; break;
			case "vec3": setterName = "uniform3fv"; width = 3; break;
			case "vec4": setterName = "uniform4fv"; width = 4; break;
			case "mat1": setterName = "uniformMatrix1fv"; width = 1; break;
			case "mat2": setterName = "uniformMatrix2fv"; width = 2; break;
			case "mat3": setterName = "uniformMatrix3fv"; width = 3; break;
			case "mat4": setterName = "uniformMatrix4fv"; width = 4; break;
			default: setterName = "<error>"; break;
		}
		var setFunc = gl[setterName];
		if (!setFunc) {
			throw new Error('Unsupported GLSL data type: "' + type + '"');
		}
		var setter;
		if (setterName.indexOf('Matrix') !== -1) {
			setter = function (location, value) {
				if (!(value instanceof Matrix)) {
					throw new Error('Matrix required');
				}
				if (value.width !== width || !value.isSquare) {
					console.log(width, value);
					throw new Error('Matrix is the wrong size');
				}
				value = value.transpose().data;
				return setFunc.call(gl, location, gl.FALSE, new Float32Array(value));
			};
		} else {
			setter = function (location, value) {
				if (value instanceof Matrix) {
					value = value.data;
				} else if (typeof value === 'number') {
					value = [value];
				}
				return setFunc.call(gl, location, new Float32Array(value));
			};
		}

		this.updateLocation = updateLocation;
		this.assign = setValue;
		this.set = setValue;
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

		function enableAll() {
			varArray.forEach(function (v) {
				if (v instanceof ShaderAttribute) {
					v.enable();
				}
			});
		}

		function disableAll() {
			varArray.forEach(function (v) {
				if (v instanceof ShaderAttribute) {
					v.disable();
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
