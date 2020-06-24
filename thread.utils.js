const CL_ERROR = '#ff713b';

function logError(error) {
	console.log(`<span style="color: ${CL_ERROR}">${error.stack.replace(/\n/g, '<br>')}</span>`);
}

module.exports = {
	logError
};