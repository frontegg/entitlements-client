class MissingTypeInformationError extends Error {
	constructor(filename) {
		super(
			`require-namespaced-object-type needs type information to lint ${filename}. ` +
				'Set languageOptions.parserOptions.project and tsconfigRootDir for this file.'
		);
		this.name = 'MissingTypeInformationError';
	}
}

module.exports = { MissingTypeInformationError };
