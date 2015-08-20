
var adapter = require('../dist/condanna.min');

describe("Promises/A+ Tests", function () {
	require('promises-aplus-tests').mocha(adapter);
});
