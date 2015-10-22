module.exports = quaternion;

/*@ngInject*/
function quaternion() {

	function Quaternion(axis, angle) {
		var r, i, j, k;
		if (arguments.length === 4) {
			r = arguments[0];
			i = arguments[1];
			j = arguments[2];
			k = arguments[3];
		} else if (arguments.length === 2) {
			var c = Math.cos(angle / 2);
			var s = Math.sin(angle / 2);
			r = c;
			i = s * axis[0];
			j = s * axis[1];
			k = s * axis[2];
		} else if (arguments.length === 1 && axis.length === 4) {
			r = axis[0];
			i = axis[1];
			j = axis[2];
			k = axis[3];
		} else if (arguments.length === 0) {
			r = 1;
			i = 0;
			j = 0;
			k = 0;
		} else {
			throw new Error('Invalid constructor arguments for quaternion');
		}
		if (!(isFinite(i) && isFinite(j) && isFinite(k) && isFinite(r))) {
			console.log(arguments, this);
			throw new Error('Quaternion members must be finite numbers');
		}
		if (!(this instanceof Quaternion)) {
			return new Quaternion(r, i, j, k);
		}
		this.data = Object.freeze([r, i, j, k]);
		return Object.freeze(this);
	}

	Quaternion.prototype = {
		toString: quaternionToString,
		valueOf: quaternionToString,
		mul: quaternionMul,
		scale: quaternionScale,
		norm2: quaternionNorm2,
		norm: quaternionNorm,
		unit: quaternionUnit,
		scaleTo: quaternionScaleTo
	};

	function assertQuaternion(x) {
		if (!(x instanceof Quaternion)) {
			throw new Error('Quaternion expected');
		}
	}

	function quaternionToString() {
		return '((' + [this.i, this.j, this.k].join(', ') + '), ' + this.r + ')';
	}

	function quaternionMul(x) {
		if (typeof x === 'number') {
			return this.scale(x);
		}
		assertQuaternion(x);
		var r = this.data[0], i = this.data[1], j = this.data[2], k = this.data[3];
		var R = x.data[0], I = x.data[1], J = x.data[2], K = x.data[3];
		return new Quaternion(
			r*R - i*I - j*J - k*K,
			r*I + R*i + j*K - k*J,
			r*J + R*j + k*I - i*K,
			r*K + R*k + i*J - j*I
		);
	}

	function quaternionScale(s) {
		var r = this.data[0], i = this.data[1], j = this.data[2], k = this.data[3];
		return new Quaternion(s*r, s*i, s*j, s*k);
	}

	function quaternionNorm2() {
		var r = this.data[0], i = this.data[1], j = this.data[2], k = this.data[3];
		return r*r + i*i + j*j + k*k;
	}

	function quaternionNorm() {
		return Math.sqrt(this.norm2());
	}

	function quaternionUnit(def) {
		return this.scaleTo(1, def);
	}

	function quaternionScaleTo(length, def) {
		var norm2 = this.norm2();
		if (norm2 !== 0) {
			return this.scale(length / Math.sqrt(norm2));
		} else if (def instanceof Function) {
			return def(this);
		} else if (def) {
			assertQuaternion(def);
			return def;
		} else {
			return new Quaternion();
		}
	}

	return Quaternion;

}
