var mongoose = require('mongoose');

var fileSchema = new mongoose.Schema({
	author: String,
	name: String,
	size: Number,
	file:
	{
		data: Buffer,
		contentType: String
	}
});

module.exports = mongoose.model('File', fileSchema);
