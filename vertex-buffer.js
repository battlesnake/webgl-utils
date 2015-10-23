module.exports = vertexBuffer;

/*@ngInject*/
function vertexBuffer() {

	return VertexBuffer;

	function VertexBuffer(gl, data, width, type, isDynamic) {
		var hasData = typeof data !== 'number';
		var length = hasData ? data.length : data;
		var count = length / width;
		if (count !== Math.floor(count) || width === 0) {
			throw new Error('Dataset is incomplete');
		}
		this.buffer = gl.createBuffer();
		this.width = width;
		this.count = count;
		this.bind = bind;
		this.typeCode = gl.FLOAT;
		this.draw = draw;
		this.dynamic = !!isDynamic;
		this.assign = assign;

		if (hasData) {
			assign(data);
		}

		return Object.freeze(this);

		function assign(data) {
			if (data instanceof Array) {
				data = new Float32Array(data);
			}
			if (data.length > length) {
				throw new Error('Vertex buffer over-run');
			}
			this.bind();
			gl.bufferData(gl.ARRAY_BUFFER, data, isDynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
		}

		function bind() {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		}

		function draw(asType, drawCount) {
			if (arguments.length === 0) {
				asType = type;
			}
			if (arguments.length <= 1) {
				drawCount = count;
			}
			gl.drawArrays(asType, 0, drawCount);
		}
	}
}
