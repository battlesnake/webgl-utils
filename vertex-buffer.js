module.exports = vertexBuffer;

/*@ngInject*/
function vertexBuffer() {

	return VertexBuffer;

	function VertexBuffer(gl, data, width, type) {
		var count = data.length / width;
		if (count !== Math.floor(count) || width === 0) {
			throw new Error('Dataset is incomplete');
		}
		this.buffer = gl.createBuffer();
		this.width = width;
		this.count = count;
		this.bind = bind;
		this.typeCode = gl.FLOAT;
		this.draw = draw;

		this.bind();
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

		return Object.freeze(this);

		function bind() {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		}

		function draw(asType) {
			if (arguments.length === 0) {
				asType = type;
			}
			gl.drawArrays(asType, 0, count);
		}
	}
}
