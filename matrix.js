module.exports = matrix;

/*@ngInject*/
function matrix(Quaternion) {

	/* Not intended to be fast or efficient */

	var freeze = (process.env.freeze||'').length > 0;

	var __raw = {};

	Matrix.mat4 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
		return Matrix.Raw(4, 4, data);
	};

	Matrix.mat3 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0,0,0,0,0,0,0,0];
		return Matrix.Raw(3, 3, data);
	};

	Matrix.mat2 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0,0,0];
		return Matrix.Raw(2, 2, data);
	};

	Matrix.vec4 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0,0,0];
		return Matrix.Raw(1, 4, data);
	};

	Matrix.vec3 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0,0];
		return Matrix.Raw(1, 3, data);
	};

	Matrix.vec2 = function () {
		var data = arguments.length ? [].slice.apply(arguments) : [0,0];
		return Matrix.Raw(1, 2, data);
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
		return Matrix.Raw(1, 4, [
				d[0], d[1], d[2], br
			]);
	};

	Matrix.vec2to3 = function (v, br) {
		assertVector(v);
		if (v.height !== 2) {
			throw new Error('Vector is wrong size');
		}
		if (arguments.length === 1) {
			br = 1;
		}
		var d = v.data;
		return Matrix.Raw(1, 3, [
				d[0], d[1], br
			]);
	};

	Matrix.mat2to3 = function (m, br) {
		assertMatrix(m);
		if (m.width !== 2 || !m.isSquare) {
			throw new Error('Matrix is wrong size');
		}
		if (arguments.length === 1) {
			br = 1;
		}
		var d = m.data;
		return Matrix.Raw(3, 3, [
				d[0], d[1], 0,
				d[2], d[3], 0,
				0, 0, 0, br
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
		return Matrix.Raw(4, 4, [
				d[0], d[1], d[2], 0,
				d[3], d[4], d[5], 0,
				d[6], d[7], d[8], 0,
				0, 0, 0, br
			]);
	};

	Matrix.mat4to3 = function (m) {
		assertMatrix(m);
		if (m.width !== 4 || !m.isSquare) {
			throw new Error('Matrix is wrong size');
		}
		var d = m.data;
		return Matrix.Raw(3, 3, [
				d[0], d[1], d[2],
				d[4], d[5], d[6],
				d[8], d[9], d[10]
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
		} else if (dx.isMatrix && dx.isVector && dx.length === 3) {
			return translation(dx.data);
		}
		return Matrix.Raw(4, 4, [1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, dz, 0, 0, 0, 1]);
	};

	Matrix.Scale = function scale(sx, sy, sz) {
		if (sx instanceof Array && arguments.length === 1 && sx.length === 3) {
			return scale(sx[0], sx[1], sx[2]);
		} else if (sx.isMatrix && sx.isVector && sx.length === 3) {
			return scale(sx.data);
		} else if (arguments.length === 1) {
			return scale(sx, sx, sx);
		}
		return Matrix.Raw(4, 4, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
	};

	Matrix.Rotation = function rotation(quat) {
		if (arguments.length === 2) {
			quat = new Quaternion(arguments[0], arguments[1]);
		} else if (arguments.length !== 1 || !quat.isQuaternion) {
			console.info(arguments);
			throw new Error('Invalid parameter(s)');
		}
		var data = quat.unit().data;
		var r = data[0], i = data[1], j = data[2], k = data[3];
		return Matrix.Raw(4, 4,
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
		return Matrix.Raw(4, 4,
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
		var m = [].slice.apply(Matrix.Orthographic(-w/2, +w/2, -h/2, +h/2, 0, 1).data);
		m[10] = (z0 + z1) / dz;
		m[11] = -2 * z0 * z1 / dz;
		m[14] = 1;
		m[15] = 0;
		return Matrix.Raw(4, 4, m);
	};

	Matrix.Camera35mm = function (aspect, focal_length, z0, z1) {
		var fovy = 2 * Math.atan2(24, 2 * focal_length);
		return Matrix.Perspective(fovy, aspect, z0, z1);
	};

	Matrix.Translation2D = function translation(dx, dy) {
		if (dx instanceof Array && arguments.length === 1 && dx.length === 2) {
			return translation(dx[0], dx[1]);
		} else if (dx.isMatrix && dx.isVector && dx.length === 2) {
			return translation(dx.data);
		}
		return Matrix.Raw(3, 3, [1, 0, dx, 0, 1, dy, 0, 0, 1]);
	};

	Matrix.Scale2D = function scale(sx, sy) {
		if (sx instanceof Array && arguments.length === 1 && sx.length === 2) {
			return scale(sx[0], sx[1]);
		} else if (sx.isMatrix && sx.isVector && sx.length === 2) {
			return scale(sx.data);
		} else if (arguments.length === 1) {
			return scale(sx, sx);
		}
		return Matrix.Raw(3, 3, [sx, 0, 0, 0, sy, 0, 0, 0, 1]);
	};

	Matrix.Rotation2D = function rotation(angle) {
		var cs = Math.cos(angle);
		var sn = Math.sin(angle);
		return Matrix.Raw(3, 3, [cs, -sn, 0, sn, cs, 0, 0, 0, 1]);
	};

	Matrix.Identity = function (w) {
		var ar = zeros(w * w);
		for (var i = 0; i < w; i++) {
			ar[i * (w + 1)] = 1;
		}
		return Matrix.Raw(w, w, ar);
	};

	Matrix.Raw = function (w, h, ar) {
		return new Matrix(w, h, __raw, ar);
	};

	Matrix.prototype = {
		toString: matrixToString,
		valueOf: matrixToString,

		/* Matrix/vector methods */
		add: matrixAdd,
		sub: matrixSub,
		scale: matrixScale,
		neg: matrixNegate,
		mul: matrixMul,
		transpose: matrixTranspose,
		diagonal: matrixDiagonal,
		extractCol: matrixExtractCol,
		extractRow: matrixExtractRow,

		/* Vector methods */
		dot: vectorDot,
		norm: vectorNorm,
		norm2: vectorNorm2,
		unit: vectorUnit,
		scaleTo: vectorScaleTo,
		cross: vectorCross,

		/* Mutating methods (if !freeze) */
		piecewiseBy: matrixPiecewiseBy,
		incBy: matrixIncBy,
		decBy: matrixDecBy,
		scaleBy: matrixScaleBy,
		mulBy: matrixMulBy,
		xformBy: vectorXformBy,

		/* Properties */
		isMatrix: true,
		width: 0,
		height: 0,
		isSquare: false,
		isVector: false,
		data: null,
		length: 0
	};

	return Matrix;

	function Matrix(w, h, value, raw) {
		var isRaw = value === __raw;
		var wh = w * h;
		if (!isRaw) {
			sanityChecks(arguments.length);
		}
		var square = w === h;
		var vector = w === 1;
		this.width = w;
		this.height = h;
		this.isSquare = square;
		this.isVector = vector;
		var data;
		if (isRaw) {
			data = raw;
		} else {
			coerceValue();
		}
		this.data = data;
		this.length = data.length;
		if (freeze) {
			Object.freeze(data);
			Object.freeze(this);
		}
		return this;

		function sanityChecks(nargs) {
			if (nargs < 2) {
				throw new Error('Arguments missing');
			}
			if (wh <= 0 || w <= 0 || !isFinite(wh) || Math.floor(wh) !== wh) {
				console.info(w, h);
				throw new Error('Matrix dimensions must be positive integers');
			}
		}

		function coerceValue() {
			var i = 0;
			if (value === true) {
				data = zeros(wh);
				for (i = 0; i < w; i++) {
					data[i * (w + 1)] = 1;
				}
			} else if (arguments.length === 2 || value === false || value === null) {
				data = zeros(wh);
			} else if (value instanceof Array) {
				if (value.length && value[0] instanceof Array) {
					value = [].concat.apply([], value);
				}
				var vlen = value.length;
				if (square && vlen === w) {
					data = zeros(wh);
					for (i = 0; i < w; i++) {
						data[i * (w + 1)] = value[i];
					}
				} else if (vlen === wh) {
					data = zeros(wh);
					for (i = 0; i < value.length; i++) {
						var el = value[i];
						if (typeof el !== 'number' || !isFinite(el)) {
							console.info('data:', value);
							console.info('matrix size:', w + 'x' + h);
							throw new Error('Matrix/vector elements must be numerical');
						}
						data[i] = el;
					}
				} else {
					console.info('data length:', vlen);
					console.info('matrix size:', w + 'x' + h);
					throw new Error('Invalid value (size mismatch?)');
				}
			} else {
				console.log(value);
				throw new Error('Invalid matrix initializer');
			}
		}
	}

	function zeros(n) {
		var ar = new Array(n);
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
		if (!a.isMatrix) {
			throw new Error('Matrix required');
		}
	}

	function assertVector(a) {
		if (a.width !== 1) {
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
		return Matrix.Raw(this.width, this.height, ar);
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
		return Matrix.Raw(this.width, this.height, ar);
	}

	function matrixScale(s) {
		var len = this.length;
		var ar = zeros(len);
		var l = this.data;
		for (var i = 0; i < len; i++) {
			ar[i] = l[i] * s;
		}
		return Matrix.Raw(this.width, this.height, ar);
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
			return Matrix.Raw(this.width, this.height);
		}
	}

	function vectorCross(rhs) {
		assertMatrix(rhs);
		assertVector(this);
		assertVector(rhs);
		if (this.height !== 3 || rhs.height !== 3) {
			console.info(this, rhs);
			throw new Error('Cross product only defined on 3D vectors');
		}
		var l = this.data, r = rhs.data;
		var ar = [
			l[1] * r[2] - l[2] - r[1],
			l[0] * r[2] - l[2] - r[0],
			l[0] * r[1] - l[1] - r[0]
		];
		return Matrix.Raw(1, 3, ar);
	}

	function matrixMulRaw(lh, rw, c, l, r) {
		if (lh === 4 && c === 4) {
			if (rw === 4) {
				return mulM4M4(l, r);
			} else if (rw === 1) {
				return mulM4V4(l, r);
			}
		} else if (lh === 3 && c === 3) {
			if (rw === 3) {
				return mulM3M3(l, r);
			} else if (rw === 1) {
				return mulM3V3(l, r);
			}
		}
		var xw = rw, xh = lh;
		var ar = zeros(xw * xh);
		for (var i = 0; i < lh; i++) {
			for (var j = 0; j < rw; j++) {
				var sum = 0;
				for (var k = 0; k < c; k++) {
					sum += l[c * i + k] * r[rw * k + j];
				}
				ar[xw * i + j] = sum;
			}
		}
		return ar;
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
		var ar = matrixMulRaw(lh, rw, lw, this.data, rhs.data);
		return Matrix.Raw(rw, lh, ar);
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
		return Matrix.Raw(this.height, this.width, ar);
	}

	function matrixDiagonal() {
		var w = this.width, h = this.height;
		var l = this.data;
		var c = Math.min(w, h);
		var ar = [];
		for (var i = 0; i < c; i++) {
			ar[i] = l[i * (w + 1)];
		}
		return Matrix.Raw(1, c, ar);
	}

	/*** Slightly optimised multiplication routines ***/

	function mulM4M4(a, b) {
		return [
			a[0]*b[0] + a[1]*b[4] + a[2]*b[8] + a[3]*b[12],
			a[0]*b[1] + a[1]*b[5] + a[2]*b[9] + a[3]*b[13],
			a[0]*b[2] + a[1]*b[6] + a[2]*b[10] + a[3]*b[14],
			a[0]*b[3] + a[1]*b[7] + a[2]*b[11] + a[3]*b[15],

			a[4]*b[0] + a[5]*b[4] + a[6]*b[8] + a[7]*b[12],
			a[4]*b[1] + a[5]*b[5] + a[6]*b[9] + a[7]*b[13],
			a[4]*b[2] + a[5]*b[6] + a[6]*b[10] + a[7]*b[14],
			a[4]*b[3] + a[5]*b[7] + a[6]*b[11] + a[7]*b[15],

			a[8]*b[0] + a[9]*b[4] + a[10]*b[8] + a[11]*b[12],
			a[8]*b[1] + a[9]*b[5] + a[10]*b[9] + a[11]*b[13],
			a[8]*b[2] + a[9]*b[6] + a[10]*b[10] + a[11]*b[14],
			a[8]*b[3] + a[9]*b[7] + a[10]*b[11] + a[11]*b[15],

			a[12]*b[0] + a[13]*b[4] + a[14]*b[8] + a[15]*b[12],
			a[12]*b[1] + a[13]*b[5] + a[14]*b[9] + a[15]*b[13],
			a[12]*b[2] + a[13]*b[6] + a[14]*b[10] + a[15]*b[14],
			a[12]*b[3] + a[13]*b[7] + a[14]*b[11] + a[15]*b[15],
		];
	}

	function mulM4V4(a, b) {
		return [
			a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3],
			a[4]*b[0] + a[5]*b[1] + a[6]*b[2] + a[7]*b[3],
			a[8]*b[0] + a[9]*b[1] + a[10]*b[2] + a[11]*b[3],
			a[12]*b[0] + a[13]*b[1] + a[14]*b[2] + a[15]*b[3],
		];
	}

	function mulM3M3(a, b) {
		return [
			a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
			a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
			a[0]*b[2] + a[1]*b[5] + a[2]*b[8],

			a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
			a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
			a[3]*b[2] + a[4]*b[5] + a[5]*b[8],

			a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
			a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
			a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
		];
	}

	function mulM3V3(a, b) {
		return [
			a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
			a[3]*b[0] + a[4]*b[1] + a[5]*b[2],
			a[6]*b[0] + a[7]*b[1] + a[8]*b[2],
		];
	}

	function matrixIncBy(rhs) {
		assertMatrix(rhs);
		assertSameSize(this, rhs);
		var l = this.data;
		var r = rhs.data;
		var c = l.length;
		for (var i = 0; i < c; i++) {
			l[i] += r[i];
		}
		return this;
	}

	function matrixDecBy(rhs) {
		assertMatrix(rhs);
		assertSameSize(this, rhs);
		var l = this.data;
		var r = rhs.data;
		var c = l.length;
		for (var i = 0; i < c; i++) {
			l[i] -= r[i];
		}
		return this;
	}

	function matrixScaleBy(rhs) {
		var l = this.data;
		var c = l.length;
		for (var i = 0; i < c; i++) {
			l[i] *= rhs;
		}
		return this;
	}

	function matrixMulBy(rhs) {
		if (typeof rhs === 'number') {
			return this.scaleBy(rhs);
		} else {
			var lw = this.width, lh = this.height;
			var rw = rhs.width, rh = rhs.height;
			if (lw !== rh) {
				console.info(lw, lh, rw, rh);
				throw new Error('Matrix multiplication failed, size mismatch');
			}
			if (lh !== rw) {
				console.info(lw, lh, rw, rh);
				throw new Error('Mutating matrix multiplication failed, matrices must be the same size');
			}
			this.data = matrixMulRaw(lw, lw, lw, this.data, rhs.data);
			return this;
		}
	}

	function vectorXformBy(lhs) {
		if (typeof lhs === 'number') {
			return matrixScaleBy(lhs);
		} else {
			var lw = lhs.width, lh = lhs.height;
			var rw = this.width, rh = this.height;
			if (lw !== rh) {
				console.info(lw, lh, rw, rh);
				throw new Error('Matrix multiplication failed, size mismatch');
			}
			if (rw !== 1) {
				console.info(lw, lh, rw, rh);
				throw new Error('Mutating vector transformation, object is a matrix not a vector');
			}
			this.data = matrixMulRaw(lw, 1, lw, lhs.data, this.data);
			return this;
		}
	}

	function matrixExtractCol(index, transpose) {
		var w = this.width, h = this.height;
		if (index < 0 || index >= w) {
			throw new Error('Index out of range');
		}
		var l = this.data;
		var ar = new Array(h);
		for (var i = 0; i < h; i++) {
			ar[i] = l[i * w + index];
		}
		return Matrix.Raw(transpose ? h : 1, transpose ? 1 : h, ar);
	}

	function matrixExtractRow(index, transpose) {
		var w = this.width, h = this.height;
		if (index < 0 || index >= h) {
			throw new Error('Index out of range');
		}
		var l = this.data;
		var ar = new Array(h);
		for (var i = 0; i < w; i++) {
			ar[i] = l[index * w + i];
		}
		return Matrix.Raw(transpose ? 1 : w, transpose ? w : 1, ar);
	}

	function matrixPiecewiseBy(func) {
		var w = this.width, h = this.height;
		var l = this.data;
		var idx = 0;
		for (var i = 0; i < h; i++) {
			for (var j = 0; j < w; j++) {
				l[idx] = func(l[idx], j, i, idx);
				idx++;
			}
		}
		return this;
	}

}
