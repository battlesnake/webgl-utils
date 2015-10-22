module.exports = matrix;

/*@ngInject*/
function matrix(Quaternion) {

	/* Not intended to be fast or efficient */

	Matrix.mat4 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : null;
		return new Matrix(4, 4, data);
	};

	Matrix.mat3 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : null;
		return new Matrix(3, 3, data);
	};

	Matrix.vec4 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : null;
		return new Matrix(1, 4, data);
	};

	Matrix.vec3 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : null;
		return new Matrix(1, 3, data);
	};

	Matrix.vec3to4 = function (v, br) {
		assertVector(v);
		if (v.height !== 3) {
			throw new Error('Vector is wrong size');
		}
		if (arguments.length === 1) {
			br = 1;
		}
		var d = v.data;
		return new Matrix(1, 4, [
				d[0], d[1], d[2], br
			]);
	};

	Matrix.mat3to4 = function (m, br) {
		assertMatrix(m);
		if (m.width !== 3 || !m.isSquare) {
			throw new Error('Matrix is wrong size');
		}
		if (arguments.length === 1) {
			br = 1;
		}
		var d = m.data;
		return new Matrix(4, 4, [
				d[0], d[1], d[2], 0,
				d[3], d[4], d[5], 0,
				d[6], d[7], d[8], 0,
				0, 0, 0, br
			]);
	};

	Matrix.Chain = function mulChain(m) {
		if (m instanceof Array) {
			return mulChain.apply(Matrix, m);
		}
		var r = m;
		for (var i = 1; i < arguments.length; i++) {
			r = r.mul(arguments[i]);
		}
		return r;
	};

	Matrix.Translation = function translation(dx, dy, dz) {
		if (dx instanceof Array && arguments.length === 1 && dx.length === 3) {
			return translation(dx[0], dx[1], dx[2]);
		} else if (dx instanceof Matrix && dx.isVector && dx.length === 3) {
			return translation(dx.data);
		}
		return new Matrix(4, 4, [1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, dz, 0, 0, 0, 1]);
	};

	Matrix.Scale = function scale(sx, sy, sz) {
		if (sx instanceof Array && arguments.length === 1 && sx.length === 3) {
			return scale(sx[0], sx[1], sx[2]);
		} else if (sx instanceof Matrix && sx.isVector && sx.length === 3) {
			return scale(sx.data);
		} else if (arguments.length === 1) {
			return scale(sx, sx, sx);
		}
		return new Matrix(4, 4, [sx, sy, sz, 1]);
	};

	Matrix.Rotation = function rotation(quat) {
		if (arguments.length === 2) {
			quat = new Quaternion(arguments[0], arguments[1]);
		} else if (arguments.length !== 1 || !(quat instanceof Quaternion)) {
			console.info(arguments);
			throw new Error('Invalid parameter(s)');
		}
		var data = quat.unit().data;
		var r = data[0], i = data[1], j = data[2], k = data[3];
		return new Matrix(4, 4,
			[
				r*r + i*i - j*j - k*k,
				2*(i*j - r*k),
				2*(i*k + r*j),
				0,
				2*(i*j + r*k),
				r*r - i*i + j*j - k*k,
				2*(j*k - r*i),
				0,
				2*(i*k - r*j),
				2*(j*k + r*i),
				r*r - i*i - j*j + k*k,
				0,
				0, 0, 0, 1
			]);
	};

	Matrix.RotationAbout = function (centre, quat) {
		return Matrix.Translation(-centre)
			.mul(Matrix.Rotation(quat))
			.mul(Matrix.Translation(centre));
	};

	Matrix.Orthographic = function (x0, x1, y0, y1, z0, z1) {
		var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
		var cx = x1 + x0, cy = y1 + y0, cz = z1 + z0;
		return new Matrix(4, 4,
			[
				2/dx, 0, 0, -cx/dx,
				0, 2/dy, 0, -cy/dy,
				0, 0, 2/dz, -cz/dz,
				0, 0, 0, 1
			]);
	};

	Matrix.Perspective = function (fovy, aspect, z0, z1) {
		var h = 2 * Math.tan(fovy / 2);
		var w = aspect * h;
		var dz = z1 - z0;
		/* Orthographic projection, then divide by z-value */
		var m = [].slice.apply(new Matrix.Orthographic(-w/2, +w/2, -h/2, +h/2, 0, 1).data);
		m[10] = (z0 + z1) / dz;
		m[11] = -2 * z0 * z1 / dz;
		m[14] = 1;
		m[15] = 0;
		return new Matrix(4, 4, m);
	};

	Matrix.Camera35mm = function (aspect, focal_length, z0, z1) {
		var fovy = 2 * Math.atan2(24, 2 * focal_length);
		return new Matrix.Perspective(fovy, aspect, z0, z1);
	};

	Matrix.Identity = function (w) {
		return new Matrix(w, w, true);
	};

	Matrix.prototype = {
		toString: matrixToString,
		valueOf: matrixToString,
		add: matrixAdd,
		sub: matrixSub,
		scale: matrixScale,
		neg: matrixNegate,
		mul: matrixMul,
		transpose: matrixTranspose,
		dot: vectorDot,
		norm: vectorNorm,
		norm2: vectorNorm2,
		unit: vectorUnit,
		scaleTo: vectorScaleTo,
		cross: vectorCross,
	};

	return Matrix;

	function Matrix(w, h, value) {
		if (arguments.length < 2) {
			throw new Error('Arguments missing');
		}
		var wh = w * h;
		if (wh === 0 || !isFinite(wh) || Math.floor(wh) !== wh) {
			console.info(w, h);
			throw new Error('Matrix dimensions must be positive integers');
		}
		this.width = w;
		this.height = h;
		this.isSquare = w === h;
		this.isVector = w === 1;
		var data = zeros(wh);
		if (arguments.length === 2 || value === false || value === null) {
			setZero.call(this);
		} else if (value === true) {
			setIdentity.call(this);
		} else if (value instanceof Array) {
			value = [].concat.apply([], value);
			if (w === h && value.length === w) {
				setDiagonal.call(this, value);
			} else if (value.length === wh) {
				pushArray.call(this, value);
			} else {
				console.info('data length:', value.length);
				console.info('matrix size:', w + 'x' + h);
				throw new Error('Invalid value (size mismatch?)');
			}
		} else {
			console.log(value);
			throw new Error('Invalid matrix initializer');
		}
		if (!(this instanceof Matrix)) {
			return new Matrix(w, h, data);
		}
		this.data = Object.freeze(data);
		this.length = data.length;
		return Object.freeze(this);

		function setDiagonal(t) {
			for (var i = 0; i < w; i++) {
				data[i * (w + 1)] = t[i];
			}
		}

		function setIdentity() {
			for (var i = 0; i < w; i++) {
				data[i * (w + 1)] = 1;
			}
		}

		function setZero() {
		}

		function pushArray(arr) {
			for (var i = 0; i < arr.length; i++) {
				var el = arr[i];
				if (typeof el !== 'number' || !isFinite(el)) {
					console.info('data:', arr);
					console.info('matrix size:', w + 'x' + h);
					throw new Error('Matrix/vector elements must be numerical');
				}
				data[i] = el;
			}
		}
	}

	function zeros(n) {
		var ar = [];
		ar.length = n;
		for (var i = 0; i < n; i++) {
			ar[i] = 0;
		}
		return ar;
	}

	function assertSameSize(a, b) {
		if (a.width !== b.width || a.height !== b.height) {
			console.info(a.width, a.height, b.width, b.height);
			throw new Error('Matrix length mismatch');
		}
	}

	function assertMatrix(a) {
		if (!(a instanceof Matrix)) {
			throw new Error('Matrix required');
		}
	}

	function assertVector(a) {
		if (!a.isVector) {
			console.info(a.width, a.height);
			throw new Error('Vector required');
		}
	}

	function matrixToString() {
		var m = [];
		var i = 0;
		for (var h = 0; h < this.height; h++) {
			var r = [];
			m.push(r);
			for (var w = 0; w < this.width; w++) {
				r.push(this.data[i++]);
			}
		}
		return m.map(function (r) { return r.join(', '); }).join('; ');
	}

	function matrixAdd(rhs) {
		assertSameSize(this, rhs);
		var len = this.length;
		var ar = zeros(len);
		var l = this.data, r = rhs.data;
		for (var i = 0; i < len; i++) {
			ar[i] = l[i] + r[i];
		}
		return new Matrix(this.width, this.height, ar);
	}

	function matrixSub(rhs) {
		assertMatrix(rhs);
		assertSameSize(this, rhs);
		var len = this.length;
		var ar = zeros(len);
		var l = this.data, r = rhs.data;
		for (var i = 0; i < len; i++) {
			ar[i] = l[i] - r[i];
		}
		return new Matrix(this.width, this.height, ar);
	}

	function matrixScale(s) {
		var len = this.length;
		var ar = zeros(len);
		var l = this.data;
		for (var i = 0; i < len; i++) {
			ar[i] = l[i] * s;
		}
		return new Matrix(this.width, this.height, ar);
	}

	function matrixNegate() {
		return this.scale(-1);
	}

	function vectorDot(rhs) {
		assertMatrix(rhs);
		assertSameSize(this, rhs);
		assertVector(this);
		var sum = 0;
		var l = this.data, r = rhs.data;
		for (var i = 0; i < this.length; i++) {
			sum += l[i] * r[i];
		}
		return sum;
	}

	function vectorNorm2() {
		return this.dot(this);
	}

	function vectorNorm() {
		return Math.sqrt(this.norm2());
	}

	function vectorUnit(def) {
		return this.scaleTo(1, def);
	}

	function vectorScaleTo(length, def) {
		var norm2 = this.norm2();
		if (norm2 !== 0) {
			return this.scale(length / Math.sqrt(norm2));
		} else if (def instanceof Function) {
			return def(this);
		} else if (def) {
			assertMatrix(def);
			return def;
		} else {
			return new Matrix(this.width, this.height);
		}
	}

	function vectorCross(rhs) {
		assertMatrix(rhs);
		assertSameSize(this, rhs);
		assertVector(this);
		if (this.height !== 3) {
			console.info(this.height);
			throw new Error('Cross product only defined on 3D vectors');
		}
		var l = this.data, r = rhs.data;
		var ar = [
			l[1] * r[2] - l[2] - r[1],
			l[0] * r[2] - l[2] - r[0],
			l[0] * r[1] - l[1] - r[0]
		];
		return new Matrix(this.width, this.height, ar);
	}

	function matrixMul(rhs) {
		if (typeof rhs === 'number') {
			return this.scale(rhs);
		}
		assertMatrix(rhs);
		var lw = this.width, lh = this.height;
		var rw = rhs.width, rh = rhs.height;
		if (lw !== rh) {
			console.info(lw, lh, rw, rh);
			throw new Error('Matrix multiplication failed, size mismatch');
		}
		var xw = rw, xh = lh;
		var ar = zeros(xw * xh);
		var l = this.data, r = rhs.data;
		for (var i = 0; i < lh; i++) {
			for (var j = 0; j < rw; j++) {
				var sum = 0;
				for (var k = 0; k < lw; k++) {
					sum += l[lw * i + k] * r[rw * k + j];
				}
				ar[xw * i + j] = sum;
			}
		}
		return new Matrix(rw, lh, ar);
	}

	function matrixTranspose() {
		var ar = zeros(this.length);
		var w = this.width, h = this.height;
		var l = this.data;
		for (var i = 0; i < h; i++) {
			for (var j = 0; j < w; j++) {
				ar[i + j * h] = l[j + i * w];
			}
		}
		return new Matrix(this.height, this.width, ar);
	}

}
