module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/server'],
	testMatch: ['**/__tests__/**/*.test.ts'],
	collectCoverageFrom: [
		'server/**/*.ts',
		'!server/**/*.d.ts',
		'!server/__tests__/**',
	],
	setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts'],
};
